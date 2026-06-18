export type ProjectionFoundationHandoffRecommendation =
  | "foundation_ready_for_disabled_flag_code_review"
  | "foundation_needs_more_dry_run_review"
  | "foundation_blocked";

export type ProjectionFoundationHandoffOptions = {
  projectionSeason: number;
  includeIdp: boolean;
};

export type ProjectionFoundationArtifactStatus = "available" | "missing" | "parse_error" | "not_parsed";

export type ProjectionFoundationArtifactSummary = {
  key: string;
  path: string;
  status: ProjectionFoundationArtifactStatus;
  sizeBytes: number | null;
  error: string | null;
};

export type ProjectionFoundationGovernanceStage = {
  stageName: string;
  artifactKey: string;
  artifactPath: string;
  artifactStatus: ProjectionFoundationArtifactStatus;
  recommendationOrVerdict: string | null;
  keyCounts: Record<string, number | string | boolean | null>;
  safetyGatesPassed: number | null;
  safetyGatesTotal: number | null;
  remainingBlockers: string[];
};

export type ProjectionFoundationCommandSection = {
  regenerateChain: string[];
  verification: string[];
};

export type ProjectionFoundationHandoffReport = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  includeIdp: boolean;
  currentRecommendation: ProjectionFoundationHandoffRecommendation;
  executiveSummary: {
    v82Status: string;
    featureFlagName: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES";
    defaultBehavior: string;
    liveBehaviorChanged: false;
    supabaseWritesChanged: false;
    blackbirdRankChanged: false;
    draftSuggestionsChanged: false;
    warRoomUiOrScoringChanged: false;
  };
  modelLineage: Array<{
    stage: string;
    summary: string;
    keyMetrics?: Record<string, string | number | boolean>;
  }>;
  artifacts: ProjectionFoundationArtifactSummary[];
  governanceChain: ProjectionFoundationGovernanceStage[];
  currentSafeSubset: {
    total2026Rows: number | null;
    wouldUseV82UnderEnabledFlag: number | null;
    wouldUseCurrentPath: number | null;
    excludedFromFlagPool: number | null;
    blockedFromFlagPool: number | null;
    kRowsUsingV82: number | null;
    criticalMoversUsingV82: number | null;
    meaningfulRankMoversUsingV82: number | null;
    legacyRowsUsingV82: number | null;
  };
  protectionPolicy: string[];
  featureFlagStatus: {
    featureFlag: "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES";
    enabledValues: string[];
    disabledValues: string[];
    missingArtifactsBehavior: "current_path";
    defaultArtifact: string;
  };
  commands: ProjectionFoundationCommandSection;
  allowedNext: string[];
  notAllowedYet: string[];
  safetyGates: Array<{ name: string; passed: boolean; detail: string }>;
  notes: string[];
};

export type ProjectionFoundationHandoffArtifactPaths = {
  jsonPath: string;
  markdownPath: string;
};
