import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

import { normalizePlayerName, normalizePrimaryPosition, normalizeTeam } from "@/lib/players/normalize";
import { normalizeRookieProfile, type NormalizedRookieProfile, type RookieDataInput, type RookieDataSource } from "@/lib/projections/rookie-data-sources";

export type RookiePlayerMatchCandidate = {
  id: string;
  full_name: string | null;
  position: string | null;
  team?: string | null;
};

export type RookieMatchStatus =
  | "matched_id"
  | "matched_name_position_team"
  | "matched_name_position"
  | "matched_name_only"
  | "duplicate_candidate"
  | "ambiguous"
  | "unmatched";

export type LoadedRookieDataRow = {
  input: RookieDataInput;
  profile: NormalizedRookieProfile;
  matchedPlayerId: string | null;
  matchStatus: RookieMatchStatus;
  unresolvedReason: string | null;
  errors: string[];
};

export type RookieEnrichmentConflict = {
  row: number;
  playerId: string | null;
  playerName: string | null;
  field: string;
  baseValue: string;
  enrichmentValue: string;
  sourceLabel: string | null;
};

export type RookieEnrichmentRowResult = {
  row: number;
  matchedBaseIndex: number | null;
  matchStatus: "matched_player_id" | "matched_name_position_team" | "matched_name_position" | "ambiguous" | "unmatched" | "invalid";
  unresolvedReason: string | null;
  errors: string[];
};

export type RookieDataLoadResult = {
  sourcePath: string | null;
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  matchedRows: number;
  unmatchedRows: number;
  duplicateCandidateMatches: number;
  ambiguousMatches: number;
  exactIdMatches: number;
  namePositionTeamMatches: number;
  namePositionMatches: number;
  nameOnlyUniqueMatches: number;
  enrichmentSourcePath: string | null;
  enrichmentRows: number;
  validEnrichmentRows: number;
  invalidEnrichmentRows: number;
  matchedEnrichmentRows: number;
  unmatchedEnrichmentRows: number;
  ambiguousEnrichmentRows: number;
  conflictCount: number;
  conflicts: RookieEnrichmentConflict[];
  enrichmentResults: RookieEnrichmentRowResult[];
  profilesByPlayerId: Map<string, NormalizedRookieProfile>;
  rows: LoadedRookieDataRow[];
  errors: string[];
};

const DEFAULT_CSV = path.join(process.cwd(), "data", "rookies", "rookie-data.csv");
const DEFAULT_JSON = path.join(process.cwd(), "data", "rookies", "rookie-data.json");
const ENRICHMENT_CSV = path.join(process.cwd(), "data", "rookies", "rookie-enrichment.csv");
const ENRICHMENT_JSON = path.join(process.cwd(), "data", "rookies", "rookie-enrichment.json");
const EXAMPLE_CSV = path.join(process.cwd(), "data", "rookies", "rookie-data.example.csv");

