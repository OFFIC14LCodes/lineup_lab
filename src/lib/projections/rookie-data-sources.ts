import { normalizePlayerName, normalizePrimaryPosition, normalizeTeam } from "@/lib/players/normalize";

export type RookieDataSource = "manual" | "csv_import" | "provider" | "derived" | "unknown";

export type RookieDataInput = {
  playerId?: string | null;
  playerName: string;
  position: string;
  team?: string | null;
  season: number;
  rookieYear?: number | null;
  age?: number | null;
  yearsExperience?: number | null;
  nflDraftRound?: number | null;
  nflDraftPick?: number | null;
  nflDraftOverall?: number | null;
  nflDraftTeam?: string | null;
  draftCapitalScore?: number | null;
  college?: string | null;
  collegeConference?: string | null;
  collegeGames?: number | null;
  collegePassingAttempts?: number | null;
  collegeCompletions?: number | null;
  collegePassingYards?: number | null;
  collegePassingTouchdowns?: number | null;
  collegeInterceptions?: number | null;
  collegeRushingAttempts?: number | null;
  collegeRushingYards?: number | null;
  collegeRushingTouchdowns?: number | null;
  collegeTargets?: number | null;
  collegeReceptions?: number | null;
  collegeReceivingYards?: number | null;
  collegeReceivingTouchdowns?: number | null;
  collegeSoloTackles?: number | null;
  collegeAssistedTackles?: number | null;
  collegeTotalTackles?: number | null;
  collegeTacklesForLoss?: number | null;
  collegeSacks?: number | null;
  collegeInterceptionsDef?: number | null;
  collegePassesDefended?: number | null;
  collegeForcedFumbles?: number | null;
  collegeFumbleRecoveries?: number | null;
  landingSpotRole?: "clear_starter" | "probable_starter" | "committee" | "rotational" | "backup" | "unknown" | null;
  opportunityNotes?: string[] | null;
  source: RookieDataSource;
  sourceLabel?: string | null;
  importedAt?: string | null;
  dataGaps?: string[];
};

export type DraftCapitalProfile = {
  round: number | null;
  pick: number | null;
  overall: number | null;
  score: number | null;
  opportunityTier: "high" | "medium" | "low" | "very_low" | "unknown";
  reasons: string[];
  dataGaps: string[];
};

export type CollegeProductionProfile = {
  position: string;
  productionScore: number | null;
  productionTier: "high" | "medium" | "low" | "very_low" | "unknown";
  volumeSignals: string[];
  efficiencySignals: string[];
  dataGaps: string[];
  reasons: string[];
};

export type NormalizedRookieProfile = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  season: number;
  draftCapital: DraftCapitalProfile;
  collegeProduction: CollegeProductionProfile;
  draftCapitalScore: number | null;
  collegeProductionScore: number | null;
  opportunityScore: number | null;
  landingSpotRole: NonNullable<RookieDataInput["landingSpotRole"]>;
  rookieProjectionConfidence: "very_low" | "low" | "medium" | "high";
  availableInputs: string[];
  dataGaps: string[];
  sourceLabels: string[];
};

export function normalizeRookieProfile(input: RookieDataInput): NormalizedRookieProfile {
  const position = normalizePrimaryPosition(input.position) ?? input.position.trim().toUpperCase();
  const team = normalizeTeam(input.team ?? input.nflDraftTeam ?? null);
  const draftCapital = buildDraftCapitalProfile(input);
  const collegeProduction = buildCollegeProductionProfile({ ...input, position });
  const landingSpotRole = normalizeLandingSpotRole(input.landingSpotRole);
  const opportunityScore = buildOpportunityScore(draftCapital, collegeProduction, landingSpotRole);
  const availableInputs = availableInputLabels(input, draftCapital, collegeProduction, landingSpotRole);
  const dataGaps = unique([
    ...(input.dataGaps ?? []),
    ...draftCapital.dataGaps,
    ...collegeProduction.dataGaps,
    landingSpotRole === "unknown" ? "landing spot role" : null,
    team ? null : "team assignment",
  ]);
  return {
    playerId: input.playerId?.trim() || rookieKey(input.playerName, position, input.season),
    playerName: input.playerName.trim(),
    position,
    team,
    season: input.season,
    draftCapital,
    collegeProduction,
    draftCapitalScore: draftCapital.score,
    collegeProductionScore: collegeProduction.productionScore,
    opportunityScore,
    landingSpotRole,
    rookieProjectionConfidence: rookieConfidence({ draftCapital, collegeProduction, opportunityScore, dataGaps }),
    availableInputs,
    dataGaps,
    sourceLabels: unique([input.sourceLabel ?? input.source]),
  };
}

