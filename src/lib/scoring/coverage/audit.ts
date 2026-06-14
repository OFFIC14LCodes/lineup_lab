import { SLEEPER_RULES_BY_KEY } from "@/lib/scoring/sleeper-keys";
import { getKnownScoringKeyDefinition } from "@/lib/scoring/key-definitions";

import { H2_VERIFIED_KEYS, SCORING_COVERAGE_REGISTRY, REGISTRY_BY_KEY } from "./registry";
import type {
  AuditFinding,
  CoverageAuditResult,
  ScoringDataStatus,
  ScoringEngineStatus,
  ScoringScopeClassification,
  ScoringSourceClassification,
  ScoringStatFamily,
  ScoringVerificationLevel
} from "./types";

// ---------------------------------------------------------------------------
// Known constants
// ---------------------------------------------------------------------------

const PBP_DERIVED_EXPECTED = new Set(["fum_ret_td", "pass_int_td", "pass_pick6", "rec_td_40p", "rec_td_50p", "rush_td_40p", "rush_td_50p"]);
const H2_VERIFIED_EXPECTED = new Set<string>(H2_VERIFIED_KEYS);

// Keys that appear with multiple position-groups in SLEEPER_SCORING_RULES
// (once for team_defense, once for IDP) — engine correctly has both entries.
const DUAL_POSITION_KEYS = new Set(["sack", "int", "ff", "fr", "safe", "blk_kick", "def_td", "def_st_td"]);

// ---------------------------------------------------------------------------
// Audit runner
// ---------------------------------------------------------------------------