export function loadRookieData(input: {
  filePath?: string | null;
  candidates?: RookiePlayerMatchCandidate[];
  dryRun?: boolean;
  useExampleWhenMissing?: boolean;
  enrichmentPath?: string | null;
  useEnrichment?: boolean;
} = {}): RookieDataLoadResult {
  const sourcePath = resolveSourcePath(input.filePath, input.useExampleWhenMissing ?? true);
  if (!sourcePath) {
    return emptyResult(input.dryRun ?? true, ["No rookie data file found."]);
  }
  const candidates = input.candidates ?? [];
  const rawRows = sourcePath.endsWith(".json") ? readJsonRows(sourcePath) : readCsvRows(sourcePath);
  const baseInputs = rawRows.map((raw) => ({ input: normalizeInput(raw, sourcePath, "base"), errors: validateInput(normalizeInput(raw, sourcePath, "base")) }));
  const enrichmentSourcePath = input.useEnrichment === false ? null : resolveEnrichmentPath(input.enrichmentPath);
  const enrichment = enrichmentSourcePath ? mergeEnrichment(baseInputs.map((row) => row.input), enrichmentSourcePath) : emptyEnrichment();
  const rows = baseInputs.map((row, index) => buildLoadedRow(row.input, row.errors, sourcePath, candidates, enrichment.mergedSourceLabels.get(index)));
  const validRows = rows.filter((row) => !row.errors.length);
  return {
    sourcePath,
    dryRun: input.dryRun ?? true,
    totalRows: rows.length,
    validRows: validRows.length,
    invalidRows: rows.length - validRows.length,
    matchedRows: validRows.filter((row) => row.matchedPlayerId !== null).length,
    unmatchedRows: validRows.filter((row) => row.matchedPlayerId === null).length,
    duplicateCandidateMatches: validRows.filter((row) => row.matchStatus === "duplicate_candidate").length,
    ambiguousMatches: validRows.filter((row) => row.matchStatus === "ambiguous").length,
    exactIdMatches: validRows.filter((row) => row.matchStatus === "matched_id").length,
    namePositionTeamMatches: validRows.filter((row) => row.matchStatus === "matched_name_position_team").length,
    namePositionMatches: validRows.filter((row) => row.matchStatus === "matched_name_position").length,
    nameOnlyUniqueMatches: validRows.filter((row) => row.matchStatus === "matched_name_only").length,
    enrichmentSourcePath,
    enrichmentRows: enrichment.totalRows,
    validEnrichmentRows: enrichment.validRows,
    invalidEnrichmentRows: enrichment.invalidRows,
    matchedEnrichmentRows: enrichment.results.filter((row) => row.matchedBaseIndex !== null).length,
    unmatchedEnrichmentRows: enrichment.results.filter((row) => row.matchStatus === "unmatched").length,
    ambiguousEnrichmentRows: enrichment.results.filter((row) => row.matchStatus === "ambiguous").length,
    conflictCount: enrichment.conflicts.length,
    conflicts: enrichment.conflicts,
    enrichmentResults: enrichment.results,
    profilesByPlayerId: new Map(validRows.filter((row) => row.matchedPlayerId !== null || row.matchStatus === "unmatched").map((row) => [row.matchedPlayerId ?? row.profile.playerId, row.profile])),
    rows,
    errors: rows.flatMap((row) => row.errors),
  };
}

export function rookieProfileForPlayer(
  profiles: Map<string, NormalizedRookieProfile>,
  player: { id?: string | null; full_name?: string | null; position?: string | null },
  season: number
): NormalizedRookieProfile | null {
  if (player.id && profiles.has(player.id)) return profiles.get(player.id) ?? null;
  const position = normalizePrimaryPosition(player.position) ?? (player.position ?? "UNK").toUpperCase();
  const key = `rookie:${normalizePlayerName(player.full_name ?? "")}:${position}:${season}`;
  return profiles.get(key) ?? null;
}

function buildLoadedRow(input: RookieDataInput, errors: string[], sourcePath: string, candidates: RookiePlayerMatchCandidate[], enrichmentSourceLabels: string[] | undefined): LoadedRookieDataRow {
  const match = errors.length ? { playerId: null, status: "unmatched" as const, reason: errors.join("; ") } : matchRookie(input, candidates);
  const sourceLabel = [input.sourceLabel, ...(enrichmentSourceLabels ?? [])].filter((value): value is string => Boolean(value)).join(" + ") || input.sourceLabel;
  const profile = normalizeRookieProfile({ ...input, playerId: match.playerId ?? input.playerId ?? undefined, sourceLabel });
  return { input, profile, matchedPlayerId: match.playerId, matchStatus: match.status, unresolvedReason: match.reason, errors };
}