export function buildDraftCapitalProfile(input: Pick<RookieDataInput, "nflDraftRound" | "nflDraftPick" | "nflDraftOverall" | "draftCapitalScore">): DraftCapitalProfile {
  const explicit = finite(input.draftCapitalScore);
  const round = finite(input.nflDraftRound);
  const pick = finite(input.nflDraftPick);
  const overall = finite(input.nflDraftOverall) ?? (round !== null && pick !== null ? (round - 1) * 32 + pick : null);
  const score = explicit ?? draftCapitalScore(round, pick, overall);
  return {
    round,
    pick,
    overall,
    score,
    opportunityTier: opportunityTier(score),
    reasons: score === null ? [] : [`Draft capital score ${score} informs rookie opportunity only.`],
    dataGaps: score === null ? ["NFL draft capital"] : [],
  };
}

export function buildCollegeProductionProfile(input: RookieDataInput): CollegeProductionProfile {
  const position = normalizePrimaryPosition(input.position) ?? input.position.trim().toUpperCase();
  const games = positive(input.collegeGames);
  const volumeSignals: string[] = [];
  const efficiencySignals: string[] = [];
  const scores: number[] = [];

  const add = (label: string, value: number | null, max: number, bucket: "volume" | "efficiency" = "volume") => {
    if (value === null) return;
    scores.push(Math.min(100, (value / max) * 100));
    (bucket === "volume" ? volumeSignals : efficiencySignals).push(label);
  };

  if (position === "QB") {
    add("passing attempts", positive(input.collegePassingAttempts), 520);
    add("passing yards", positive(input.collegePassingYards), 4200);
    add("passing touchdowns", positive(input.collegePassingTouchdowns), 38);
    add("rushing attempts", positive(input.collegeRushingAttempts), 140);
    add("rushing touchdowns", positive(input.collegeRushingTouchdowns), 12);
    const attempts = positive(input.collegePassingAttempts);
    const completions = positive(input.collegeCompletions);
    if (attempts && completions) add("completion rate", (completions / attempts) * 100, 72, "efficiency");
  } else if (position === "RB") {
    add("rushing attempts", positive(input.collegeRushingAttempts), 260);
    add("rushing yards", positive(input.collegeRushingYards), 1700);
    add("rushing touchdowns", positive(input.collegeRushingTouchdowns), 20);
    add("receptions", positive(input.collegeReceptions), 55);
    add("receiving yards", positive(input.collegeReceivingYards), 550);
  } else if (position === "WR" || position === "TE") {
    add("targets", positive(input.collegeTargets), position === "TE" ? 95 : 140);
    add("receptions", positive(input.collegeReceptions), position === "TE" ? 70 : 100);
    add("receiving yards", positive(input.collegeReceivingYards), position === "TE" ? 850 : 1450);
    add("receiving touchdowns", positive(input.collegeReceivingTouchdowns), position === "TE" ? 10 : 16);
  } else if (["DL", "LB", "DB"].includes(position)) {
    add("solo tackles", positive(input.collegeSoloTackles), position === "DL" ? 45 : 85);
    add("total tackles", positive(input.collegeTotalTackles), position === "DL" ? 70 : 125);
    add("tackles for loss", positive(input.collegeTacklesForLoss), 22);
    add("sacks", positive(input.collegeSacks), position === "DB" ? 5 : 14);
    add("passes defended", positive(input.collegePassesDefended), position === "DL" ? 4 : 16);
    add("interceptions", positive(input.collegeInterceptionsDef), 6);
    add("forced fumbles", positive(input.collegeForcedFumbles), 5);
  }

  if (games !== null) volumeSignals.push(`${games} college games`);
  const productionScore = scores.length ? round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
  return {
    position,
    productionScore,
    productionTier: productionTier(productionScore),
    volumeSignals,
    efficiencySignals,
    dataGaps: productionScore === null ? ["college production"] : [],
    reasons: productionScore === null ? [] : [`College production score ${productionScore} shapes rookie uncertainty; college stats are not copied into NFL projections.`],
  };
}

