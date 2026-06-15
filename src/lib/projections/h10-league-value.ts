import { buildNormalizedRosterRequirements, type NormalizedRosterRequirements } from "@/lib/draft/roster-slots";
import type { CombinedProjectionRow, LeagueReadRow, MarketComparisonStatus, ProjectionReadiness } from "@/lib/projections/combined-projection-read-model";

export type H10ScarcityLabel = "low" | "medium" | "high" | "extreme";
export type H10RiskLabel = "low" | "medium" | "high" | "extreme";
export type H10MarketValueSignal = "above_market" | "below_market" | "aligned" | "no_compatible_market" | "not_implemented";
export type H10DraftRelevance = "draft_relevant" | "format_excluded" | "diagnostic_only";
export type H10ValueReadiness = "READY" | "LOW_CONFIDENCE_BASELINE" | "SCORING_PARTIAL_ALLOWANCE_ONLY" | "NO_COMPATIBLE_MARKET" | "MARKET_NOT_IMPLEMENTED";

export type H10LeagueValueRow = {
  leagueId: string;
  leagueName: string;
  entityId: string;
  entityType: "PLAYER" | "TEAM_DEFENSE";
  displayName: string;
  team: string | null;
  position: string;
  positionGroup: string;
  projectedPositionRank: number | null;
  medianPoints: number;
  floorPoints: number;
  ceilingPoints: number;
  downsidePoints: number;
  upsidePoints: number;
  replacementRank: number;
  replacementLevelPoints: number;
  pointsAboveReplacement: number;
  starterCutlineRank: number;
  starterCutlinePoints: number;
  pointsAboveStarterCutline: number;
  positionScarcityScore: number;
  scarcityLabel: H10ScarcityLabel;
  tier: number;
  tierLabel: string;
  tierSize: number;
  tierGapAbove: number | null;
  tierGapBelow: number | null;
  pointsToNextTier: number | null;
  pointsAboveNextTier: number | null;
  confidenceAdjustedValue: number;
  riskAdjustedValue: number;
  riskLabel: H10RiskLabel;
  marketRankDelta: number | null;
  marketValueSignal: H10MarketValueSignal;
  draftRelevance: H10DraftRelevance;
  valueReadiness: H10ValueReadiness;
  reasonCodes: string[];
  warningCodes: string[];
};

export type H10PositionLevel = {
  position: string;
  availableRows: number;
  hardStarterDemand: number;
  allocatedFlexDemand: number;
  benchDepthShare: number;
  replacementRank: number;
  replacementLevelPoints: number;
};

export type H10StarterCutline = {
  position: string;
  starterCutlineRank: number;
  starterCutlinePoints: number;
};

export type H10FlexAllocationSummary = {
  offensiveFlexAllocatedByPosition: Record<string, number>;
  superflexAllocatedByPosition: Record<string, number>;
  idpFlexAllocatedByPosition: Record<string, number>;
  selectedEntityIds: string[];
  selectedPositions: string[];
};

export type H10TierSummary = {
  position: string;
  tierNumber: number;
  tierLabel: string;
  tierSize: number;
  playerIds: string[];
  tierGapAbove: number | null;
  tierGapBelow: number | null;
};

export type H10LeagueValueDiagnostics = {
  leagueId: string;
  leagueName: string;
  replacementLevelsByPosition: Record<string, H10PositionLevel>;
  starterCutlinesByPosition: Record<string, H10StarterCutline>;
  flexAllocationSummary: H10FlexAllocationSummary;
  scarcityByPosition: Record<string, { score: number; label: H10ScarcityLabel }>;
  tiersByPosition: Record<string, H10TierSummary[]>;
  readinessWarningCounts: Record<string, number>;
  invariantFailures: string[];
};

export type H10LeagueValueModel = {
  rows: H10LeagueValueRow[];
  diagnosticsByLeague: Record<string, H10LeagueValueDiagnostics>;
  invariantFailures: string[];
};

const POSITIONS = ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "K", "DST"] as const;
const OFFENSIVE_FLEX = new Set(["RB", "WR", "TE"]);
const SUPERFLEX = new Set(["QB", "RB", "WR", "TE"]);
const IDP_FLEX = new Set(["DL", "LB", "DB"]);
const TIER_THRESHOLDS: Record<string, number> = { QB: 14, RB: 10, WR: 10, TE: 8, DL: 7, LB: 7, DB: 7, K: 5, DST: 5 };
const CONFIDENCE_FACTOR: Record<string, number> = { high: 1, medium: 0.94, low: 0.84, very_low: 0.68 };
const READINESS_FACTOR: Record<ProjectionReadiness, number> = {
  READY: 1,
  LOW_CONFIDENCE_BASELINE: 0.82,
  SCORING_PARTIAL_ALLOWANCE_ONLY: 0.55,
};

