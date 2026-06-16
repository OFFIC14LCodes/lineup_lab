import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import { loadRookieData } from "@/lib/projections/rookie-data-loader";
import {
  buildRookieEnrichmentTemplateRows,
  ROOKIE_ENRICHMENT_TEMPLATE_COLUMNS,
  serializeCsv,
} from "@/lib/projections/rookie-enrichment-workflow";
import { loadCollegeProductionRecords, type CollegeProductionRecord } from "./college-production-source";
import type { SourceAttribution, SourceMatchStatus } from "./data-source-types";
import { dataGapCounts, qualityVerdict } from "./data-quality";
import { matchAcquiredPlayer } from "./player-identity-match";
import { loadDraftCapitalRecords, type DraftCapitalRecord } from "./nfl-draft-capital-source";
import { loadRoleNotesRecords, type RoleNotesRecord } from "./role-notes-source";
import { addFieldAttribution, type FieldAttributionMap } from "./source-attribution";

const ROOKIE_DIR = path.join(process.cwd(), "data", "rookies");
const OUTPUT_PATH = path.join(ROOKIE_DIR, "rookie-enrichment.csv");
const ATTRIBUTION_PATH = path.join(ROOKIE_DIR, "rookie-enrichment-attribution.json");
const PRIORITY_PATH = path.join(ROOKIE_DIR, "rookie-enrichment-priority.csv");

export type BuildRookieEnrichmentOptions = {
  priorityOnly?: boolean;
  writeFiles?: boolean;
  draftCapitalPath?: string;
  collegeProductionPath?: string;
  roleNotesPath?: string;
};

export type BuildRookieEnrichmentReport = {
  generatedAt: string;
  priorityOnly: boolean;
  files: {
    outputPath: string;
    attributionPath: string;
    priorityPath: string;
  };
  counts: {
    baseRookieRows: number;
    outputRows: number;
    sourceRows: number;
    draftCapitalSourceRows: number;
    collegeProductionSourceRows: number;
    roleNotesSourceRows: number;
    appliedValues: number;
    conflictCount: number;
    unmatchedSourceRows: number;
    ambiguousSourceRows: number;
    skippedByPriorityOnly: number;
  };
  populatedFields: Record<string, number>;
  dataGaps: Array<{ key: string; count: number }>;
  conflicts: MergeConflict[];
  unmatched: SourceMergeResult[];
  ambiguous: SourceMergeResult[];
  safety: {
    noScraping: true;
    noPaidApi: true;
    noAi: true;
    noAdpFallback: true;
    noBlankOverwrite: true;
    noFabricatedFields: true;
  };
  verdict: "passed" | "needs_source_data" | "failed";
};

type SourceMergeResult = {
  sourceType: "draft_capital" | "college_production" | "role_notes";
  rowNumber: number;
  playerId: string | null;
  playerName: string;
  position: string;
  matchStatus: SourceMatchStatus;
  unresolvedReason: string | null;
};

type MergeConflict = SourceMergeResult & {
  field: string;
  existingValue: string;
  sourceValue: string;
  sourceLabel: string;
};

type SourceRecord =
  | { sourceType: "draft_capital"; row: DraftCapitalRecord; values: Record<string, unknown>; attribution: SourceAttribution; dataGaps: string[] }
  | { sourceType: "college_production"; row: CollegeProductionRecord; values: Record<string, unknown>; attribution: SourceAttribution; dataGaps: string[] }
  | { sourceType: "role_notes"; row: RoleNotesRecord; values: Record<string, unknown>; attribution: SourceAttribution; dataGaps: string[] };