export function rookieKey(playerName: string, position: string, season: number): string {
  return `rookie:${normalizePlayerName(playerName)}:${position}:${season}`;
}

function buildOpportunityScore(draft: DraftCapitalProfile, production: CollegeProductionProfile, role: NormalizedRookieProfile["landingSpotRole"]): number | null {
  const roleScore = role === "clear_starter" ? 86 : role === "probable_starter" ? 74 : role === "committee" ? 58 : role === "rotational" ? 45 : role === "backup" ? 25 : null;
  const values = [draft.score, production.productionScore, roleScore].filter((value): value is number => value !== null);
  if (!values.length) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function rookieConfidence(input: {
  draftCapital: DraftCapitalProfile;
  collegeProduction: CollegeProductionProfile;
  opportunityScore: number | null;
  dataGaps: string[];
}): NormalizedRookieProfile["rookieProjectionConfidence"] {
  const sourceCount = [input.draftCapital.score, input.collegeProduction.productionScore, input.opportunityScore].filter((value) => value !== null).length;
  if (sourceCount >= 3 && input.dataGaps.length <= 1) return "medium";
  if (sourceCount >= 2) return "low";
  if (sourceCount === 1) return "low";
  return "very_low";
}

function availableInputLabels(input: RookieDataInput, draft: DraftCapitalProfile, production: CollegeProductionProfile, role: NormalizedRookieProfile["landingSpotRole"]): string[] {
  return unique([
    draft.score !== null ? "draft capital" : null,
    production.productionScore !== null ? "college production" : null,
    role !== "unknown" ? "landing spot role" : null,
    input.team || input.nflDraftTeam ? "team assignment" : null,
    input.age !== null && input.age !== undefined ? "age" : null,
    input.yearsExperience !== null && input.yearsExperience !== undefined ? "years experience" : null,
  ]);
}

function draftCapitalScore(round: number | null, pick: number | null, overall: number | null): number | null {
  if (overall !== null) return roundScoreByOverall(overall);
  if (round !== null) {
    if (round <= 1) return 88;
    if (round === 2) return 72;
    if (round === 3) return 58;
    if (round <= 5) return 36;
    if (round <= 7) return 22;
  }
  if (pick !== null) return roundScoreByOverall(pick);
  return null;
}

function roundScoreByOverall(overall: number): number {
  if (overall <= 16) return 95;
  if (overall <= 32) return 86;
  if (overall <= 64) return 70;
  if (overall <= 100) return 55;
  if (overall <= 160) return 35;
  if (overall <= 224) return 22;
  return 12;
}

function opportunityTier(score: number | null): DraftCapitalProfile["opportunityTier"] {
  if (score === null) return "unknown";
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  if (score >= 25) return "low";
  return "very_low";
}

function productionTier(score: number | null): CollegeProductionProfile["productionTier"] {
  if (score === null) return "unknown";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  if (score >= 25) return "low";
  return "very_low";
}

function normalizeLandingSpotRole(value: RookieDataInput["landingSpotRole"]): NormalizedRookieProfile["landingSpotRole"] {
  return value ?? "unknown";
}

function positive(value: unknown): number | null {
  const number = finite(value);
  return number !== null && number > 0 ? number : null;
}

function finite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
