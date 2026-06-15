import { sha256 } from "@/lib/projections/hash";
import type {
  H910LeagueInput,
  H910LeagueOutput,
  H910PlayerProjection,
  H910ReasonCode,
  H910UnresolvedExclusionSummary,
  H910WeeklyRow,
} from "@/lib/projections/idp-k-baseline-projections";

export const H911_PROJECTION_METHOD = "blackbird_idp_k_baseline_v1";
export const H911_PROJECTION_VERSION = 3;
export const H911_SELECTION_SCOPE = "idp_k";
export const H911_REASON_REGISTRY_VERSION = "h9.11-idp-k-reasons-v1";

export type H911Args = {
  historicalSeason: number;
  projectionSeason: number;
  includeIdp: boolean;
  includeKicker: boolean;
  position: string | null;
  limit: number | null;
  playerId: string | null;
  leagueId: string | null;
};

export type H911RunRow = {
  projection_version: number;
  historical_season: number;
  projection_season: number;
  league_config_season: number;
  context_version: number;
  as_of_date: string;
  method: string;
  code_version: string;
  model_config_json: Record<string, unknown>;
  semantic_input_hash: string;
  selection_scope: string;
  run_status: "ready_to_persist";
  population_count: number;
  league_count: number;
  input_count: number;
  output_count: number;
  reason_count: number;
};

export type H911InputRow = {
  canonical_player_id: string;
  position: string;
  position_group: string;
  role_sample_class: string;
  role_sample_confidence: string;
  games_confidence: string;
  historical_active_weeks: number;
  historical_role_weeks: number;
  role_participation_factor: number;
  projected_active_games_floor: number;
  projected_active_games_median: number;
  projected_active_games_ceiling: number;
  projected_role_games_floor: number;
  projected_role_games_median: number;
  projected_role_games_ceiling: number;
  model_uncertainty: number;
  player_volatility: number;
  total_range_width: number;
  projection_confidence_score: number;
  projection_confidence_label: string;
  h8_snapshot_id: null;
  adp_record_ids: string[];
  player_data_hash: string;
  player_projection_input_hash: string;
};

export type H911OutputRow = {
  canonical_player_id: string;
  league_id: string;
  position: string;
  projected_ppg_when_in_role: number;
  floor_ppg: number;
  ceiling_ppg: number;
  downside_points: number;
  floor_points: number;
  median_points: number;
  ceiling_points: number;
  upside_points: number;
  model_uncertainty: number;
  player_volatility: number;
  total_range_width: number;
  projection_confidence_score: number;
  projection_confidence_label: string;
  market_agreement_score: null;
  market_discrepancy: null;
  market_discrepancy_label: null;
  projected_position_rank: number;
  projected_components_json: Record<string, unknown>;
  projection_method: string;
  player_projection_input_hash: string;
  semantic_input_hash: string;
};

export type H911ReasonRow = {
  canonical_player_id: string;
  league_id: string | null;
  reason_code: string;
  reason_scope: string;
  direction: "neutral" | "widened" | "excluded";
  magnitude: number | null;
  explanation: string;
  source_evidence_ids: string[];
  reason_key: string;
};

export type H911WritePlan = {
  run: H911RunRow;
  semanticInputHash: string;
  inputs: H911InputRow[];
  outputs: H911OutputRow[];
  reasonsWithoutRun: Omit<H911ReasonRow, "reason_key">[];
  expected: {
    inputCount: number;
    outputCount: number;
    reasonCount: number;
    playerCount: number;
    leagueCount: number;
  };
};

export type H911InspectionRows = {
  inputs: Array<{ canonical_player_id: string; position: string | null; position_group?: string | null }>;
  outputs: Array<{ canonical_player_id: string; league_id: string; position: string | null }>;
  reasons: Array<{ reason_key: string }>;
};

export type H911InspectionSummary = {
  inputCount: number;
  outputCount: number;
  reasonCount: number;
  distinctInputPlayers: number;
  distinctOutputPlayers: number;
  distinctOutputLeagues: number;
  positionDistribution: Record<string, number>;
  missingPlayerLeagueOutputs: number;
  duplicateOutputKeys: number;
  duplicateReasonKeys: number;
  complete: boolean;
};