export function buildH10LeagueValueModel(input: { rows: CombinedProjectionRow[]; leagues: LeagueReadRow[] }): H10LeagueValueModel {
  const leaguesById = new Map(input.leagues.map((league) => [league.id, league]));
  const rowsByLeague = groupBy(input.rows, (row) => row.leagueId);
  const valueRows: H10LeagueValueRow[] = [];
  const diagnosticsByLeague: Record<string, H10LeagueValueDiagnostics> = {};

  for (const [leagueId, leagueRows] of rowsByLeague) {
    const league = leaguesById.get(leagueId) ?? fallbackLeague(leagueId, leagueRows[0]?.leagueName);
    const diagnostics = valueLeague(league, leagueRows);
    diagnosticsByLeague[leagueId] = diagnostics.diagnostics;
    valueRows.push(...diagnostics.rows);
  }

  const invariantFailures = [
    ...Object.values(diagnosticsByLeague).flatMap((diagnostics) => diagnostics.invariantFailures),
    ...validateForbiddenFields(valueRows),
  ];

  return { rows: valueRows, diagnosticsByLeague, invariantFailures };
}

function valueLeague(league: LeagueReadRow, rows: CombinedProjectionRow[]): { rows: H10LeagueValueRow[]; diagnostics: H10LeagueValueDiagnostics } {
  const requirements = buildNormalizedRosterRequirements(rosterPositions(league));
  const rowsByPosition = groupBy(rows, (row) => normalizePosition(row.positionGroup));
  const flexAllocationSummary = allocateFlexDemand(rowsByPosition, requirements);
  const replacementLevelsByPosition: Record<string, H10PositionLevel> = {};
  const starterCutlinesByPosition: Record<string, H10StarterCutline> = {};
  const invariantFailures: string[] = [];
  const baseRows: H10LeagueValueRow[] = [];

  for (const position of POSITIONS) {
    const positionRows = sortProjectionRows(rowsByPosition.get(position) ?? []);
    if (positionRows.length === 0) continue;
    const hardStarterDemand = hardDemand(position, requirements);
    const allocatedFlexDemand = totalFlexDemand(position, flexAllocationSummary);
    const benchDepthShare = benchDepth(position, requirements, league.scoring_settings_json);
    const demand = hardStarterDemand + allocatedFlexDemand;
    const replacementRank = clampInt(Math.ceil(demand + benchDepthShare), 1, positionRows.length);
    const replacementLevelPoints = pointsAtRank(positionRows, replacementRank);
    const starterCutlineRank = demand > 0 ? clampInt(Math.ceil(demand), 1, replacementRank) : 1;
    const starterCutlinePoints = demand > 0 ? pointsAtRank(positionRows, starterCutlineRank) : replacementLevelPoints;
    const draftRelevance = demand > 0 ? "draft_relevant" : "diagnostic_only";

    replacementLevelsByPosition[position] = {
      position,
      availableRows: positionRows.length,
      hardStarterDemand,
      allocatedFlexDemand,
      benchDepthShare: round(benchDepthShare),
      replacementRank,
      replacementLevelPoints: round(replacementLevelPoints),
    };
    starterCutlinesByPosition[position] = {
      position,
      starterCutlineRank,
      starterCutlinePoints: round(starterCutlinePoints),
    };

    for (const row of positionRows) {
      const medianPoints = round(row.medianPoints);
      const roundedReplacementLevelPoints = round(replacementLevelPoints);
      const roundedStarterCutlinePoints = round(starterCutlinePoints);
      const pointsAboveReplacement = medianPoints - roundedReplacementLevelPoints;
      const pointsAboveStarterCutline = medianPoints - roundedStarterCutlinePoints;
      const confidenceAdjustedValue = pointsAboveReplacement * confidenceFactor(row.confidenceLabel) * readinessFactor(row.projectionReadiness);
      const volatilityPenalty = clamp((row.ceilingPoints - row.floorPoints) / Math.max(Math.abs(row.medianPoints), 1), 0, 0.35);
      const riskAdjustedValue = confidenceAdjustedValue * (1 - volatilityPenalty);

      baseRows.push({
        leagueId: row.leagueId,
        leagueName: row.leagueName,
        entityId: row.entityId,
        entityType: row.entityType,
        displayName: row.displayName,
        team: row.team,
        position: row.position,
        positionGroup: position,
        projectedPositionRank: row.projectedPositionRank,
        medianPoints,
        floorPoints: round(row.floorPoints),
        ceilingPoints: round(row.ceilingPoints),
        downsidePoints: round(row.downsidePoints),
        upsidePoints: round(row.upsidePoints),
        replacementRank,
        replacementLevelPoints: roundedReplacementLevelPoints,
        pointsAboveReplacement: round(pointsAboveReplacement),
        starterCutlineRank,
        starterCutlinePoints: roundedStarterCutlinePoints,
        pointsAboveStarterCutline: round(pointsAboveStarterCutline),
        positionScarcityScore: 0,
        scarcityLabel: "low",
        tier: 0,
        tierLabel: "",
        tierSize: 0,
        tierGapAbove: null,
        tierGapBelow: null,
        pointsToNextTier: null,
        pointsAboveNextTier: null,
        confidenceAdjustedValue: round(confidenceAdjustedValue),
        riskAdjustedValue: round(riskAdjustedValue),
        riskLabel: riskLabel(row, volatilityPenalty),
        marketRankDelta: row.marketRankDelta,
        marketValueSignal: marketSignal(row.marketComparisonStatus, row.marketRankDelta),
        draftRelevance,
        valueReadiness: valueReadiness(row),
        reasonCodes: [...row.reasonCodes],
        warningCodes: valueWarnings(row),
      });
    }
  }

  const tieredRows = applyTiers(baseRows, replacementLevelsByPosition, starterCutlinesByPosition);
  const scarcityByPosition = buildScarcityByPosition(tieredRows, replacementLevelsByPosition, starterCutlinesByPosition);
  const finalRows = tieredRows.map((row) => {
    const scarcity = scarcityByPosition[row.positionGroup] ?? { score: 0, label: "low" as const };
    return { ...row, positionScarcityScore: scarcity.score, scarcityLabel: scarcity.label };
  });
  invariantFailures.push(...validateRows(finalRows, replacementLevelsByPosition));

  return {
    rows: finalRows.sort((a, b) => a.leagueId.localeCompare(b.leagueId) || a.positionGroup.localeCompare(b.positionGroup) || b.riskAdjustedValue - a.riskAdjustedValue || a.entityId.localeCompare(b.entityId)),
    diagnostics: {
      leagueId: league.id,
      leagueName: league.name ?? league.id,
      replacementLevelsByPosition,
      starterCutlinesByPosition,
      flexAllocationSummary,
      scarcityByPosition,
      tiersByPosition: summarizeTiers(finalRows),
      readinessWarningCounts: countBy(finalRows.flatMap((row) => [row.valueReadiness, ...row.warningCodes])),
      invariantFailures,
    },
  };
}

