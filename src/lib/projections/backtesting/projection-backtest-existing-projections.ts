import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type {
  ProjectionBacktestExistingProjectionRow,
  ProjectionBacktestExistingProjectionSource,
} from "./projection-backtest-types";

const DEFAULT_CANDIDATES = [
  "backtesting/preseason-projection-snapshot-{season}.json",
  "preseason-projection-snapshot-{season}.json",
  "blackbird-existing-projections-{season}.json",
  "projection-backtest-existing-projections-{season}.json",
  "h9-combined-projection-read-model.json",
  "h9-league-projections-2025-to-2026.json",
  "h9-idp-k-projections-2025-to-2026.json",
];

export function discoverExistingProjectionSource(input: {
  targetSeason: number;
  explicitPath?: string | null;
}): ProjectionBacktestExistingProjectionSource {
  const baseDir = path.join(process.cwd(), "artifacts", "projections");
  const candidates = candidatePaths(baseDir, input.targetSeason, input.explicitPath ?? null);
  const diagnostics: string[] = [];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      diagnostics.push(`not_found:${relative(candidate)}`);
      continue;
    }
    const loaded = loadExistingProjectionSourceFromArtifact(candidate, input.targetSeason);
    diagnostics.push(...loaded.diagnostics);
    if (loaded.status === "available") return loaded;
  }
  return {
    status: "unavailable",
    sourceName: "none",
    sourcePath: null,
    targetSeason: input.targetSeason,
    projectionSeason: null,
    leakageSafe: false,
    rows: [],
    diagnostics: [
      "No leakage-safe existing Blackbird projection source was found for the requested target season.",
      ...diagnostics,
      ...knownProjectionArtifactNotes(baseDir, input.targetSeason),
    ],
  };
}