const MODEL_CONFIG = {
  projectionMethod: H911_PROJECTION_METHOD,
  projectionVersion: H911_PROJECTION_VERSION,
  reasonRegistryVersion: H911_REASON_REGISTRY_VERSION,
  sourceDataVersion: "h9.8-special-teams-defense",
  label: "low-confidence baseline",
  scoringKeyCompatibility: "sleeper_idp_prefixed_keys_projection_alias_v3",
  idpStableRegression: "light",
  idpBigPlayRegression: "heavy",
  idpTdSafetyVolatility: "extreme",
  kickerMakeRateRegression: "population_shrinkage",
  kickerTeamEnvironmentModeled: false,
};

export function h911ModelConfig(): Record<string, unknown> {
  return MODEL_CONFIG;
}

export function assertH911ExecuteSafety(args: Pick<H911Args, "limit" | "includeIdp" | "includeKicker" | "position" | "playerId" | "leagueId">, allowPartialExecute: boolean) {
  const scoped = Boolean(args.position || args.playerId || args.leagueId || (args.includeIdp !== args.includeKicker));
  if (args.limit !== null && !allowPartialExecute) throw new Error("--execute with --limit requires --allow-partial-execute.");
  if (!scoped && args.limit !== null && !allowPartialExecute) throw new Error("--execute partial selection requires --allow-partial-execute.");
}

export function buildH911WritePlan(input: {
  args: H911Args;
  weeklyRows: H910WeeklyRow[];
  projections: H910PlayerProjection[];
  leagues: H910LeagueInput[];
  outputs: H910LeagueOutput[];
  unresolvedExclusions: H910UnresolvedExclusionSummary;
  unsupportedScoringKeys: string[];
  scenarioInvariantFailures: string[];
  asOfDate: string;
  codeVersion: string;
}): H911WritePlan {
  if (input.unsupportedScoringKeys.length > 0) throw new Error("EXECUTE ABORTED — no database writes performed: unsupported scoring keys.");
  if (input.scenarioInvariantFailures.length > 0) throw new Error("EXECUTE ABORTED — no database writes performed: scenario invariant failures.");
  if (!input.projections.every((projection) => projection.projectionLabel === "low-confidence baseline")) {
    throw new Error("EXECUTE ABORTED — no database writes performed: missing low-confidence labels.");
  }
  if (input.unresolvedExclusions.unresolvedRowsExcluded.total < 0) {
    throw new Error("EXECUTE ABORTED — no database writes performed: unresolved exclusions missing.");
  }

  const playerHashes = new Map<string, { playerDataHash: string; playerProjectionInputHash: string }>();
  for (const projection of input.projections) {
    const playerRows = input.weeklyRows
      .filter((row) => row.player_id === projection.canonicalPlayerId)
      .sort((a, b) => a.week - b.week);
    const playerDataHash = semanticHash({
      playerId: projection.canonicalPlayerId,
      position: projection.position,
      historicalSeason: input.args.historicalSeason,
      projectionSeason: input.args.projectionSeason,
      rows: playerRows,
      projection,
      modelConfig: MODEL_CONFIG,
    });
    playerHashes.set(projection.canonicalPlayerId, {
      playerDataHash,
      playerProjectionInputHash: semanticHash({
        playerId: projection.canonicalPlayerId,
        playerDataHash,
        method: H911_PROJECTION_METHOD,
        projectionVersion: H911_PROJECTION_VERSION,
      }),
    });
  }

  const leagueHashes = Object.fromEntries(
    input.leagues
      .map((league) => [league.leagueId, semanticHash({ leagueId: league.leagueId, scoringSettings: league.scoringSettings, rosterPositions: league.rosterPositions })] as const)
      .sort(([a], [b]) => a.localeCompare(b))
  );
  const semanticInputHash = semanticHash({
    historicalSeason: input.args.historicalSeason,
    projectionSeason: input.args.projectionSeason,
    method: H911_PROJECTION_METHOD,
    projectionVersion: H911_PROJECTION_VERSION,
    selectionScope: H911_SELECTION_SCOPE,
    rowHashes: input.weeklyRows.map((row) => semanticHash(row)).sort(),
    playerProjectionInputHashes: [...playerHashes.values()].map((hashes) => hashes.playerProjectionInputHash).sort(),
    leagueHashes,
    modelConfig: MODEL_CONFIG,
    unresolvedExclusions: input.unresolvedExclusions,
    reasonRegistryVersion: H911_REASON_REGISTRY_VERSION,
  });

  const projectionByPlayer = new Map(input.projections.map((projection) => [projection.canonicalPlayerId, projection]));
  const inputs = input.projections.map((projection) => buildInputRow(projection, playerHashes.get(projection.canonicalPlayerId)!));
  const outputs = input.outputs.map((output) => buildOutputRow(output, projectionByPlayer.get(output.playerId)!, playerHashes.get(output.playerId)!, semanticInputHash));
  const reasonsWithoutRun = buildReasonRows(input.projections, input.outputs, input.unresolvedExclusions);

  return {
    run: {
      projection_version: H911_PROJECTION_VERSION,
      historical_season: input.args.historicalSeason,
      projection_season: input.args.projectionSeason,
      league_config_season: input.args.projectionSeason,
      context_version: 1,
      as_of_date: input.asOfDate,
      method: H911_PROJECTION_METHOD,
      code_version: input.codeVersion,
      model_config_json: MODEL_CONFIG,
      semantic_input_hash: semanticInputHash,
      selection_scope: H911_SELECTION_SCOPE,
      run_status: "ready_to_persist",
      population_count: input.projections.length,
      league_count: new Set(input.outputs.map((output) => output.leagueId)).size,
      input_count: inputs.length,
      output_count: outputs.length,
      reason_count: reasonsWithoutRun.length,
    },
    semanticInputHash,
    inputs,
    outputs,
    reasonsWithoutRun,
    expected: {
      inputCount: inputs.length,
      outputCount: outputs.length,
      reasonCount: reasonsWithoutRun.length,
      playerCount: input.projections.length,
      leagueCount: new Set(input.outputs.map((output) => output.leagueId)).size,
    },
  };
}

