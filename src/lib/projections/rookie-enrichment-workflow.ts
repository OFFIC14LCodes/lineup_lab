import type { LoadedRookieDataRow, RookieDataLoadResult } from "@/lib/projections/rookie-data-loader";
import type { NormalizedRookieProfile } from "@/lib/projections/rookie-data-sources";

export type PriorityTier = "critical" | "high" | "medium" | "low";

export type RookieEnrichmentPriorityRow = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  priorityTier: PriorityTier;
  priorityScore: number;
  reasons: string[];
  missingFields: string[];
  currentProjectionTrust: string;
  currentBlackbirdRank: number | null;
  currentDraftSuggestionRank: number | null;
};

export type BuildRookieEnrichmentPriorityInput = {
  rookieRows: LoadedRookieDataRow[];
  blackbirdRanksByPlayerId?: Map<string, number>;
  draftSuggestionRanksByPlayerId?: Map<string, number>;
  projectionTrustByPlayerId?: Map<string, string>;
  realRoomPlayerIds?: Set<string>;
  scarcePositions?: Set<string>;
};

export const ROOKIE_ENRICHMENT_INPUT_COLUMNS = [
  "playerId",
  "playerName",
  "position",
  "team",
  "season",
  "source",
  "sourceLabel",
  "nflDraftRound",
  "nflDraftPick",
  "nflDraftOverall",
  "nflDraftTeam",
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
] as const;

export const ROOKIE_ENRICHMENT_TEMPLATE_COLUMNS = [...ROOKIE_ENRICHMENT_INPUT_COLUMNS] as const;
export const ROOKIE_ENRICHMENT_PRIORITY_COLUMNS = [
  "priorityTier",
  "priorityScore",
  "priorityReasons",
  ...ROOKIE_ENRICHMENT_INPUT_COLUMNS,
] as const;

const FANTASY_RELEVANCE: Record<string, number> = {
  QB: 14,
  RB: 18,
  WR: 17,
  TE: 15,
  DL: 13,
  LB: 16,
  DB: 14,
  K: 5,
  DEF: 4,
};

export function buildRookieEnrichmentTemplateRows(loadResult: RookieDataLoadResult): Array<Record<string, string>> {
  return loadResult.rows.map((row) => {
    const profile = row.profile;
    return Object.fromEntries(ROOKIE_ENRICHMENT_TEMPLATE_COLUMNS.map((column) => [column, templateValue(column, row, profile)]));
  });
}