export function loadExistingProjectionSourceFromArtifact(filePath: string, targetSeason: number): ProjectionBacktestExistingProjectionSource {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    const metadata = metadataFromArtifact(parsed);
    const rows = rowsFromArtifact(parsed);
    const diagnostics = [`checked:${relative(filePath)}`];
    if (metadata.projectionSeason !== null && metadata.projectionSeason !== targetSeason) {
      return rejected(filePath, metadata, rows, [
        ...diagnostics,
        `rejected:projection_season_${metadata.projectionSeason}_does_not_match_target_${targetSeason}`,
      ]);
    }
    if (metadata.targetSeason !== null && metadata.targetSeason !== targetSeason) {
      return rejected(filePath, metadata, rows, [
        ...diagnostics,
        `rejected:target_season_${metadata.targetSeason}_does_not_match_target_${targetSeason}`,
      ]);
    }
    if (!metadata.leakageSafe) {
      return rejected(filePath, metadata, rows, [
        ...diagnostics,
        "rejected:source_did_not_declare_leakage_safe_true",
      ]);
    }
    if (!rows.length) {
      return rejected(filePath, metadata, rows, [
        ...diagnostics,
        "rejected:no_projection_rows_found",
      ]);
    }
    return {
      status: "available",
      sourceName: metadata.sourceName,
      sourcePath: filePath,
      targetSeason: metadata.targetSeason ?? targetSeason,
      projectionSeason: metadata.projectionSeason ?? targetSeason,
      leakageSafe: true,
      rows,
      diagnostics: [...diagnostics, `available:${rows.length}_rows`],
    };
  } catch (error) {
    return {
      status: "rejected",
      sourceName: path.basename(filePath),
      sourcePath: filePath,
      targetSeason,
      projectionSeason: null,
      leakageSafe: false,
      rows: [],
      diagnostics: [`checked:${relative(filePath)}`, `rejected:parse_error:${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

function candidatePaths(baseDir: string, targetSeason: number, explicitPath: string | null) {
  const paths = explicitPath ? [path.resolve(explicitPath)] : [];
  return [
    ...paths,
    ...DEFAULT_CANDIDATES.map((candidate) => path.join(baseDir, candidate.replace("{season}", String(targetSeason)))),
  ];
}

function metadataFromArtifact(value: unknown) {
  const root = asRecord(value) ?? {};
  const metadata = asRecord(root.metadata) ?? root;
  const options = asRecord(root.options);
  const scoring = asRecord(root.scoring);
  return {
    sourceName: stringValue(metadata.sourceName) ?? stringValue(metadata.source) ?? stringValue(scoring?.profile) ?? "blackbird_projection_artifact",
    targetSeason: numberValue(metadata.targetSeason) ?? numberValue(root.targetSeason) ?? numberValue(options?.targetSeason),
    projectionSeason: numberValue(metadata.projectionSeason) ?? numberValue(root.projectionSeason) ?? numberValue(root.projection_season),
    leakageSafe: Boolean(metadata.leakageSafe ?? root.leakageSafe ?? asRecord(root.leakageSafety)?.sourceIsPreTargetSeason),
  };
}

function rowsFromArtifact(value: unknown): ProjectionBacktestExistingProjectionRow[] {
  const root = asRecord(value) ?? {};
  const rawRows = Array.isArray(root.rows)
    ? root.rows
    : Array.isArray(root.projections)
      ? root.projections
      : Array.isArray(root.leagueOutputs)
        ? root.leagueOutputs
        : [];
  return rawRows
    .map(normalizeProjectionRow)
    .filter((row): row is ProjectionBacktestExistingProjectionRow => Boolean(row));
}

function normalizeProjectionRow(value: unknown): ProjectionBacktestExistingProjectionRow | null {
  const row = asRecord(value);
  if (!row) return null;
  const name = stringValue(row.playerName) ?? stringValue(row.displayName) ?? stringValue(row.full_name) ?? stringValue(row.name);
  const position = stringValue(row.position) ?? stringValue(row.positionGroup);
  if (!name || !position) return null;
  const projectedTotalPoints = numberValue(row.projectedTotalPoints) ?? numberValue(row.medianPoints) ?? numberValue(row.median_points);
  const projectedPpg = numberValue(row.projectedPpg) ?? numberValue(row.projected_ppg_when_in_role);
  const projectedGames = numberValue(row.projectedGames) ?? numberValue(row.expectedGames);
  if (projectedTotalPoints === null && projectedPpg === null) return null;
  return {
    playerId: stringValue(row.playerId) ?? stringValue(row.entityId) ?? stringValue(row.canonical_player_id),
    sleeperId: stringValue(row.sleeperId) ?? stringValue(row.sleeper_id),
    gsisId: stringValue(row.gsisId) ?? stringValue(row.gsis_id),
    espnId: stringValue(row.espnId) ?? stringValue(row.espn_id),
    playerName: name,
    normalizedName: normalizeName(name),
    position: position.toUpperCase(),
    team: stringValue(row.team),
    projectedTotalPoints,
    projectedPpg,
    projectedGames,
    floorPoints: numberValue(row.floorPoints) ?? numberValue(row.floor_points),
    medianPoints: numberValue(row.medianPoints) ?? numberValue(row.median_points),
    ceilingPoints: numberValue(row.ceilingPoints) ?? numberValue(row.ceiling_points),
    confidence: stringValue(row.confidence) ?? stringValue(row.confidenceLabel) ?? stringValue(row.projection_confidence_label),
    source: stringValue(row.projectionSource) ?? stringValue(row.source) ?? "blackbird_existing_projection",
    projectionRunId: stringValue(row.projectionRunId) ?? stringValue(row.projection_run_id),
    matchConfidence: stringValue(row.matchConfidence) ?? "artifact_identity",
  };
}

function rejected(filePath: string, metadata: ReturnType<typeof metadataFromArtifact>, rows: ProjectionBacktestExistingProjectionRow[], diagnostics: string[]): ProjectionBacktestExistingProjectionSource {
  return {
    status: "rejected",
    sourceName: metadata.sourceName,
    sourcePath: filePath,
    targetSeason: metadata.targetSeason,
    projectionSeason: metadata.projectionSeason,
    leakageSafe: metadata.leakageSafe,
    rows,
    diagnostics,
  };
}

function knownProjectionArtifactNotes(baseDir: string, targetSeason: number) {
  if (!existsSync(baseDir)) return [];
  return readdirSync(baseDir)
    .filter((file) => /projection/i.test(file) && file.endsWith(".json"))
    .slice(0, 12)
    .map((file) => `discovered_projection_artifact:${file}:not_used_for_target_${targetSeason}_unless_explicitly_leakage_safe`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "").replace(/[^a-z0-9]/g, "");
}

function relative(filePath: string) {
  return path.relative(process.cwd(), filePath);
}