function normalizeInput(raw: Record<string, unknown>, sourcePath: string, kind: "base" | "enrichment"): RookieDataInput {
  const source = (stringValue(raw.source) as RookieDataSource | null) ?? (sourcePath.endsWith(".csv") ? "csv_import" : "manual");
  return {
    playerId: stringValue(raw.playerId),
    playerName: stringValue(raw.playerName) ?? "",
    position: normalizePrimaryPosition(stringValue(raw.position)) ?? stringValue(raw.position)?.toUpperCase() ?? "",
    team: normalizeTeam(stringValue(raw.team)),
    season: numberValue(raw.season) ?? new Date().getFullYear(),
    rookieYear: numberValue(raw.rookieYear),
    age: numberValue(raw.age),
    yearsExperience: numberValue(raw.yearsExperience),
    nflDraftRound: numberValue(raw.nflDraftRound),
    nflDraftPick: numberValue(raw.nflDraftPick),
    nflDraftOverall: numberValue(raw.nflDraftOverall),
    nflDraftTeam: normalizeTeam(stringValue(raw.nflDraftTeam)),
    draftCapitalScore: numberValue(raw.draftCapitalScore),
    college: stringValue(raw.college),
    collegeConference: stringValue(raw.collegeConference),
    collegeGames: numberValue(raw.collegeGames),
    collegePassingAttempts: numberValue(raw.collegePassingAttempts),
    collegeCompletions: numberValue(raw.collegeCompletions),
    collegePassingYards: numberValue(raw.collegePassingYards),
    collegePassingTouchdowns: numberValue(raw.collegePassingTouchdowns),
    collegeInterceptions: numberValue(raw.collegeInterceptions),
    collegeRushingAttempts: numberValue(raw.collegeRushingAttempts),
    collegeRushingYards: numberValue(raw.collegeRushingYards),
    collegeRushingTouchdowns: numberValue(raw.collegeRushingTouchdowns),
    collegeTargets: numberValue(raw.collegeTargets),
    collegeReceptions: numberValue(raw.collegeReceptions),
    collegeReceivingYards: numberValue(raw.collegeReceivingYards),
    collegeReceivingTouchdowns: numberValue(raw.collegeReceivingTouchdowns),
    collegeSoloTackles: numberValue(raw.collegeSoloTackles),
    collegeAssistedTackles: numberValue(raw.collegeAssistedTackles),
    collegeTotalTackles: numberValue(raw.collegeTotalTackles),
    collegeTacklesForLoss: numberValue(raw.collegeTacklesForLoss),
    collegeSacks: numberValue(raw.collegeSacks),
    collegeInterceptionsDef: numberValue(raw.collegeInterceptionsDef),
    collegePassesDefended: numberValue(raw.collegePassesDefended),
    collegeForcedFumbles: numberValue(raw.collegeForcedFumbles),
    collegeFumbleRecoveries: numberValue(raw.collegeFumbleRecoveries),
    landingSpotRole: landingSpotRoleValue(raw.landingSpotRole),
    opportunityNotes: splitList(raw.opportunityNotes),
    source,
    sourceLabel: stringValue(raw.sourceLabel) ?? (kind === "enrichment" ? `enrichment:${path.basename(sourcePath)}` : path.basename(sourcePath)),
    importedAt: stringValue(raw.importedAt),
    dataGaps: splitList(raw.dataGaps),
  };
}

function validateInput(input: RookieDataInput): string[] {
  return [
    input.playerName.trim() ? null : "playerName is required",
    input.position.trim() ? null : "position is required",
    Number.isFinite(input.season) ? null : "season is required",
    ["manual", "csv_import", "provider", "derived", "unknown"].includes(input.source) ? null : `unsupported source ${input.source}`,
  ].filter((error): error is string => Boolean(error));
}

function matchRookie(input: RookieDataInput, candidates: RookiePlayerMatchCandidate[]) {
  if (!candidates.length) return { playerId: null, status: "unmatched" as const, reason: "no canonical player candidates provided" };
  if (input.playerId) {
    const exact = candidates.filter((candidate) => candidate.id === input.playerId);
    if (exact.length === 1) return { playerId: input.playerId, status: "matched_id" as const, reason: null };
    if (exact.length > 1) return { playerId: null, status: "duplicate_candidate" as const, reason: `duplicate candidate id ${input.playerId}` };
  }
  const name = normalizePlayerName(input.playerName);
  const position = normalizePrimaryPosition(input.position) ?? input.position.toUpperCase();
  const team = normalizeTeam(input.team ?? input.nflDraftTeam ?? null);
  const byName = candidates.filter((row) => normalizePlayerName(row.full_name ?? "") === name);
  if (!byName.length) return { playerId: null, status: "unmatched" as const, reason: "no canonical player with matching normalized name" };

  const byPosition = byName.filter((row) => (normalizePrimaryPosition(row.position) ?? row.position?.toUpperCase()) === position);
  if (team) {
    const byTeam = byPosition.filter((row) => normalizeTeam(row.team ?? null) === team);
    const result = uniqueCandidate(byTeam, "matched_name_position_team");
    if (result) return result;
  }

  const positionResult = uniqueCandidate(byPosition, "matched_name_position");
  if (positionResult) return positionResult;

  const nameOnlyResult = uniqueCandidate(byName, "matched_name_only");
  if (nameOnlyResult) return nameOnlyResult;

  const reason = byPosition.length > 1
    ? `ambiguous normalized name+position match: ${byPosition.map((row) => row.id).join(", ")}`
    : byName.length > 1
      ? `ambiguous normalized name-only match: ${byName.map((row) => row.id).join(", ")}`
      : "canonical candidate exists but position/team did not match";
  return { playerId: null, status: "ambiguous" as const, reason };
}