export function h911ReasonKey(input: {
  projectionRunId: string;
  canonicalPlayerId: string;
  leagueId: string | null;
  reasonCode: string;
  reasonScope: string;
}): string {
  return semanticHash([input.projectionRunId, input.canonicalPlayerId, input.leagueId ?? "GLOBAL", input.reasonCode, input.reasonScope]);
}

export function inspectH911Rows(rows: H911InspectionRows, expected?: H911WritePlan["expected"]): H911InspectionSummary {
  const outputKeys = rows.outputs.map((row) => `${row.canonical_player_id}|${row.league_id}`);
  const reasonKeys = rows.reasons.map((row) => row.reason_key);
  const duplicateOutputKeys = outputKeys.length - new Set(outputKeys).size;
  const duplicateReasonKeys = reasonKeys.length - new Set(reasonKeys).size;
  const missingPlayerLeagueOutputs = expected ? Math.max(0, expected.outputCount - new Set(outputKeys).size) : 0;
  const positionDistribution = countBy(rows.inputs.map((row) => row.position_group ?? row.position ?? "UNKNOWN"));
  return {
    inputCount: rows.inputs.length,
    outputCount: rows.outputs.length,
    reasonCount: rows.reasons.length,
    distinctInputPlayers: new Set(rows.inputs.map((row) => row.canonical_player_id)).size,
    distinctOutputPlayers: new Set(rows.outputs.map((row) => row.canonical_player_id)).size,
    distinctOutputLeagues: new Set(rows.outputs.map((row) => row.league_id)).size,
    positionDistribution,
    missingPlayerLeagueOutputs,
    duplicateOutputKeys,
    duplicateReasonKeys,
    complete: Boolean(
      (!expected || (rows.inputs.length === expected.inputCount && rows.outputs.length === expected.outputCount && rows.reasons.length === expected.reasonCount && missingPlayerLeagueOutputs === 0)) &&
      duplicateOutputKeys === 0 &&
      duplicateReasonKeys === 0
    ),
  };
}