export function allocateFlexDemand(rowsByPosition: Map<string, CombinedProjectionRow[]>, requirements: NormalizedRosterRequirements): H10FlexAllocationSummary {
  const summary: H10FlexAllocationSummary = {
    offensiveFlexAllocatedByPosition: {},
    superflexAllocatedByPosition: {},
    idpFlexAllocatedByPosition: {},
    selectedEntityIds: [],
    selectedPositions: [],
  };
  const remaining = new Map<string, CombinedProjectionRow[]>();
  for (const position of POSITIONS) {
    const positionRows = sortProjectionRows(rowsByPosition.get(position) ?? []);
    remaining.set(position, positionRows.slice(hardDemand(position, requirements)));
  }
  allocateSlots(requirements.offensiveFlexCount, OFFENSIVE_FLEX, remaining, summary.offensiveFlexAllocatedByPosition, summary);
  allocateSlots(requirements.superflexCount, SUPERFLEX, remaining, summary.superflexAllocatedByPosition, summary);
  allocateSlots(requirements.idpFlexCount, IDP_FLEX, remaining, summary.idpFlexAllocatedByPosition, summary);
  return summary;
}

function allocateSlots(count: number, eligible: Set<string>, remaining: Map<string, CombinedProjectionRow[]>, counts: Record<string, number>, summary: H10FlexAllocationSummary) {
  for (let index = 0; index < count; index++) {
    const candidate = [...eligible]
      .flatMap((position) => (remaining.get(position) ?? []).slice(0, 1))
      .sort((a, b) => b.medianPoints - a.medianPoints || normalizePosition(a.positionGroup).localeCompare(normalizePosition(b.positionGroup)) || a.entityId.localeCompare(b.entityId))[0];
    if (!candidate) return;
    const position = normalizePosition(candidate.positionGroup);
    counts[position] = (counts[position] ?? 0) + 1;
    summary.selectedEntityIds.push(candidate.entityId);
    summary.selectedPositions.push(position);
    remaining.set(position, (remaining.get(position) ?? []).filter((row) => row.entityId !== candidate.entityId));
  }
}