function uniqueCandidate(candidates: RookiePlayerMatchCandidate[], status: Exclude<RookieMatchStatus, "matched_id" | "duplicate_candidate" | "ambiguous" | "unmatched">) {
  const uniqueIds = Array.from(new Set(candidates.map((row) => row.id)));
  if (uniqueIds.length === 1) return { playerId: uniqueIds[0], status, reason: null };
  if (uniqueIds.length > 1) return null;
  return null;
}

function resolveSourcePath(filePath: string | null | undefined, useExample: boolean): string | null {
  const candidates = [filePath, DEFAULT_CSV, DEFAULT_JSON, useExample ? EXAMPLE_CSV : null].filter((value): value is string => Boolean(value));
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function resolveEnrichmentPath(filePath: string | null | undefined): string | null {
  const candidates = [filePath, ENRICHMENT_CSV, ENRICHMENT_JSON].filter((value): value is string => Boolean(value));
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function mergeEnrichment(baseInputs: RookieDataInput[], sourcePath: string) {
  const rawRows = sourcePath.endsWith(".json") ? readJsonRows(sourcePath) : readCsvRows(sourcePath);
  const conflicts: RookieEnrichmentConflict[] = [];
  const results: RookieEnrichmentRowResult[] = [];
  const mergedSourceLabels = new Map<number, string[]>();
  let validRows = 0;
  let invalidRows = 0;

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2;
    const overlay = normalizeInput(raw, sourcePath, "enrichment");
    const errors = validateEnrichmentInput(overlay);
    if (errors.length) {
      invalidRows += 1;
      results.push({ row: rowNumber, matchedBaseIndex: null, matchStatus: "invalid", unresolvedReason: errors.join("; "), errors });
      return;
    }
    validRows += 1;
    const match = matchEnrichmentToBase(overlay, baseInputs);
    if (match.index === null) {
      results.push({ row: rowNumber, matchedBaseIndex: null, matchStatus: match.status, unresolvedReason: match.reason, errors: [] });
      return;
    }
    const base = baseInputs[match.index];
    for (const field of ENRICHABLE_FIELDS) {
      const value = overlay[field];
      if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) continue;
      const existing = base[field];
      if (existing !== null && existing !== undefined && existing !== "" && String(existing) !== String(value)) {
        conflicts.push({
          row: rowNumber,
          playerId: overlay.playerId ?? base.playerId ?? null,
          playerName: overlay.playerName || base.playerName || null,
          field,
          baseValue: String(existing),
          enrichmentValue: Array.isArray(value) ? value.join("|") : String(value),
          sourceLabel: overlay.sourceLabel ?? null,
        });
        continue;
      }
      (base as Record<string, unknown>)[field] = value;
    }
    const labels = mergedSourceLabels.get(match.index) ?? [];
    if (overlay.sourceLabel) labels.push(overlay.sourceLabel);
    mergedSourceLabels.set(match.index, Array.from(new Set(labels)).sort());
    results.push({ row: rowNumber, matchedBaseIndex: match.index, matchStatus: match.status, unresolvedReason: null, errors: [] });
  });

  return { totalRows: rawRows.length, validRows, invalidRows, conflicts, results, mergedSourceLabels };
}

const ENRICHABLE_FIELDS: Array<keyof RookieDataInput> = [
  "team",
  "rookieYear",
  "age",
  "yearsExperience",
  "nflDraftRound",
  "nflDraftPick",
  "nflDraftOverall",
  "nflDraftTeam",
  "draftCapitalScore",
  "college",
  "collegeConference",
  "collegeGames",
  "collegePassingAttempts",
  "collegeCompletions",
  "collegePassingYards",
  "collegePassingTouchdowns",
  "collegeInterceptions",
  "collegeRushingAttempts",
  "collegeRushingYards",
  "collegeRushingTouchdowns",
  "collegeTargets",
  "collegeReceptions",
  "collegeReceivingYards",
  "collegeReceivingTouchdowns",
  "collegeSoloTackles",
  "collegeAssistedTackles",
  "collegeTotalTackles",
  "collegeTacklesForLoss",
  "collegeSacks",
  "collegeInterceptionsDef",
  "collegePassesDefended",
  "collegeForcedFumbles",
  "collegeFumbleRecoveries",
  "landingSpotRole",
  "opportunityNotes",
  "dataGaps",
];