export function buildRookieEnrichmentPriorityRows(input: BuildRookieEnrichmentPriorityInput): RookieEnrichmentPriorityRow[] {
  return input.rookieRows
    .map((row) => {
      const profile = row.profile;
      const playerId = row.matchedPlayerId ?? profile.playerId;
      const position = profile.position.toUpperCase();
      const missingFields = missingFieldsFor(profile);
      const reasons: string[] = [];
      let score = FANTASY_RELEVANCE[position] ?? 6;
      if (input.realRoomPlayerIds?.has(playerId)) {
        score += 35;
        reasons.push("Appears in the requested real draft room player universe.");
      }
      const blackbirdRank = input.blackbirdRanksByPlayerId?.get(playerId) ?? null;
      if (blackbirdRank !== null) {
        score += blackbirdRank <= 50 ? 20 : blackbirdRank <= 150 ? 14 : blackbirdRank <= 300 ? 8 : 3;
        reasons.push(`Appears in Blackbird league rank at #${blackbirdRank}.`);
      }
      const draftSuggestionRank = input.draftSuggestionRanksByPlayerId?.get(playerId) ?? null;
      if (draftSuggestionRank !== null) {
        score += draftSuggestionRank <= 25 ? 18 : draftSuggestionRank <= 75 ? 12 : 6;
        reasons.push(`Appears in live Draft Suggestions at #${draftSuggestionRank}.`);
      }
      if (input.scarcePositions?.has(position)) {
        score += 8;
        reasons.push(`${position} is scarce or format-sensitive in the active league context.`);
      }
      if (profile.rookieProjectionConfidence === "very_low") {
        score += 12;
        reasons.push("Current rookie projection trust is very low because key rookie inputs are missing.");
      } else if (profile.rookieProjectionConfidence === "low") {
        score += 7;
        reasons.push("Current rookie projection trust is low and can improve with verified inputs.");
      }
      score += Math.min(21, missingFields.length * 7);
      if (missingFields.length) reasons.push(`Missing ${missingFields.join(", ")}.`);
      if (!reasons.length) reasons.push("Lower priority because current rookie context is less likely to move rankings.");
      return {
        playerId,
        playerName: profile.playerName,
        position,
        team: profile.team,
        priorityTier: priorityTier(score),
        priorityScore: Math.min(100, Math.round(score * 10) / 10),
        reasons,
        missingFields,
        currentProjectionTrust: input.projectionTrustByPlayerId?.get(playerId) ?? profile.rookieProjectionConfidence,
        currentBlackbirdRank: blackbirdRank,
        currentDraftSuggestionRank: draftSuggestionRank,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || tierOrder(a.priorityTier) - tierOrder(b.priorityTier) || a.position.localeCompare(b.position) || a.playerName.localeCompare(b.playerName));
}

export function buildPriorityExportRows(priorityRows: RookieEnrichmentPriorityRow[], baseRows: LoadedRookieDataRow[], limit = 100): Array<Record<string, string>> {
  const baseByPlayerId = new Map(baseRows.map((row) => [row.matchedPlayerId ?? row.profile.playerId, row]));
  return priorityRows
    .filter((row) => row.priorityTier === "critical" || row.priorityTier === "high")
    .slice(0, limit)
    .map((priority) => {
      const base = baseByPlayerId.get(priority.playerId);
      if (!base) throw new Error(`Missing base row for priority rookie ${priority.playerId}`);
      return Object.fromEntries(ROOKIE_ENRICHMENT_PRIORITY_COLUMNS.map((column) => {
        if (column === "priorityTier") return [column, priority.priorityTier];
        if (column === "priorityScore") return [column, String(priority.priorityScore)];
        if (column === "priorityReasons") return [column, priority.reasons.join(" | ")];
        return [column, templateValue(column, base, base.profile)];
      }));
    });
}

export function serializeCsv(rows: Array<Record<string, unknown>>, columns: readonly string[]): string {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n") + "\n";
}

export function coverageSummary(loadResult: RookieDataLoadResult) {
  const profiles = loadResult.rows.map((row) => row.profile);
  return {
    totalRookies: profiles.length,
    enrichmentRows: loadResult.enrichmentRows,
    rowsWithDraftCapital: profiles.filter((profile) => profile.draftCapitalScore !== null).length,
    rowsWithCollegeProduction: profiles.filter((profile) => profile.collegeProductionScore !== null).length,
    rowsWithLandingSpotRole: profiles.filter((profile) => profile.landingSpotRole !== "unknown").length,
    coverageByPosition: Object.fromEntries(
      Array.from(new Set(profiles.map((profile) => profile.position))).sort().map((position) => {
        const rows = profiles.filter((profile) => profile.position === position);
        return [position, {
          total: rows.length,
          withDraftCapital: rows.filter((profile) => profile.draftCapitalScore !== null).length,
          withCollegeProduction: rows.filter((profile) => profile.collegeProductionScore !== null).length,
          withLandingSpotRole: rows.filter((profile) => profile.landingSpotRole !== "unknown").length,
        }];
      })
    ),
  };
}

export function missingFieldsFor(profile: NormalizedRookieProfile): string[] {
  return [
    profile.draftCapitalScore === null ? "nflDraftRound/nflDraftOverall" : null,
    profile.collegeProductionScore === null ? "college production" : null,
    profile.landingSpotRole === "unknown" ? "landingSpotRole" : null,
  ].filter((field): field is string => Boolean(field));
}

function templateValue(column: string, row: LoadedRookieDataRow, profile: NormalizedRookieProfile): string {
  if (column === "playerId") return row.matchedPlayerId ?? profile.playerId;
  if (column === "playerName") return profile.playerName;
  if (column === "position") return profile.position;
  if (column === "team") return profile.team ?? "";
  if (column === "season") return String(profile.season);
  if (column === "source") return "manual";
  if (column === "sourceLabel") return "rookie-enrichment";
  const value = (row.input as Record<string, unknown>)[column];
  if (column === "nflDraftTeam" && !value) return profile.team ?? "";
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join("|");
  return String(value);
}

function priorityTier(score: number): PriorityTier {
  if (score >= 72) return "critical";
  if (score >= 52) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function tierOrder(tier: PriorityTier): number {
  return tier === "critical" ? 0 : tier === "high" ? 1 : tier === "medium" ? 2 : 3;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
