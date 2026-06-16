import type { SourceAttribution } from "@/lib/data-acquisition/data-source-types";

export type ContextConfidence = "very_low" | "low" | "medium" | "high";
export type CurrentRole = "locked_starter" | "probable_starter" | "committee" | "rotational" | "backup" | "handcuff" | "rookie_unknown" | "deep_reserve" | "unknown";
export type FloorRole = "starter" | "committee" | "rotational" | "backup" | "inactive" | "unknown";
export type CeilingRole = "elite_starter" | "starter" | "committee_lead" | "rotational_plus" | "backup" | "unknown";
export type Tendency = "low" | "neutral" | "high" | "unknown";
export type PaceTendency = "slow" | "neutral" | "fast" | "unknown";

export type PlayerContextProfile = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  season: number;
  identity: {
    age: number | null;
    yearsExperience: number | null;
    college: string | null;
    draftYear: number | null;
    draftRound: number | null;
    draftPick: number | null;
    draftOverall: number | null;
  };
  physicalProfile: {
    heightInches: number | null;
    weightPounds: number | null;
    bmi: number | null;
    armLengthInches: number | null;
    handSizeInches: number | null;
    wingspanInches: number | null;
  };
  athleticProfile: {
    fortyYardDash: number | null;
    tenYardSplit: number | null;
    verticalJumpInches: number | null;
    broadJumpInches: number | null;
    threeCone: number | null;
    shuttle: number | null;
    benchPressReps: number | null;
    speedScore: number | null;
    burstScore: number | null;
    agilityScore: number | null;
  };
  roleProfile: {
    currentRole: CurrentRole;
    floorRole: FloorRole;
    ceilingRole: CeilingRole;
    roleConfidence: ContextConfidence;
    expectedGamesActive: number | null;
    expectedGamesStarted: number | null;
    expectedSnapShare: number | null;
    expectedRouteShare: number | null;
    expectedRushShare: number | null;
    expectedTargetShare: number | null;
    expectedTackleOpportunity: number | null;
  };
  depthChartProfile: {
    depthChartPosition: number | null;
    depthChartLabel: string | null;
    primaryCompetition: string[];
    pathToCeiling: string[];
    pathToFloor: string[];
    depthChartConfidence: ContextConfidence;
  };
  coachingEnvironment: {
    headCoach: string | null;
    offensiveCoordinator: string | null;
    defensiveCoordinator: string | null;
    schemeLabel: string | null;
    paceTendency: PaceTendency;
    passRateTendency: Tendency;
    rushRateTendency: Tendency;
    teUsageTendency: Tendency;
    rbTargetTendency: Tendency;
    idpTackleOpportunity: Tendency;
    confidence: ContextConfidence;
  };
  injuryProfile: {
    gamesMissedLastSeason: number | null;
    gamesMissedLast3Seasons: number | null;
    notableInjuries: string[];
    currentInjuryStatus: string | null;
    injuryRisk: "low" | "medium" | "high" | "unknown";
    riskReasons: string[];
    confidence: ContextConfidence;
  };
  sourceSummary: {
    sourceLabels: string[];
    importedAt: string | null;
    confidence: ContextConfidence;
    dataGaps: string[];
    conflicts: string[];
  };
};

export type PlayerContextSourceKind =
  | "physical-profile"
  | "athletic-testing"
  | "depth-chart"
  | "role-notes"
  | "injury-history"
  | "coaching-environment"
  | "team-environment";

export type PlayerContextSourceRecord = {
  kind: PlayerContextSourceKind;
  rowNumber: number;
  playerId: string | null;
  playerName: string;
  position: string;
  team: string | null;
  season: number | null;
  values: Record<string, unknown>;
  attribution: SourceAttribution;
  dataGaps: string[];
};
