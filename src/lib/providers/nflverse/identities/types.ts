export type UnresolvedRootCause =
  | "canonical_player_missing"       // no canonical player in Blackbird DB at all
  | "canonical_gsis_missing"         // canonical exists (by name+pos) but meta.gsis_id is null
  | "canonical_espn_missing"         // canonical exists but meta.espn_id is null or mismatched
  | "source_identifier_missing"      // nflverse player has no espn_id or usable identifier
  | "identifier_format_mismatch"     // IDs exist but don't match (format/value divergence)
  | "duplicate_canonical_candidate"  // multiple canonical players match same name+position
  | "conflicting_external_mapping"   // player_external_ids row exists but for wrong player
  | "position_mismatch"              // name matches canonical but position groups incompatible
  | "legacy_or_duplicate_source_identity" // legacy GSIS format or duplicate GSIS in source
  | "unknown";

// ─── Evidence types ──────────────────────────────────────────────────────────

export type ConfidenceTier =
  | "auto_approved"          // strong or 2+ medium signals, no contradictions
  | "high_confidence_review" // name+pos match or single medium signal; needs explicit approval
  | "ambiguous"              // multiple candidates or unclear identity
  | "conflict"               // contradictory biographical data between sources
  | "rejected";              // DEF/DST, no position match, or other hard block

export type MatchedSignal = {
  field: string;
  sourceValue: string;
  canonicalValue: string;
  strength: "strong" | "medium";
};

export type Contradiction = {
  field: string;
  sourceValue: string | null;
  canonicalValue: string | null;
  description: string;
};

export type EvidenceComparison = {
  strongMatches: MatchedSignal[];
  mediumMatches: MatchedSignal[];
  contradictions: Contradiction[];
  tier: ConfidenceTier;
  approvalReason: string;
};

// ─── Player info types ────────────────────────────────────────────────────────

// Info extracted from nflverse players.csv for a single player.
export type NflversePlayerInfo = {
  gsisId: string;
  displayName: string;
  normalizedName: string;
  positionGroup: string | null;   // Blackbird-canonicalized (QB/RB/WR/TE/OL/DL/etc.)
  rawPosition: string | null;     // raw CSV value
  latestTeam: string | null;
  espnId: string | null;
  birthDate: string | null;
  college: string | null;         // college_name field (may include transfer semicolons)
  height: string | null;          // raw height string (inches or feet/inches)
  weight: string | null;          // raw weight string (lbs)
  status: string;
  lastSeason: number | null;
  // Extended evidence fields
  suffix: string | null;          // name suffix (Jr, Sr, II, III, etc.)
  rookieSeason: number | null;    // first NFL season
  draftYear: number | null;
  draftRound: number | null;
  draftPick: number | null;
};

// One canonical player entry from the Blackbird players table.
export type CanonicalPlayerInfo = {
  playerId: string;
  sleeperId: string;
  fullName: string | null;
  normalizedName: string | null;
  positionGroup: string | null;
  team: string | null;
  metaGsisId: string | null;
  metaEspnId: string | null;
  metaStatsId: string | null;
  // Extended evidence fields from metadata_json
  metaBirthDate: string | null;   // metadata_json.birth_date
  metaCollege: string | null;     // metadata_json.college
  metaHeightInches: number | null; // metadata_json.height (normalized to inches)
  metaWeightLbs: number | null;   // metadata_json.weight (parsed)
  metaRookieYear: number | null;  // metadata_json.metadata.rookie_year
};

// Per-player output from the diagnosis pipeline.
export type UnresolvedPlayerReport = {
  gsisId: string;
  // nflverse data
  nflverseName: string;
  nflversePositionGroup: string | null;
  nflverseTeam: string | null;
  nflverseEspnId: string | null;
  nflverseBirthDate: string | null;
  nflverseCollege: string | null;
  nflverseHeight: string | null;
  nflverseWeight: string | null;
  // Extended nflverse evidence fields
  nflverseSuffix: string | null;
  nflverseRookieSeason: number | null;
  nflverseDraftYear: number | null;
  nflverseDraftRound: number | null;
  nflverseDraftPick: number | null;
  // weekly stat context
  weeklyRowCount: number;
  weeklyPosition: string;  // position group seen in weekly stats
  // canonical match context
  candidateCount: number;                    // total name-compatible canonical candidates
  canonicalPlayerId: string | null;          // set when candidateCount === 1
  canonicalName: string | null;
  canonicalSleeperPlayerId: string | null;
  canonicalMetaGsisId: string | null;
  canonicalMetaEspnId: string | null;
  canonicalMetaStatsId: string | null;
  canonicalTeam: string | null;
  canonicalPositionGroup: string | null;
  // Extended canonical evidence fields
  canonicalBirthDate: string | null;
  canonicalCollege: string | null;
  canonicalHeight: string | null;            // raw height from canonical
  canonicalWeight: string | null;            // raw weight from canonical
  canonicalRookieYear: number | null;
  // existing mapping check
  hasExistingMapping: boolean;
  existingMappingPlayerId: string | null;
  // classification
  rootCause: UnresolvedRootCause;
  // evidence comparison (populated for canonical_gsis_missing with unique candidate)
  evidence: EvidenceComparison | null;
  confidenceTier: ConfidenceTier | null;
  approvalReason: string | null;
};

export type DiagnoseOptions = {
  season: number;
  projectRoot: string;
};

export type DiagnoseReport = {
  season: number;
  totalUnresolved: number;
  rootCauseCounts: Record<UnresolvedRootCause, number>;
  byPosition: Record<string, Partial<Record<UnresolvedRootCause, number>>>;
  players: UnresolvedPlayerReport[];
  // Sleeper metadata coverage summary
  withUniqueCandidate: number;
  candidatesWithSleeperId: number;
  candidatesMissingGsisId: number;
  candidatesMissingEspnId: number;
  candidatesSleeperHasGsisId: number;
  candidatesSleeperHasEspnId: number;
  // Evidence tier summary (for canonical_gsis_missing with unique candidate)
  tierCounts: {
    autoApproved: number;
    highConfidenceReview: number;
    ambiguous: number;
    conflict: number;
    rejected: number;
  };
  autoApprovedRows: number;
  reviewRows: number;
  conflictRows: number;
};

export type RepairMode = "dry_run" | "execute";

export type RepairDecision = {
  gsisId: string;
  nflverseName: string;
  nflversePosition: string | null;
  nflverseTeam: string | null;
  canonicalPlayerId: string;
  canonicalName: string | null;
  canonicalSleeperId: string;
  repairType: "add_gsis_id" | "add_espn_id";
  newValue: string;
  existingValue: string | null;
  decision: "repair" | "skip";
  skipReason?: string;
  confidenceTier?: ConfidenceTier;
};

export type RepairOptions = {
  mode: RepairMode;
  projectRoot: string;
  season: number;
  // GSIS IDs explicitly approved from a manual review artifact.
  // high_confidence_review players in this set ARE written; all others are skipped.
  approvedReviewIds?: Set<string>;
};

export type RepairReport = {
  mode: RepairMode;
  season: number;
  totalCandidates: number;
  gsisIdRepairs: number;
  espnIdRepairs: number;
  // Tier breakdown
  autoApprovedRepairs: number;
  reviewApprovedRepairs: number;
  skipped: number;
  skippedPendingReview: number;    // high_confidence_review not yet approved
  skippedBlocked: number;          // conflict / ambiguous / rejected
  conflicts: number;               // data contradictions blocking repair
  errors: number;
  decisions: RepairDecision[];
  durationMs: number;
  completedAt: string;
};
