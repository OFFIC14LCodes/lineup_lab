import { describe, expect, it } from "vitest";

import { SLEEPER_RULES_BY_KEY } from "@/lib/scoring/sleeper-keys";

import { runCoverageAudit } from "./audit";
import { generateJsonReport, generateMarkdownReport } from "./report";
import { DATA_GAP_KEYS, H2_VERIFIED_KEYS, OPERATIONAL_KEYS, PBP_DERIVED_KEYS, REGISTRY_BY_KEY, SCORING_COVERAGE_REGISTRY } from "./registry";
import type { ScoringDataStatus, ScoringEngineStatus, ScoringScopeClassification, ScoringSourceClassification, ScoringStatFamily, ScoringVerificationLevel } from "./types";

// ---------------------------------------------------------------------------
// Valid enum values — keep in sync with coverage/types.ts
// ---------------------------------------------------------------------------

const VALID_ENGINE_STATUSES = new Set<ScoringEngineStatus>([
  "implemented_verified",
  "implemented_unverified",
  "not_implemented"
]);

const VALID_DATA_STATUSES = new Set<ScoringDataStatus>([
  "nflverse_weekly_verified",
  "nflverse_weekly_available",
  "nflverse_weekly_derivable",
  "nflverse_weekly_unwired",
  "nflverse_pbp_derived",
  "nflverse_pbp_derivable",
  "requires_team_game_context",
  "requires_new_source",
  "not_safely_derivable",
  "out_of_scope"
]);

const VALID_FAMILIES = new Set<ScoringStatFamily>([
  "passing_volume",
  "passing_outcomes",
  "rushing",
  "receiving",
  "miscellaneous_skill",
  "special_teams_skill",
  "first_down_bonuses",
  "yardage_threshold_bonuses",
  "long_td_bonuses",
  "position_rec_bonuses",
  "kicking",
  "team_defense",
  "idp"
]);

const VALID_SOURCES = new Set<ScoringSourceClassification>([
  "nflverse_weekly_player_stats",
  "nflverse_pbp_derived_stats",
  "team_game_context",
  "deferred_position_source"
]);

const VALID_SCOPE_CLASSIFICATIONS = new Set<ScoringScopeClassification>([
  "operational_now",
  "current_scope_backlog",
  "deferred_current_phase"
]);

const VALID_VERIFICATION_LEVELS = new Set<ScoringVerificationLevel>([
  "real_play_verified",
  "repository_test_verified"
]);

const KNOWN_DEFINITION_KEYS = [
  "pass_inc", "fum", "fum_ret_td", "kick_ret_yd", "punt_ret_yd", "return_td", "return_fd",
  "bonus_rec_rb", "bonus_rec_wr", "bonus_rec_te",
  "bonus_pass_cmp_25", "bonus_rush_att_20",
  "bonus_rush_rec_yd_100", "bonus_rush_rec_yd_200",
  "bonus_fd_qb", "bonus_fd_rb", "bonus_fd_wr", "bonus_fd_te",
  "pass_pick6", "pass_int_td",
  "rec_td_40p", "rec_td_50p", "rush_td_40p", "rush_td_50p"
];