function buildInputRow(projection: H910PlayerProjection, hashes: { playerDataHash: string; playerProjectionInputHash: string }): H911InputRow {
  const activeFloor = Math.floor(projection.projectedActiveWeeks * 0.8);
  const activeCeiling = Math.min(17, Math.ceil(projection.projectedActiveWeeks * 1.15));
  const roleFloor = Math.floor(projection.projectedRoleWeeks * 0.8);
  const roleCeiling = Math.min(activeCeiling, Math.ceil(projection.projectedRoleWeeks * 1.2));
  return {
    canonical_player_id: projection.canonicalPlayerId,
    position: projection.position,
    position_group: projection.position,
    role_sample_class: projection.roleClass,
    role_sample_confidence: projection.confidence,
    games_confidence: projection.confidence,
    historical_active_weeks: projection.historicalActiveWeeks,
    historical_role_weeks: projection.historicalRoleWeeks,
    role_participation_factor: round(clamp(projection.roleParticipation, 0, 1), 6),
    projected_active_games_floor: activeFloor,
    projected_active_games_median: Math.round(projection.projectedActiveWeeks),
    projected_active_games_ceiling: activeCeiling,
    projected_role_games_floor: roleFloor,
    projected_role_games_median: Math.round(projection.projectedRoleWeeks),
    projected_role_games_ceiling: roleCeiling,
    model_uncertainty: projection.confidence === "low" ? 0.55 : 0.8,
    player_volatility: projection.volatility === "medium" ? 0.4 : projection.volatility === "high" ? 0.7 : 0.95,
    total_range_width: totalRangeWidth(projection.componentsByScenario.downside, projection.componentsByScenario.upside, projection.componentsByScenario.median),
    projection_confidence_score: projection.confidence === "low" ? 0.45 : 0.25,
    projection_confidence_label: projection.confidence,
    h8_snapshot_id: null,
    adp_record_ids: [],
    player_data_hash: hashes.playerDataHash,
    player_projection_input_hash: hashes.playerProjectionInputHash,
  };
}

function buildOutputRow(
  output: H910LeagueOutput,
  projection: H910PlayerProjection,
  hashes: { playerProjectionInputHash: string },
  semanticInputHash: string
): H911OutputRow {
  const roleGames = Math.max(1, projection.projectedRoleWeeks);
  return {
    canonical_player_id: output.playerId,
    league_id: output.leagueId,
    position: output.position,
    projected_ppg_when_in_role: round(output.medianPoints / roleGames, 4),
    floor_ppg: round(output.floorPoints / roleGames, 4),
    ceiling_ppg: round(output.ceilingPoints / roleGames, 4),
    downside_points: output.downsidePoints,
    floor_points: output.floorPoints,
    median_points: output.medianPoints,
    ceiling_points: output.ceilingPoints,
    upside_points: output.upsidePoints,
    model_uncertainty: projection.confidence === "low" ? 0.55 : 0.8,
    player_volatility: projection.volatility === "medium" ? 0.4 : projection.volatility === "high" ? 0.7 : 0.95,
    total_range_width: totalRangeWidth(projection.componentsByScenario.downside, projection.componentsByScenario.upside, projection.componentsByScenario.median),
    projection_confidence_score: projection.confidence === "low" ? 0.45 : 0.25,
    projection_confidence_label: output.confidence,
    market_agreement_score: null,
    market_discrepancy: null,
    market_discrepancy_label: null,
    projected_position_rank: output.rank,
    projected_components_json: projection.componentsByScenario,
    projection_method: H911_PROJECTION_METHOD,
    player_projection_input_hash: hashes.playerProjectionInputHash,
    semantic_input_hash: semanticInputHash,
  };
}