function applyTiers(rows: H10LeagueValueRow[], replacementLevels: Record<string, H10PositionLevel>, starterCutlines: Record<string, H10StarterCutline>): H10LeagueValueRow[] {
  const output: H10LeagueValueRow[] = [];
  for (const [position, positionRows] of groupBy(rows, (row) => row.positionGroup)) {
    const sorted = [...positionRows].sort((a, b) => b.riskAdjustedValue - a.riskAdjustedValue || b.medianPoints - a.medianPoints || a.entityId.localeCompare(b.entityId));
    let tier = 1;
    const tiers: H10LeagueValueRow[][] = [];
    let current: H10LeagueValueRow[] = [];
    for (let index = 0; index < sorted.length; index++) {
      const row = sorted[index];
      const previous = sorted[index - 1];
      if (previous) {
        const gap = previous.riskAdjustedValue - row.riskAdjustedValue;
        const threshold = adjustedTierThreshold(position, index + 1, starterCutlines[position]?.starterCutlineRank ?? 1, replacementLevels[position]?.replacementRank ?? 1);
        if (gap >= threshold) {
          tiers.push(current);
          current = [];
          tier++;
        }
      }
      current.push({ ...row, tier, tierLabel: tier === 1 ? "Elite" : `Tier ${tier}` });
    }
    if (current.length) tiers.push(current);

    for (let tierIndex = 0; tierIndex < tiers.length; tierIndex++) {
      const tierRows = tiers[tierIndex];
      const previousTier = tiers[tierIndex - 1];
      const nextTier = tiers[tierIndex + 1];
      const tierGapAbove = previousTier ? round(Math.min(...previousTier.map((row) => row.riskAdjustedValue)) - Math.max(...tierRows.map((row) => row.riskAdjustedValue))) : null;
      const tierGapBelow = nextTier ? round(Math.min(...tierRows.map((row) => row.riskAdjustedValue)) - Math.max(...nextTier.map((row) => row.riskAdjustedValue))) : null;
      const nextTierTop = nextTier ? Math.max(...nextTier.map((row) => row.riskAdjustedValue)) : null;
      for (const row of tierRows) {
        output.push({
          ...row,
          tierSize: tierRows.length,
          tierGapAbove,
          tierGapBelow,
          pointsToNextTier: nextTierTop === null ? null : round(row.riskAdjustedValue - nextTierTop),
          pointsAboveNextTier: nextTierTop === null ? null : round(row.riskAdjustedValue - nextTierTop),
        });
      }
    }
  }
  return output;
}

function buildScarcityByPosition(rows: H10LeagueValueRow[], replacementLevels: Record<string, H10PositionLevel>, starterCutlines: Record<string, H10StarterCutline>): Record<string, { score: number; label: H10ScarcityLabel }> {
  const scarcity: Record<string, { score: number; label: H10ScarcityLabel }> = {};
  for (const [position, positionRows] of groupBy(rows, (row) => row.positionGroup)) {
    const level = replacementLevels[position];
    const cutline = starterCutlines[position];
    if (!level || !cutline) continue;
    const topMedian = Math.max(...positionRows.map((row) => row.medianPoints));
    const replacementGap = Math.max(0, topMedian - level.replacementLevelPoints);
    const starterGap = Math.max(0, cutline.starterCutlinePoints - level.replacementLevelPoints);
    const tierCliffBoost = Math.max(0, ...positionRows.map((row) => row.tierGapBelow ?? 0));
    const flexDemandBoost = level.allocatedFlexDemand / Math.max(1, level.hardStarterDemand + level.allocatedFlexDemand);
    const supplyPressure = level.replacementRank / Math.max(1, level.availableRows);
    const confidencePenalty = Math.max(...positionRows.map((row) => row.riskLabel === "extreme" ? 15 : row.riskLabel === "high" ? 8 : 0));
    let score = (normalizeGap(replacementGap, topMedian) * 0.35) + (normalizeGap(starterGap, topMedian) * 0.25) + (normalizeGap(tierCliffBoost, Math.max(...positionRows.map((row) => Math.abs(row.riskAdjustedValue)), 1)) * 0.20) + flexDemandBoost * 15 + supplyPressure * 10 - confidencePenalty;
    if (position === "K" || position === "DST") score = Math.min(score, 49);
    score = round(clamp(score, 0, 100));
    scarcity[position] = { score, label: scarcityLabel(score) };
  }
  return scarcity;
}