function validateEnrichmentInput(input: RookieDataInput): string[] {
  return [
    input.playerId || input.playerName.trim() ? null : "playerId or playerName is required",
    input.playerId || input.position.trim() ? null : "position is required when playerId is absent",
    Number.isFinite(input.season) ? null : "season is required",
    ["manual", "csv_import", "provider", "derived", "unknown"].includes(input.source) ? null : `unsupported source ${input.source}`,
  ].filter((error): error is string => Boolean(error));
}

function matchEnrichmentToBase(input: RookieDataInput, baseRows: RookieDataInput[]): { index: number | null; status: RookieEnrichmentRowResult["matchStatus"]; reason: string | null } {
  if (input.playerId) {
    const matches = baseRows.map((row, index) => ({ row, index })).filter(({ row }) => row.playerId === input.playerId);
    if (matches.length === 1) return { index: matches[0].index, status: "matched_player_id", reason: null };
    if (matches.length > 1) return { index: null, status: "ambiguous", reason: `ambiguous playerId ${input.playerId}` };
  }
  const name = normalizePlayerName(input.playerName);
  const position = normalizePrimaryPosition(input.position) ?? input.position.toUpperCase();
  const team = normalizeTeam(input.team ?? input.nflDraftTeam ?? null);
  const nameRows = baseRows.map((row, index) => ({ row, index })).filter(({ row }) => normalizePlayerName(row.playerName) === name);
  const positionRows = nameRows.filter(({ row }) => (normalizePrimaryPosition(row.position) ?? row.position.toUpperCase()) === position);
  if (team) {
    const teamRows = positionRows.filter(({ row }) => normalizeTeam(row.team ?? row.nflDraftTeam ?? null) === team);
    if (teamRows.length === 1) return { index: teamRows[0].index, status: "matched_name_position_team", reason: null };
    if (teamRows.length > 1) return { index: null, status: "ambiguous", reason: `ambiguous name+position+team match for ${input.playerName}` };
  }
  if (positionRows.length === 1) return { index: positionRows[0].index, status: "matched_name_position", reason: null };
  if (positionRows.length > 1) return { index: null, status: "ambiguous", reason: `ambiguous name+position match for ${input.playerName}` };
  return { index: null, status: "unmatched", reason: "no base rookie row matched enrichment identity" };
}

function emptyEnrichment() {
  return { totalRows: 0, validRows: 0, invalidRows: 0, conflicts: [] as RookieEnrichmentConflict[], results: [] as RookieEnrichmentRowResult[], mergedSourceLabels: new Map<number, string[]>() };
}

function readCsvRows(filePath: string): Array<Record<string, unknown>> {
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(filePath, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`Rookie CSV parse failed: ${parsed.errors.map((error) => error.message).join("; ")}`);
  return parsed.data;
}

function readJsonRows(filePath: string): Array<Record<string, unknown>> {
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("Rookie JSON input must be an array.");
  return parsed as Array<Record<string, unknown>>;
}

function emptyResult(dryRun: boolean, errors: string[]): RookieDataLoadResult {
  return {
    sourcePath: null,
    dryRun,
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    matchedRows: 0,
    unmatchedRows: 0,
    duplicateCandidateMatches: 0,
    ambiguousMatches: 0,
    exactIdMatches: 0,
    namePositionTeamMatches: 0,
    namePositionMatches: 0,
    nameOnlyUniqueMatches: 0,
    enrichmentSourcePath: null,
    enrichmentRows: 0,
    validEnrichmentRows: 0,
    invalidEnrichmentRows: 0,
    matchedEnrichmentRows: 0,
    unmatchedEnrichmentRows: 0,
    ambiguousEnrichmentRows: 0,
    conflictCount: 0,
    conflicts: [],
    enrichmentResults: [],
    profilesByPlayerId: new Map(),
    rows: [],
    errors,
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function splitList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  if (typeof value !== "string" || !value.trim()) return [];
  return value.split(/[|;]/g).map((item) => item.trim()).filter(Boolean);
}

function landingSpotRoleValue(value: unknown): RookieDataInput["landingSpotRole"] {
  const normalized = stringValue(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (["clear_starter", "probable_starter", "committee", "rotational", "backup", "unknown"].includes(normalized)) return normalized as NonNullable<RookieDataInput["landingSpotRole"]>;
  return "unknown";
}