export function buildRookieEnrichment(options: BuildRookieEnrichmentOptions = {}): BuildRookieEnrichmentReport {
  const generatedAt = new Date().toISOString();
  const loadResult = loadRookieData({ dryRun: true, useExampleWhenMissing: false });
  const rows = buildRookieEnrichmentTemplateRows(loadResult);
  const rowsByPlayerId = new Map<string, Record<string, string>>();
  const candidates = loadResult.rows.map((row) => {
    const playerId = row.matchedPlayerId ?? row.profile.playerId;
    rowsByPlayerId.set(playerId, rows.find((candidate) => candidate.playerId === playerId) ?? {});
    return {
      playerId,
      playerName: row.profile.playerName,
      position: row.profile.position,
      team: row.profile.team,
    };
  });
  const priorityIds = options.priorityOnly ? readPriorityPlayerIds(PRIORITY_PATH) : null;
  const attributionMap: FieldAttributionMap = {};
  const conflicts: MergeConflict[] = [];
  const unmatched: SourceMergeResult[] = [];
  const ambiguous: SourceMergeResult[] = [];
  let appliedValues = 0;
  let skippedByPriorityOnly = 0;

  const draftCapital = loadDraftCapitalRecords(options.draftCapitalPath);
  const collegeProduction = loadCollegeProductionRecords(options.collegeProductionPath);
  const roleNotes = loadRoleNotesRecords(options.roleNotesPath);
  const sourceRecords: SourceRecord[] = [
    ...draftCapital.map((row) => ({ sourceType: "draft_capital" as const, row, values: draftCapitalValues(row), attribution: row.attribution, dataGaps: row.dataGaps })),
    ...collegeProduction.map((row) => ({ sourceType: "college_production" as const, row, values: collegeProductionValues(row), attribution: row.attribution, dataGaps: row.dataGaps })),
    ...roleNotes.map((row) => ({ sourceType: "role_notes" as const, row, values: roleNotesValues(row), attribution: row.attribution, dataGaps: row.dataGaps })),
  ];

  for (const sourceRecord of sourceRecords) {
    const identity = identityFor(sourceRecord);
    const match = matchAcquiredPlayer(identity, candidates);
    const result = mergeResult(sourceRecord, match.matchStatus, match.unresolvedReason);
    if (!match.playerId) {
      if (match.matchStatus === "ambiguous") ambiguous.push(result);
      else unmatched.push(result);
      continue;
    }
    if (priorityIds && !priorityIds.has(match.playerId)) {
      skippedByPriorityOnly += 1;
      continue;
    }
    const outputRow = rowsByPlayerId.get(match.playerId);
    if (!outputRow) {
      unmatched.push({ ...result, matchStatus: "unmatched", unresolvedReason: "matched player id was not present in output rows" });
      continue;
    }
    for (const [field, rawValue] of Object.entries(sourceRecord.values)) {
      if (!shouldApply(rawValue)) continue;
      const sourceValue = Array.isArray(rawValue) ? rawValue.join("|") : String(rawValue);
      const existing = String(outputRow[field] ?? "").trim();
      if (existing && existing !== sourceValue) {
        conflicts.push({ ...result, field, existingValue: existing, sourceValue, sourceLabel: sourceRecord.attribution.sourceLabel });
        continue;
      }
      outputRow[field] = sourceValue;
      addFieldAttribution(attributionMap, match.playerId, field, sourceRecord.attribution);
      appliedValues += 1;
    }
    appendSourceLabel(outputRow, sourceRecord.attribution);
  }

  mkdirSync(ROOKIE_DIR, { recursive: true });
  if (options.writeFiles ?? true) {
    writeFileSync(OUTPUT_PATH, serializeCsv(rows, ROOKIE_ENRICHMENT_TEMPLATE_COLUMNS));
    writeFileSync(ATTRIBUTION_PATH, `${JSON.stringify(attributionMap, null, 2)}\n`);
  }

  const populatedFields = Object.fromEntries(
    ROOKIE_ENRICHMENT_TEMPLATE_COLUMNS.map((column) => [column, rows.filter((row) => shouldApply(row[column])).length])
  );
  const verdict = qualityVerdict({
    totalRows: sourceRecords.length,
    sourceRows: sourceRecords.length,
    invalidRows: 0,
    conflictCount: conflicts.length,
  });
  const dataGaps = Object.entries(dataGapCounts(loadResult.rows.map((row) => row.profile)))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, count }));
  return {
    generatedAt,
    priorityOnly: Boolean(options.priorityOnly),
    files: { outputPath: OUTPUT_PATH, attributionPath: ATTRIBUTION_PATH, priorityPath: PRIORITY_PATH },
    counts: {
      baseRookieRows: loadResult.rows.length,
      outputRows: rows.length,
      sourceRows: sourceRecords.length,
      draftCapitalSourceRows: draftCapital.length,
      collegeProductionSourceRows: collegeProduction.length,
      roleNotesSourceRows: roleNotes.length,
      appliedValues,
      conflictCount: conflicts.length,
      unmatchedSourceRows: unmatched.length,
      ambiguousSourceRows: ambiguous.length,
      skippedByPriorityOnly,
    },
    populatedFields,
    dataGaps,
    conflicts,
    unmatched,
    ambiguous,
    safety: {
      noScraping: true,
      noPaidApi: true,
      noAi: true,
      noAdpFallback: true,
      noBlankOverwrite: true,
      noFabricatedFields: true,
    },
    verdict,
  };
}

function identityFor(sourceRecord: SourceRecord) {
  const row = sourceRecord.row;
  return {
    playerId: row.playerId,
    playerName: row.playerName,
    position: row.position,
    team: "team" in row ? row.team : null,
  };
}

function mergeResult(sourceRecord: SourceRecord, matchStatus: SourceMatchStatus, unresolvedReason: string | null): SourceMergeResult {
  const row = sourceRecord.row;
  return {
    sourceType: sourceRecord.sourceType,
    rowNumber: row.rowNumber,
    playerId: row.playerId,
    playerName: row.playerName,
    position: row.position,
    matchStatus,
    unresolvedReason,
  };
}

function draftCapitalValues(row: DraftCapitalRecord): Record<string, unknown> {
  return {
    nflDraftRound: row.nflDraftRound,
    nflDraftPick: row.nflDraftPick,
    nflDraftOverall: row.nflDraftOverall,
    nflDraftTeam: row.nflDraftTeam,
  };
}

function collegeProductionValues(row: CollegeProductionRecord): Record<string, unknown> {
  return {
    college: row.college,
    collegeConference: row.collegeConference,
    ...row.stats,
  };
}

function roleNotesValues(row: RoleNotesRecord): Record<string, unknown> {
  return {
    landingSpotRole: row.landingSpotRole === "unknown" ? null : row.landingSpotRole,
    opportunityNotes: row.opportunityNotes,
  };
}

function shouldApply(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim() !== "";
}

function appendSourceLabel(row: Record<string, string>, value: SourceAttribution) {
  row.source = appendUnique(row.source, value.source);
  row.sourceLabel = appendUnique(row.sourceLabel, value.sourceLabel);
}

function appendUnique(existing: string | undefined, next: string): string {
  return Array.from(new Set([...(existing ?? "").split("|"), next].map((value) => value.trim()).filter(Boolean))).join("|");
}

function readPriorityPlayerIds(filePath: string): Set<string> {
  if (!existsSync(filePath)) return new Set();
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(filePath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`Priority CSV parse failed: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return new Set(parsed.data.map((row) => String(row.playerId ?? "").trim()).filter(Boolean));
}