function validateRows(rows: H10LeagueValueRow[], levels: Record<string, H10PositionLevel>): string[] {
  const failures: string[] = [];
  for (const row of rows) {
    const level = levels[row.positionGroup];
    if (!level) continue;
    if (row.replacementRank < 1) failures.push(`${row.leagueId}:${row.entityId}: replacementRank < 1`);
    if (row.replacementRank > level.availableRows) failures.push(`${row.leagueId}:${row.entityId}: replacementRank > available rows`);
    if (row.starterCutlineRank > row.replacementRank) failures.push(`${row.leagueId}:${row.entityId}: starterCutlineRank > replacementRank`);
    if (round(row.medianPoints - row.replacementLevelPoints) !== row.pointsAboveReplacement) failures.push(`${row.leagueId}:${row.entityId}: PAR mismatch`);
    if (round(row.medianPoints - row.starterCutlinePoints) !== row.pointsAboveStarterCutline) failures.push(`${row.leagueId}:${row.entityId}: starter cutline mismatch`);
    if ((row.positionGroup === "K" || row.positionGroup === "DST") && row.positionScarcityScore > 49) failures.push(`${row.leagueId}:${row.entityId}: K/DST scarcity cap violated`);
  }
  return failures;
}

function validateForbiddenFields(rows: H10LeagueValueRow[]): string[] {
  const forbidden = ["recommendation", "draftNow", "shouldDraft", "bestPick", "rosterNeed", "pickGrade"];
  const keys = new Set(rows.flatMap((row) => Object.keys(row)));
  return forbidden.filter((key) => keys.has(key)).map((key) => `Forbidden output field emitted: ${key}`);
}

function hardDemand(position: string, requirements: NormalizedRosterRequirements): number {
  if (position === "DST") return requirements.directStarters.DEF;
  return requirements.directStarters[position as keyof NormalizedRosterRequirements["directStarters"]] ?? 0;
}

function totalFlexDemand(position: string, summary: H10FlexAllocationSummary): number {
  return (summary.offensiveFlexAllocatedByPosition[position] ?? 0) + (summary.superflexAllocatedByPosition[position] ?? 0) + (summary.idpFlexAllocatedByPosition[position] ?? 0);
}

function benchDepth(position: string, requirements: NormalizedRosterRequirements, scoring: Record<string, unknown> | null): number {
  const tePremium = Number(scoring?.rec_te_bonus ?? scoring?.bonus_rec_te ?? scoring?.te_premium ?? 0) > 0;
  const qbWeight = requirements.superflexCount > 0 || requirements.directStarters.QB > 1 ? 0.18 : 0.08;
  const weights: Record<string, number> = { QB: qbWeight, RB: 0.28, WR: 0.34, TE: tePremium ? 0.16 : 0.12, DL: 0.07, LB: 0.08, DB: 0.07, K: 0.03, DST: 0.03 };
  return requirements.benchCount * (weights[position] ?? 0.05);
}

function sortProjectionRows<T extends Pick<CombinedProjectionRow, "medianPoints" | "entityId" | "positionGroup">>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.medianPoints - a.medianPoints || normalizePosition(a.positionGroup).localeCompare(normalizePosition(b.positionGroup)) || a.entityId.localeCompare(b.entityId));
}

function pointsAtRank(rows: CombinedProjectionRow[], rank: number): number {
  return rows[Math.max(0, rank - 1)]?.medianPoints ?? 0;
}

function adjustedTierThreshold(position: string, rank: number, starterCutlineRank: number, replacementRank: number): number {
  const base = TIER_THRESHOLDS[position] ?? 8;
  return rank === starterCutlineRank + 1 || rank === replacementRank + 1 ? base * 0.8 : base;
}