describe("scoring coverage registry — structural invariants", () => {
  it("has no duplicate key IDs", () => {
    const keys = SCORING_COVERAGE_REGISTRY.map((r) => r.key);
    const unique = new Set(keys);
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(duplicates).toEqual([]);
    expect(unique.size).toBe(keys.length);
  });

  it("all engineStatus values are valid", () => {
    const invalid = SCORING_COVERAGE_REGISTRY.filter((r) => !VALID_ENGINE_STATUSES.has(r.engineStatus));
    expect(invalid.map((r) => `${r.key}:${r.engineStatus}`)).toEqual([]);
  });

  it("all dataStatus values are valid", () => {
    const invalid = SCORING_COVERAGE_REGISTRY.filter((r) => !VALID_DATA_STATUSES.has(r.dataStatus));
    expect(invalid.map((r) => `${r.key}:${r.dataStatus}`)).toEqual([]);
  });

  it("all family values are valid", () => {
    const invalid = SCORING_COVERAGE_REGISTRY.filter((r) => !VALID_FAMILIES.has(r.family));
    expect(invalid.map((r) => `${r.key}:${r.family}`)).toEqual([]);
  });

  it("every key in SLEEPER_RULES_BY_KEY has a registry entry", () => {
    const missing: string[] = [];
    for (const engineKey of SLEEPER_RULES_BY_KEY.keys()) {
      if (!REGISTRY_BY_KEY.has(engineKey)) {
        missing.push(engineKey);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every registry entry with implemented engine status has a rule in SLEEPER_RULES_BY_KEY", () => {
    const contradictions = SCORING_COVERAGE_REGISTRY
      .filter((r) => r.engineStatus.startsWith("implemented") && !SLEEPER_RULES_BY_KEY.has(r.key))
      .map((r) => r.key);
    expect(contradictions).toEqual([]);
  });

  it("nflverse_pbp_derived keys include the full derived-stat set", () => {
    const pbpDerivedKeys = [...PBP_DERIVED_KEYS].sort();
    expect(pbpDerivedKeys).toEqual(["fum_ret_td", "pass_int_td", "pass_pick6", "rec_td_40p", "rec_td_50p", "rush_td_40p", "rush_td_50p"]);
  });

  it("every key in KNOWN_KEY_DEFINITIONS has a registry entry", () => {
    const missing = KNOWN_DEFINITION_KEYS.filter((k) => !REGISTRY_BY_KEY.has(k));
    expect(missing).toEqual([]);
  });

  it("data-gap keys do not include operational or out-of-scope keys", () => {
    for (const key of DATA_GAP_KEYS) {
      const rec = REGISTRY_BY_KEY.get(key)!;
      expect(rec.dataStatus).not.toBe("nflverse_weekly_verified");
      expect(rec.dataStatus).not.toBe("nflverse_pbp_derived");
      expect(rec.dataStatus).not.toBe("out_of_scope");
    }
  });

  it("operational keys are all nflverse_weekly_verified or nflverse_pbp_derived with verified engine", () => {
    for (const key of OPERATIONAL_KEYS) {
      const rec = REGISTRY_BY_KEY.get(key)!;
      expect(["nflverse_weekly_verified", "nflverse_pbp_derived"]).toContain(rec.dataStatus);
      expect(rec.engineStatus).toBe("implemented_verified");
    }
  });

  it("registry contains exactly 119 unique keys", () => {
    expect(SCORING_COVERAGE_REGISTRY).toHaveLength(119);
  });
});

describe("scoring coverage audit — contradiction detection", () => {
  it("audit runs without throwing", () => {
    expect(() => runCoverageAudit()).not.toThrow();
  });

  it("audit produces zero error-severity findings", () => {
    const result = runCoverageAudit();
    const errors = result.findings.filter((f) => f.severity === "error");
    if (errors.length > 0) {
      console.error("Coverage audit errors:", JSON.stringify(errors, null, 2));
    }
    expect(errors).toEqual([]);
  });

  it("implementation roadmap is non-empty and contains only data-gap keys", () => {
    const result = runCoverageAudit();
    expect(result.implementationRoadmap.length).toBeGreaterThan(0);
    for (const r of result.implementationRoadmap) {
      expect(DATA_GAP_KEYS).toContain(r.key);
    }
  });

  it("each independent summary dimension reconciles to 119 keys", () => {
    const result = runCoverageAudit();
    const sum = (values: Record<string, number>) => Object.values(values).reduce((total, count) => total + count, 0);

    expect(sum(result.engineStatusSummary)).toBe(119);
    expect(sum(result.dataStatusSummary)).toBe(119);
    expect(sum(result.familySummary)).toBe(119);
    expect(sum(result.sourceSummary)).toBe(119);
    expect(sum(result.scopeSummary)).toBe(119);
    expect(sum(result.verificationSummary)).toBe(119);
  });

  it("summary dimensions only use expected classification values", () => {
    const result = runCoverageAudit();
    expect(Object.keys(result.sourceSummary).every((key) => VALID_SOURCES.has(key as ScoringSourceClassification))).toBe(true);
    expect(Object.keys(result.scopeSummary).every((key) => VALID_SCOPE_CLASSIFICATIONS.has(key as ScoringScopeClassification))).toBe(true);
    expect(Object.keys(result.verificationSummary).every((key) => VALID_VERIFICATION_LEVELS.has(key as ScoringVerificationLevel))).toBe(true);
  });

  it("all five H2/H2.1 keys are operational, PBP-backed, and verified", () => {
    const result = runCoverageAudit();
    const operationalSet = new Set(result.operationalKeys);

    for (const key of H2_VERIFIED_KEYS) {
      const record = REGISTRY_BY_KEY.get(key)!;
      const h2Entry = result.h2VerificationEntries.find((entry) => entry.scoringKey === key);

      expect(operationalSet.has(key)).toBe(true);
      expect(record.engineStatus).toBe("implemented_verified");
      expect(record.dataStatus).toBe("nflverse_pbp_derived");
      expect(h2Entry?.source).toBe("nflverse_pbp_derived_stats");
      expect(h2Entry?.realPlayVerificationEvidence.length).toBeGreaterThan(20);
    }
  });

  it("H4 backlog groups use corrected non-overlapping counts", () => {
    const result = runCoverageAudit();
    const counts = Object.fromEntries(result.h4BacklogGroups.map((group) => [group.id, group.currentKeyCount]));

    expect(counts.group_a_weekly_derivable).toBe(0);
    expect(counts.group_b_weekly_unwired).toBe(0);
    expect(counts.group_ab_blocked_candidates).toBe(1);
    expect(counts.group_c_additional_pbp_derivations).toBe(7);
    expect(counts.group_d_team_context_dependent).toBe(16);
  });

  it("H5.1 allowance keys remain gated until Sleeper DST semantics are verified", () => {
    const allowanceKeys = SCORING_COVERAGE_REGISTRY
      .filter((record) => record.key.startsWith("pts_allow_") || record.key.startsWith("yds_allow_"))
      .map((record) => record.key)
      .sort();

    expect(allowanceKeys).toHaveLength(16);
    for (const key of allowanceKeys) {
      expect(REGISTRY_BY_KEY.get(key)?.dataStatus).toBe("requires_team_game_context");
      expect(OPERATIONAL_KEYS).not.toContain(key);
    }
  });
});

describe("scoring coverage reports", () => {
  it("JSON report generates valid JSON with required top-level keys", () => {
    const result = runCoverageAudit();
    const json = generateJsonReport(result);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty("meta");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("registry");
    expect(parsed).toHaveProperty("findings");
    expect(parsed).toHaveProperty("implementationRoadmap");
    expect(parsed).toHaveProperty("h2VerifiedKeys");
    expect(parsed).toHaveProperty("h4Backlog");
  });

  it("Markdown report generates non-empty string with expected sections", () => {
    const result = runCoverageAudit();
    const md = generateMarkdownReport(result);
    expect(typeof md).toBe("string");
    expect(md.length).toBeGreaterThan(500);
    expect(md).toContain("# Scoring Coverage Audit Report");
    expect(md).toContain("## Implementation Roadmap");
    expect(md).toContain("## Full Registry");
    expect(md).toContain("## Operational Keys");
    expect(md).toContain("## H2 / H2.1 Verification Table");
    expect(md).toContain("## H4 Backlog Groups");
    expect(md).toContain("must not be added across sections");
    expect(md).not.toContain("four H2 PBP keys");
  });

  it("JSON and Markdown rely on the same corrected aggregation", () => {
    const result = runCoverageAudit();
    const json = JSON.parse(generateJsonReport(result));
    const md = generateMarkdownReport(result);

    expect(json.meta.operationalNowKeyCount).toBe(result.operationalKeys.length);
    expect(json.summary.scopeClassification.operational_now).toBe(result.scopeSummary.operational_now);
    expect(json.summary.scopeClassification.current_scope_backlog).toBe(result.scopeSummary.current_scope_backlog);
    expect(md).toContain(`| operational_now | ${result.scopeSummary.operational_now} |`);
    expect(md).toContain(`| current_scope_backlog | ${result.scopeSummary.current_scope_backlog} |`);
  });
});