export function runCoverageAudit(): CoverageAuditResult {
  const findings: AuditFinding[] = [];
  const auditedAt = new Date().toISOString();

  // --- 1. Build unique key set from engine ---
  const engineKeys = new Set<string>(SLEEPER_RULES_BY_KEY.keys());

  // --- 2. Registry vs engine completeness ---
  for (const record of SCORING_COVERAGE_REGISTRY) {
    const { key, engineStatus } = record;
    const hasEngineRule = engineKeys.has(key);

    if (engineStatus.startsWith("implemented") && !hasEngineRule) {
      findings.push({
        severity: "error",
        type: "engine_mismatch",
        key,
        detail: `Registry says engineStatus=${engineStatus} but no rule found in SLEEPER_RULES_BY_KEY.`
      });
    }

    if (engineStatus === "not_implemented" && hasEngineRule) {
      findings.push({
        severity: "error",
        type: "engine_mismatch",
        key,
        detail: `Registry says engineStatus=not_implemented but a rule exists in SLEEPER_RULES_BY_KEY.`
      });
    }
  }

  // --- 3. Engine keys not in registry ---
  for (const engineKey of engineKeys) {
    if (!REGISTRY_BY_KEY.has(engineKey)) {
      findings.push({
        severity: "error",
        type: "registry_gap",
        key: engineKey,
        detail: `Key found in SLEEPER_RULES_BY_KEY but has no registry entry.`
      });
    }
  }

  // --- 4. PBP-derived set must match current derived-stat coverage ---
  const registryPbpDerived = SCORING_COVERAGE_REGISTRY
    .filter((r) => r.dataStatus === "nflverse_pbp_derived")
    .map((r) => r.key);

  for (const key of registryPbpDerived) {
    if (!PBP_DERIVED_EXPECTED.has(key)) {
      findings.push({
        severity: "warning",
        type: "pbp_derived_set_mismatch",
        key,
        detail: `Registry marks this key nflverse_pbp_derived but it is not in the expected derived-stat set ${[...PBP_DERIVED_EXPECTED].join(", ")}.`
      });
    }
  }

  for (const expectedKey of PBP_DERIVED_EXPECTED) {
    const record = REGISTRY_BY_KEY.get(expectedKey);
    if (!record) {
      findings.push({
        severity: "error",
        type: "pbp_derived_set_mismatch",
        key: expectedKey,
        detail: "Expected derived-stat key is missing from the registry entirely."
      });
    } else if (record.dataStatus !== "nflverse_pbp_derived") {
      findings.push({
        severity: "error",
        type: "pbp_derived_set_mismatch",
        key: expectedKey,
        detail: `Expected nflverse_pbp_derived but registry has dataStatus=${record.dataStatus}.`
      });
    }
  }

  // --- 4b. H2/H2.1 verified five-key set must remain operational ---
  for (const expectedKey of H2_VERIFIED_EXPECTED) {
    const record = REGISTRY_BY_KEY.get(expectedKey);
    if (!record) {
      findings.push({
        severity: "error",
        type: "pbp_derived_set_mismatch",
        key: expectedKey,
        detail: "Expected H2/H2.1 verified key is missing from the registry."
      });
      continue;
    }

    if (record.engineStatus !== "implemented_verified") {
      findings.push({
        severity: "error",
        type: "engine_mismatch",
        key: expectedKey,
        detail: `Expected implemented_verified but registry has engineStatus=${record.engineStatus}.`
      });
    }

    if (record.dataStatus !== "nflverse_pbp_derived") {
      findings.push({
        severity: "error",
        type: "pbp_derived_set_mismatch",
        key: expectedKey,
        detail: `Expected H2/H2.1 verified key to use nflverse_pbp_derived but registry has dataStatus=${record.dataStatus}.`
      });
    }
  }

  // --- 5. Cross-check known key definitions ---
  for (const record of SCORING_COVERAGE_REGISTRY) {
    const knownDef = getKnownScoringKeyDefinition(record.key);
    if (!knownDef) continue;

    // If the key has a known definition with dataCapabilityStatus, check for obvious conflicts
    if (knownDef.dataCapabilityStatus === "implementable_now_verified" &&
        record.dataStatus !== "nflverse_weekly_verified" &&
        record.dataStatus !== "nflverse_pbp_derived") {
      findings.push({
        severity: "warning",
        type: "known_definition_mismatch",
        key: record.key,
        detail: `key-definitions.ts says implementable_now_verified but registry dataStatus=${record.dataStatus}.`
      });
    }

    if (knownDef.dataCapabilityStatus === "unavailable_from_weekly_source" &&
        record.dataStatus === "nflverse_weekly_verified") {
      findings.push({
        severity: "error",
        type: "known_definition_mismatch",
        key: record.key,
        detail: `key-definitions.ts says unavailable_from_weekly_source but registry says nflverse_weekly_verified.`
      });
    }
  }

  // --- 6. Dual-position key sanity: these must appear in engine with DEF and IDP rules ---
  for (const key of DUAL_POSITION_KEYS) {
    const rules = SLEEPER_RULES_BY_KEY.get(key);
    if (!rules || rules.length < 2) {
      findings.push({
        severity: "warning",
        type: "engine_mismatch",
        key,
        detail: `Expected dual-position (DEF + IDP) rules but found only ${rules?.length ?? 0} rule(s).`
      });
    }
  }

  // --- 7. Data status suspicious checks ---
  for (const record of SCORING_COVERAGE_REGISTRY) {
    // Keys in offense positions should not be out_of_scope
    const isOffenseOnly = record.allowedPositions.length > 0 &&
      record.allowedPositions.every((p) => ["QB", "RB", "WR", "TE"].includes(p));
    if (isOffenseOnly && record.dataStatus === "out_of_scope") {
      findings.push({
        severity: "warning",
        type: "data_status_conflict",
        key: record.key,
        detail: `Key is offense-only (${record.allowedPositions.join(",")}) but dataStatus=out_of_scope.`
      });
    }
  }

  // --- Build summaries ---
  const dataStatusSummary = buildDataStatusSummary();
  const engineStatusSummary = buildEngineStatusSummary();
  const familySummary = buildFamilySummary();
  const sourceSummary = buildSourceSummary();
  const scopeSummary = buildScopeSummary();
  const verificationSummary = buildVerificationSummary();

  const operationalKeys = SCORING_COVERAGE_REGISTRY
    .filter((r) => r.engineStatus === "implemented_verified" &&
      (r.dataStatus === "nflverse_weekly_verified" || r.dataStatus === "nflverse_pbp_derived"))
    .map((r) => r.key)
    .sort();

  const dataGapKeys = SCORING_COVERAGE_REGISTRY
    .filter((r) => r.engineStatus !== "not_implemented" &&
      r.dataStatus !== "nflverse_weekly_verified" &&
      r.dataStatus !== "nflverse_pbp_derived" &&
      r.dataStatus !== "out_of_scope")
    .map((r) => r.key)
    .sort();

  const outOfScopeKeys = SCORING_COVERAGE_REGISTRY
    .filter((r) => deriveScopeClassification(r) === "deferred_current_phase")
    .map((r) => r.key)
    .sort();

  // --- Implementation roadmap: data-gap keys ranked by priority ---
  const implementationRoadmap = SCORING_COVERAGE_REGISTRY
    .filter((r) => dataGapKeys.includes(r.key))
    .sort((a, b) => roadmapPriority(a.dataStatus) - roadmapPriority(b.dataStatus));

  return {
    auditedAt,
    totalRegistryKeys: SCORING_COVERAGE_REGISTRY.length,
    totalEngineKeys: engineKeys.size,
    findings,
    dataStatusSummary,
    engineStatusSummary,
    familySummary,
    sourceSummary,
    scopeSummary,
    verificationSummary,
    operationalKeys,
    dataGapKeys,
    outOfScopeKeys,
    implementationRoadmap,
    h2VerificationEntries: buildH2VerificationEntries(),
    h4BacklogGroups: buildH4BacklogGroups()
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildDataStatusSummary(): Record<ScoringDataStatus, number> {
  const summary: Record<ScoringDataStatus, number> = {
    nflverse_weekly_verified: 0,
    nflverse_weekly_available: 0,
    nflverse_weekly_derivable: 0,
    nflverse_weekly_unwired: 0,
    nflverse_pbp_derived: 0,
    nflverse_pbp_derivable: 0,
    requires_team_game_context: 0,
    requires_new_source: 0,
    not_safely_derivable: 0,
    out_of_scope: 0
  };
  for (const record of SCORING_COVERAGE_REGISTRY) {
    summary[record.dataStatus] += 1;
  }
  return summary;
}

function buildEngineStatusSummary(): Record<ScoringEngineStatus, number> {
  const summary: Record<ScoringEngineStatus, number> = {
    implemented_verified: 0,
    implemented_unverified: 0,
    not_implemented: 0
  };
  for (const record of SCORING_COVERAGE_REGISTRY) {
    summary[record.engineStatus] += 1;
  }
  return summary;
}

function buildFamilySummary(): Record<ScoringStatFamily, number> {
  const summary: Record<ScoringStatFamily, number> = {
    passing_volume: 0,
    passing_outcomes: 0,
    rushing: 0,
    receiving: 0,
    miscellaneous_skill: 0,
    special_teams_skill: 0,
    first_down_bonuses: 0,
    yardage_threshold_bonuses: 0,
    long_td_bonuses: 0,
    position_rec_bonuses: 0,
    kicking: 0,
    team_defense: 0,
    idp: 0
  };
  for (const record of SCORING_COVERAGE_REGISTRY) {
    summary[record.family] += 1;
  }
  return summary;
}

function buildSourceSummary(): Record<ScoringSourceClassification, number> {
  const summary: Record<ScoringSourceClassification, number> = {
    nflverse_weekly_player_stats: 0,
    nflverse_pbp_derived_stats: 0,
    team_game_context: 0,
    deferred_position_source: 0
  };
  for (const record of SCORING_COVERAGE_REGISTRY) {
    summary[deriveSourceClassification(record)] += 1;
  }
  return summary;
}

function buildScopeSummary(): Record<ScoringScopeClassification, number> {
  const summary: Record<ScoringScopeClassification, number> = {
    operational_now: 0,
    current_scope_backlog: 0,
    deferred_current_phase: 0
  };
  for (const record of SCORING_COVERAGE_REGISTRY) {
    summary[deriveScopeClassification(record)] += 1;
  }
  return summary;
}

function buildVerificationSummary(): Record<ScoringVerificationLevel, number> {
  const summary: Record<ScoringVerificationLevel, number> = {
    real_play_verified: 0,
    repository_test_verified: 0
  };
  for (const record of SCORING_COVERAGE_REGISTRY) {
    summary[deriveVerificationLevel(record.key)] += 1;
  }
  return summary;
}

function deriveSourceClassification(record: typeof SCORING_COVERAGE_REGISTRY[number]): ScoringSourceClassification {
  if (
    record.dataStatus === "nflverse_weekly_verified" ||
    record.dataStatus === "nflverse_weekly_available" ||
    record.dataStatus === "nflverse_weekly_derivable" ||
    record.dataStatus === "nflverse_weekly_unwired"
  ) {
    return "nflverse_weekly_player_stats";
  }

  if (record.dataStatus === "nflverse_pbp_derived" || record.dataStatus === "nflverse_pbp_derivable") {
    return "nflverse_pbp_derived_stats";
  }

  if (record.dataStatus === "requires_team_game_context") {
    return "team_game_context";
  }

  return "deferred_position_source";
}

function deriveScopeClassification(record: typeof SCORING_COVERAGE_REGISTRY[number]): ScoringScopeClassification {
  if (record.dataStatus === "out_of_scope") {
    return "deferred_current_phase";
  }

  if (
    record.engineStatus === "implemented_verified" &&
    (record.dataStatus === "nflverse_weekly_verified" || record.dataStatus === "nflverse_pbp_derived")
  ) {
    return "operational_now";
  }

  return "current_scope_backlog";
}

function deriveVerificationLevel(key: string): ScoringVerificationLevel {
  return H2_VERIFIED_EXPECTED.has(key) ? "real_play_verified" : "repository_test_verified";
}

function buildH2VerificationEntries() {
  const evidence: Record<string, {
    realPlayVerificationEvidence: string;
    integrationTestEvidence: string;
  }> = {
    pass_pick6: {
      integrationTestEvidence:
        "src/lib/scoring/score-offense.test.ts — scoring with pass_pick6 and additive alias handling via pass_int_td.",
      realPlayVerificationEvidence:
        "Local archived 2025 nflverse PBP: game 2025_01_MIN_CHI, play 2188, week 1, passer J.McCarthy, qualifies as pick-six."
    },
    rec_td_40p: {
      integrationTestEvidence:
        "src/lib/scoring/score-offense.test.ts — long-TD derived stat scores through the live scoring engine when present.",
      realPlayVerificationEvidence:
        "Local archived 2025 nflverse PBP: game 2025_01_TB_ATL, play 110, week 1, receiver B.Robinson, 50-yard receiving TD."
    },
    rec_td_50p: {
      integrationTestEvidence:
        "src/lib/scoring/score-offense.test.ts — long-TD derived stat scores through the live scoring engine when present.",
      realPlayVerificationEvidence:
        "Local archived 2025 nflverse PBP: game 2025_01_TB_ATL, play 110, week 1, receiver B.Robinson, 50-yard receiving TD."
    },
    rush_td_40p: {
      integrationTestEvidence:
        "src/lib/scoring/score-offense.test.ts — long-TD derived stat scores through the live scoring engine when present.",
      realPlayVerificationEvidence:
        "Local archived 2025 nflverse PBP: game 2025_01_BAL_BUF, play 3313, week 1, rusher D.Henry, 46-yard rushing TD."
    },
    rush_td_50p: {
      integrationTestEvidence:
        "src/lib/scoring/score-offense.test.ts — long-TD derived stat scores through the live scoring engine when present.",
      realPlayVerificationEvidence:
        "Local archived 2025 nflverse PBP: game 2025_03_LV_WAS, play 1709, week 3, rusher J.McNichols, 60-yard rushing TD."
    }
  };

  return [...H2_VERIFIED_KEYS].map((key) => {
    const record = REGISTRY_BY_KEY.get(key)!;
    return {
      scoringKey: key,
      engineStatus: record.engineStatus,
      dataStatus: record.dataStatus,
      source: deriveSourceClassification(record),
      persistencePath:
        "src/lib/providers/nflverse/pbp/pipeline.ts -> public.player_weekly_derived_stats(stats_json, stat_scope=nflverse_pbp_derived)",
      scoringReadPath:
        "src/lib/scoring/server/derived-stats.ts -> mergeWithDerivedStats() -> src/lib/scoring/sleeper-keys.ts",
      unitTestEvidence:
        "src/lib/providers/nflverse/pbp/derive.test.ts — play classification, attribution, threshold, and invariant coverage.",
      integrationTestEvidence: evidence[key].integrationTestEvidence,
      realPlayVerificationEvidence: evidence[key].realPlayVerificationEvidence
    };
  });
}

function buildH4BacklogGroups() {
  return [
    buildBacklogGroup(
      "group_a_weekly_derivable",
      "Group A — derivable from existing weekly data",
      "Keys that can be computed from already-extracted weekly player stats without adding a new upstream source.",
      ["nflverse_weekly_derivable"],
      "Add a deterministic normalization derivation."
    ),
    buildBacklogGroup(
      "group_b_weekly_unwired",
      "Group B — source available but unwired",
      "Keys whose raw columns already exist in the nflverse weekly player stats artifact but are not yet normalized into canonical stats.",
      ["nflverse_weekly_unwired"],
      "Extend weekly column mapping and normalization."
    ),
    buildBacklogGroup(
      "group_ab_blocked_candidates",
      "Group A/B candidates blocked after verification",
      "Keys reviewed in the same quick-win tranche that could not be safely activated because the archived weekly source did not verify the needed field.",
      ["requires_new_source", "not_safely_derivable"],
      "Keep blocked until a verified source field exists."
    ),
    buildBacklogGroup(
      "group_c_additional_pbp_derivations",
      "Group C — additional PBP derivations",
      "Keys that still require more play-by-play-derived canonical stats beyond the H2/H2.1 set now in production.",
      ["nflverse_pbp_derivable"],
      "Extend the PBP derivation pipeline with a new derived canonical stat."
    ),
    buildBacklogGroup(
      "group_d_team_context_dependent",
      "Group D — team-context dependent",
      "Keys that depend on team-level game results rather than player stat rows or player-level PBP accumulation.",
      ["requires_team_game_context"],
      "Add a team game-result ingestion layer and team-defense aggregation."
    )
  ];
}

function buildBacklogGroup(
  id: "group_a_weekly_derivable" | "group_b_weekly_unwired" | "group_ab_blocked_candidates" | "group_c_additional_pbp_derivations" | "group_d_team_context_dependent",
  title: string,
  description: string,
  statuses: ScoringDataStatus[],
  recommendedPath: string
) {
  const keys = SCORING_COVERAGE_REGISTRY
    .filter((record) => statuses.includes(record.dataStatus))
    .map((record) => ({
      key: record.key,
      label: record.label,
      family: record.family,
      dataStatus: record.dataStatus,
      recommendedPath,
      blockers: record.blockers
    }));

  return {
    id,
    title,
    description,
    currentKeyCount: keys.length,
    keys
  };
}

function roadmapPriority(dataStatus: ScoringDataStatus): number {
  // Lower number = higher priority
  const order: Record<ScoringDataStatus, number> = {
    nflverse_weekly_verified: 0,      // already operational
    nflverse_pbp_derived: 0,          // already operational
    nflverse_weekly_derivable: 1,     // quick win: derive in normalize.ts
    nflverse_weekly_unwired: 2,       // easy: add columns to STAT_COLUMN_MAP
    nflverse_pbp_derivable: 3,        // medium: build PBP derivation pipeline
    nflverse_weekly_available: 4,     // already mapped, needs testing
    requires_team_game_context: 5,    // harder: needs team-game data pipeline
    requires_new_source: 6,           // harder: new data source needed
    not_safely_derivable: 7,          // do not implement
    out_of_scope: 8                   // deferred by design
  };
  return order[dataStatus];
}