function buildReasonRows(
  projections: H910PlayerProjection[],
  outputs: H910LeagueOutput[],
  unresolvedExclusions: H910UnresolvedExclusionSummary
): Omit<H911ReasonRow, "reason_key">[] {
  const reasonRows = new Map<string, Omit<H911ReasonRow, "reason_key">>();
  const add = (row: Omit<H911ReasonRow, "reason_key">) => {
    reasonRows.set(`${row.canonical_player_id}|${row.league_id ?? "GLOBAL"}|${row.reason_code}|${row.reason_scope}`, row);
  };
  for (const projection of projections) {
    for (const reasonCode of projection.reasonCodes) {
      add({
        canonical_player_id: projection.canonicalPlayerId,
        league_id: null,
        reason_code: reasonCode,
        reason_scope: "player_projection",
        direction: reasonDirection(reasonCode),
        magnitude: reasonCode === "IDP_UNRESOLVED_ROWS_EXCLUDED" ? unresolvedExclusions.unresolvedRowsExcluded.total : null,
        explanation: reasonExplanation(reasonCode),
        source_evidence_ids: [],
      });
    }
  }
  for (const output of outputs) {
    for (const reasonCode of output.reasonCodes) {
      add({
        canonical_player_id: output.playerId,
        league_id: output.leagueId,
        reason_code: reasonCode,
        reason_scope: "league_scoring",
        direction: reasonDirection(reasonCode),
        magnitude: null,
        explanation: reasonExplanation(reasonCode),
        source_evidence_ids: [],
      });
    }
  }
  return [...reasonRows.values()].sort((a, b) =>
    a.canonical_player_id.localeCompare(b.canonical_player_id) ||
    (a.league_id ?? "").localeCompare(b.league_id ?? "") ||
    a.reason_code.localeCompare(b.reason_code)
  );
}

function reasonDirection(reasonCode: H910ReasonCode): "neutral" | "widened" | "excluded" {
  if (reasonCode === "IDP_UNRESOLVED_ROWS_EXCLUDED") return "excluded";
  if (reasonCode.includes("LOW_SAMPLE") || reasonCode.includes("VOLATILITY") || reasonCode.includes("LIMITED")) return "widened";
  return "neutral";
}

function reasonExplanation(reasonCode: H910ReasonCode): string {
  const explanations: Record<H910ReasonCode, string> = {
    IDP_TACKLE_VOLUME_PROJECTED: "IDP tackle volume projected from 2025 role-week rates with position reference regression.",
    IDP_BIG_PLAY_REGRESSION: "IDP sacks and turnover events are heavily regressed because big plays are volatile.",
    IDP_LOW_SAMPLE: "IDP projection is based on a low historical role sample.",
    IDP_UNRESOLVED_ROWS_EXCLUDED: "Unresolved IDP/K source rows were excluded from the persisted projection population.",
    IDP_ROLE_LOW_CONFIDENCE: "IDP role class is low confidence because 2025 usage was limited or unclear.",
    IDP_DEFENSIVE_TD_VOLATILITY: "Defensive touchdowns and safeties are treated as extreme-volatility components.",
    K_VOLUME_PROJECTED_FROM_HISTORY: "Kicker attempt volume projected from 2025 kicking weeks.",
    K_MAKE_RATE_REGRESSION: "Kicker FG/XP make rates are shrunk toward population references.",
    K_DISTANCE_BUCKET_LIMITED: "Kicker distance buckets are limited to available make/miss fields; attempt buckets are not fabricated.",
    K_LOW_SAMPLE: "Kicker projection is based on a low historical kicking sample.",
    K_TEAM_ENVIRONMENT_NOT_MODELED: "Kicker team offensive environment is not modeled in H9.11.",
  };
  return explanations[reasonCode];
}

function totalRangeWidth(downside: Record<string, number>, upside: Record<string, number>, median: Record<string, number>): number {
  const low = Object.values(downside).reduce((sum, value) => sum + Math.abs(value), 0);
  const high = Object.values(upside).reduce((sum, value) => sum + Math.abs(value), 0);
  const mid = Object.values(median).reduce((sum, value) => sum + Math.abs(value), 0);
  return round(clamp((high - low) / Math.max(1, mid), 0, 1), 6);
}

function semanticHash(value: unknown): string {
  return sha256(JSON.stringify(sortKeysDeep(value)));
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, sortKeysDeep((value as Record<string, unknown>)[key])]));
  }
  return String(value);
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, places: number): number {
  return Number(value.toFixed(places));
}