function riskLabel(row: CombinedProjectionRow, volatilityPenalty: number): H10RiskLabel {
  if (row.projectionSource === "DST_ALLOWANCE_BASELINE_V1_DRY_RUN" || row.confidenceLabel === "very_low" || row.projectionReadiness === "SCORING_PARTIAL_ALLOWANCE_ONLY") return "extreme";
  if (row.confidenceLabel === "low" || volatilityPenalty >= 0.28) return "high";
  if (row.projectionReadiness === "READY" && ["high", "medium"].includes(row.confidenceLabel) && volatilityPenalty < 0.18) return "low";
  return "medium";
}

function marketSignal(status: MarketComparisonStatus, rankDelta: number | null): H10MarketValueSignal {
  if (status === "NO_COMPATIBLE_MARKET") return "no_compatible_market";
  if (status === "NOT_IMPLEMENTED_FOR_SOURCE") return "not_implemented";
  if ((rankDelta ?? 0) >= 12) return "above_market";
  if ((rankDelta ?? 0) <= -12) return "below_market";
  return "aligned";
}

function valueReadiness(row: CombinedProjectionRow): H10ValueReadiness {
  if (row.projectionReadiness === "SCORING_PARTIAL_ALLOWANCE_ONLY") return "SCORING_PARTIAL_ALLOWANCE_ONLY";
  if (row.projectionReadiness === "LOW_CONFIDENCE_BASELINE") return "LOW_CONFIDENCE_BASELINE";
  if (row.marketComparisonStatus === "NOT_IMPLEMENTED_FOR_SOURCE") return "MARKET_NOT_IMPLEMENTED";
  if (row.marketComparisonStatus === "NO_COMPATIBLE_MARKET") return "NO_COMPATIBLE_MARKET";
  return "READY";
}

function valueWarnings(row: CombinedProjectionRow): string[] {
  const warnings = new Set(row.warningCodes);
  if (row.marketComparisonStatus === "NO_COMPATIBLE_MARKET") warnings.add("NO_COMPATIBLE_MARKET");
  if (row.marketComparisonStatus === "NOT_IMPLEMENTED_FOR_SOURCE") warnings.add("MARKET_NOT_IMPLEMENTED");
  if (row.projectionSource === "OFFENSE_BASELINE_V1") warnings.add("SINGLE_SEASON_OFFENSIVE_BASELINE");
  if (row.projectionSource === "DST_ALLOWANCE_BASELINE_V1_DRY_RUN") warnings.add("DST_DRY_RUN_ONLY");
  if (row.confidenceLabel === "low" || row.confidenceLabel === "very_low") warnings.add("LOW_PROJECTION_CONFIDENCE");
  return [...warnings].sort();
}

function summarizeTiers(rows: H10LeagueValueRow[]): Record<string, H10TierSummary[]> {
  const summaries: Record<string, H10TierSummary[]> = {};
  for (const [position, positionRows] of groupBy(rows, (row) => row.positionGroup)) {
    summaries[position] = [...groupBy(positionRows, (row) => String(row.tier)).values()].map((tierRows) => ({
      position,
      tierNumber: tierRows[0].tier,
      tierLabel: tierRows[0].tierLabel,
      tierSize: tierRows.length,
      playerIds: tierRows.map((row) => row.entityId).sort(),
      tierGapAbove: tierRows[0].tierGapAbove,
      tierGapBelow: tierRows[0].tierGapBelow,
    })).sort((a, b) => a.tierNumber - b.tierNumber);
  }
  return summaries;
}

function confidenceFactor(confidence: string): number {
  return CONFIDENCE_FACTOR[confidence] ?? 0.84;
}

function readinessFactor(readiness: ProjectionReadiness): number {
  return READINESS_FACTOR[readiness] ?? 0.8;
}

function normalizeGap(gap: number, basis: number): number {
  return clamp((gap / Math.max(Math.abs(basis), 1)) * 100, 0, 100);
}

function scarcityLabel(score: number): H10ScarcityLabel {
  if (score >= 75) return "extreme";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function normalizePosition(position: string): string {
  const normalized = position.toUpperCase();
  return normalized === "DEF" ? "DST" : normalized;
}

function rosterPositions(league: LeagueReadRow): string[] {
  return Array.isArray(league.roster_positions_json) ? league.roster_positions_json.map(String) : [];
}

function fallbackLeague(id: string, name?: string): LeagueReadRow {
  return { id, name: name ?? id, season: null, roster_positions_json: [], scoring_settings_json: {} };
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function groupBy<T>(values: T[], keyFn: (value: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFn(value);
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }
  return grouped;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
