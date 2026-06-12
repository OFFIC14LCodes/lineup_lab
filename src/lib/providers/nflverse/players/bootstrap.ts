import { readFileSync } from "node:fs";

import Papa from "papaparse";
import type { SupabaseClient } from "@supabase/supabase-js";

import { downloadNflversePlayers } from "./download";
import { parseNflversePlayerRow } from "./normalize";
import { loadExistingGsisMappings, loadPlayerBridgeMaps, resolvePlayer } from "./resolve";
import { validateNflversePlayersSchema } from "./schema";
import type {
  GsisBootstrapCoverage,
  GsisBootstrapOptions,
  GsisBootstrapReport,
  GsisBootstrapResult
} from "./types";

const UPSERT_CHUNK = 500;

export async function runGsisBootstrap(
  options: GsisBootstrapOptions,
  adminClient: SupabaseClient
): Promise<GsisBootstrapReport> {
  const startedAt = Date.now();
  const { mode, projectRoot } = options;

  // 1. Download and archive players.csv
  const download = await downloadNflversePlayers(projectRoot);

  // 2. Parse CSV
  const fileContent = readFileSync(download.filePath, "utf8");
  const parsed = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true
  });

  const columns = parsed.meta.fields ?? [];
  const schemaResult = validateNflversePlayersSchema(columns);
  if (!schemaResult.valid) {
    return {
      mode,
      sourceUrl: download.sourceUrl,
      filePath: download.filePath,
      sha256: download.sha256,
      alreadyArchived: download.alreadyArchived,
      schemaValid: false,
      missingColumns: schemaResult.missingColumns,
      coverage: emptyCoverage(),
      manualReviewList: [],
      durationMs: Date.now() - startedAt,
      completedAt: new Date().toISOString()
    };
  }

  const rawRows = parsed.data;
  const coverage: GsisBootstrapCoverage = emptyCoverage();
  coverage.totalSourceRows = rawRows.length;

  // 3. First pass: normalize all rows, collect valid player rows and GSIS IDs
  const playerRows: ReturnType<typeof parseNflversePlayerRow>[] = rawRows.map(parseNflversePlayerRow);
  const validPlayerRows = playerRows.filter((r): r is typeof r & { ok: true } => r.ok).map((r) => r.row);

  for (const result of playerRows) {
    if (!result.ok) coverage.rejectedRows += 1;
  }

  const allGsisIds = validPlayerRows.map((r) => r.gsisId);

  // 4. Bulk load resolution data (read-only DB queries)
  const existingMap = await loadExistingGsisMappings(allGsisIds, adminClient);
  const bridges = await loadPlayerBridgeMaps(adminClient);

  // 5. Resolve each player using the priority cascade
  const results: GsisBootstrapResult[] = validPlayerRows.map((player) =>
    resolvePlayer(player, existingMap, bridges)
  );

  // 6. Tabulate coverage
  const manualReviewList: GsisBootstrapResult[] = [];
  for (const result of results) {
    switch (result.bootstrapStatus) {
      case "existing":
        coverage.existingMappings += 1;
        break;
      case "ready":
        if (result.bridgeMethod === "stats_id") coverage.readyViaGsisId += 1;
        else if (result.bridgeMethod === "espn_id") coverage.readyViaEspnId += 1;
        break;
      case "manual_review":
        coverage.manualReviewRows += 1;
        manualReviewList.push(result);
        break;
      case "conflict":
        coverage.conflictRows += 1;
        break;
      case "unresolved":
        coverage.unresolvedRows += 1;
        break;
    }
  }

  // 7. Execute mode: write player_external_ids for all "ready" players
  if (mode === "execute") {
    const readyPlayers = results.filter((r) => r.bootstrapStatus === "ready" && r.playerId !== null);

    for (let i = 0; i < readyPlayers.length; i += UPSERT_CHUNK) {
      const chunk = readyPlayers.slice(i, i + UPSERT_CHUNK);
      const rows = chunk.map((r) => ({
        player_id: r.playerId,
        provider: "gsis",
        external_id: r.gsisId,
        external_type: "gsis",
        mapping_status: "auto_matched",
        mapping_method: r.bridgeMethod,
        confidence: r.bridgeMethod === "stats_id" ? 0.99 : 0.9,
        metadata_json: {
          source: "nflverse_players_csv",
          nflverse_position_group: r.positionGroup,
          bootstrap_completed_at: new Date().toISOString()
        }
      }));

      const { error } = await adminClient
        .from("player_external_ids")
        .upsert(rows, { onConflict: "provider,external_id,external_type", ignoreDuplicates: true });

      if (error) {
        coverage.errorRows += chunk.length;
      } else {
        coverage.writtenRows += chunk.length;
      }
    }
  }

  return {
    mode,
    sourceUrl: download.sourceUrl,
    filePath: download.filePath,
    sha256: download.sha256,
    alreadyArchived: download.alreadyArchived,
    schemaValid: true,
    missingColumns: [],
    coverage,
    manualReviewList,
    durationMs: Date.now() - startedAt,
    completedAt: new Date().toISOString()
  };
}

function emptyCoverage(): GsisBootstrapCoverage {
  return {
    totalSourceRows: 0,
    rejectedRows: 0,
    existingMappings: 0,
    readyViaGsisId: 0,
    readyViaEspnId: 0,
    manualReviewRows: 0,
    conflictRows: 0,
    unresolvedRows: 0,
    writtenRows: 0,
    errorRows: 0
  };
}
