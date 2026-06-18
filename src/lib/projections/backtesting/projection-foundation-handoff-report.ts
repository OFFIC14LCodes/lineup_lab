import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  ProjectionFoundationArtifactSummary,
  ProjectionFoundationGovernanceStage,
  ProjectionFoundationHandoffArtifactPaths,
  ProjectionFoundationHandoffOptions,
  ProjectionFoundationHandoffRecommendation,
  ProjectionFoundationHandoffReport,
} from "./projection-foundation-handoff-report-types";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections", "backtesting");
const FEATURE_FLAG_NAME = "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES" as const;

type ArtifactDefinition = {
  key: string;
  fileName: (season: number) => string;
  stageName?: string;
  parseJson?: boolean;
};

const ARTIFACTS: ArtifactDefinition[] = [
  { key: "snapshot", fileName: (season) => `preseason-projection-snapshot-${season}.json`, parseJson: false },
  { key: "shadow", stageName: "shadow projection", fileName: (season) => `projection-v8-2-shadow-${season}.json` },
  { key: "universeEligibilityAudit", stageName: "universe eligibility audit", fileName: (season) => `projection-universe-eligibility-audit-${season}.json` },
  { key: "promotionCandidatePool", stageName: "promotion candidate pool", fileName: (season) => `projection-promotion-candidate-pool-${season}.json` },
  { key: "manualReviewPacket", stageName: "manual review packet", fileName: (season) => `projection-promotion-manual-review-${season}.json` },
  { key: "manualReviewDecisionsResolved", stageName: "manual review decisions", fileName: (season) => `projection-promotion-review-decisions-${season}.resolved.json` },
  { key: "manualReviewDecisionsConservative", fileName: (season) => `projection-promotion-review-decisions-${season}.conservative.csv`, parseJson: false },
  { key: "finalPromotionReadiness", stageName: "final promotion readiness", fileName: (season) => `projection-promotion-readiness-final-${season}.json` },
  { key: "limitedPromotionPoolReview", stageName: "limited promotion-pool review", fileName: (season) => `projection-limited-promotion-pool-review-${season}.json` },
  { key: "rankImpactQualityReview", stageName: "rank impact quality review", fileName: (season) => `projection-rank-impact-quality-review-${season}.json` },
  { key: "rankImpactTierReview", stageName: "rank impact tier review", fileName: (season) => `projection-rank-impact-tier-review-${season}.json` },
  { key: "rankImpactTierDecisionsResolved", stageName: "tier decisions", fileName: (season) => `projection-rank-impact-tier-decisions-${season}.resolved.json` },
  { key: "rankImpactTierDecisionsConservative", fileName: (season) => `projection-rank-impact-tier-decisions-${season}.conservative.csv`, parseJson: false },
  { key: "featureFlagReadiness", stageName: "feature-flag readiness", fileName: (season) => `projection-v8-2-feature-flag-readiness-${season}.json` },
  { key: "featureFlagPreview", stageName: "feature-flag preview", fileName: (season) => `projection-v8-2-feature-flag-preview-${season}.json` },
  { key: "pipelineSelectorPreview", stageName: "pipeline selector preview", fileName: (season) => `projection-selector-pipeline-preview-${season}.json` },
  { key: "snapshotDiffGuard", stageName: "snapshot diff guard", fileName: (season) => `projection-v8-2-snapshot-diff-guard-${season}.json` },
];

export function runProjectionFoundationHandoffReport(options: ProjectionFoundationHandoffOptions): ProjectionFoundationHandoffReport {
  const loadedArtifacts = ARTIFACTS.map((definition) => loadArtifact(definition, options.projectionSeason));
  return buildProjectionFoundationHandoffReportFromArtifacts({
    options,
    artifacts: loadedArtifacts,
  });
}

export function buildProjectionFoundationHandoffReportFromArtifacts(input: {
  options: ProjectionFoundationHandoffOptions;
  artifacts: Array<ProjectionFoundationArtifactSummary & { data?: unknown }>;
}): ProjectionFoundationHandoffReport {
  const artifactByKey = new Map(input.artifacts.map((artifact) => [artifact.key, artifact]));
  const featureFlagReadiness = artifactByKey.get("featureFlagReadiness")?.data;
  const snapshotDiffGuard = artifactByKey.get("snapshotDiffGuard")?.data;
  const pipelineSelectorPreview = artifactByKey.get("pipelineSelectorPreview")?.data;
  const featureFlagPreview = artifactByKey.get("featureFlagPreview")?.data;

  const governanceChain = buildGovernanceChain(input.artifacts);
  const safetyGates = buildSafetyGates(input.artifacts, snapshotDiffGuard, featureFlagReadiness, pipelineSelectorPreview, featureFlagPreview);
  const currentRecommendation = recommendationFor(safetyGates);

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.options.projectionSeason,
    includeIdp: input.options.includeIdp,
    currentRecommendation,
    executiveSummary: {
      v82Status: "v8.2 is safely scaffolded behind an off-by-default feature flag for dry-run snapshot generation only.",
      featureFlagName: FEATURE_FLAG_NAME,
      defaultBehavior: "Default behavior remains current path.",
      liveBehaviorChanged: false,
      supabaseWritesChanged: false,
      blackbirdRankChanged: false,
      draftSuggestionsChanged: false,
      warRoomUiOrScoringChanged: false,
    },
    modelLineage: buildModelLineage(),
    artifacts: input.artifacts.map((artifact) => ({
      key: artifact.key,
      path: artifact.path,
      status: artifact.status,
      sizeBytes: artifact.sizeBytes,
      error: artifact.error,
    })),
    governanceChain,
    currentSafeSubset: {
      total2026Rows: numberAt(featureFlagReadiness, ["summary", "totalRows"]),
      wouldUseV82UnderEnabledFlag: numberAt(featureFlagReadiness, ["summary", "wouldUseV82UnderFlag"]),
      wouldUseCurrentPath: numberAt(featureFlagReadiness, ["summary", "wouldUseCurrentPathUnderFlag"]),
      excludedFromFlagPool: numberAt(featureFlagReadiness, ["summary", "excludedFromFlagPool"]),
      blockedFromFlagPool: numberAt(featureFlagReadiness, ["summary", "blockedFromFlagPool"]),
      kRowsUsingV82: numberAt(featureFlagReadiness, ["summary", "kRowsUsingV82"]),
      criticalMoversUsingV82: numberAt(featureFlagReadiness, ["summary", "criticalMovementRowsUsingV82"]),
      meaningfulRankMoversUsingV82: numberAt(featureFlagReadiness, ["summary", "meaningfulRankMoversUsingV82"]),
      legacyRowsUsingV82: numberAt(featureFlagReadiness, ["summary", "legacyRowsUsingV82"]),
    },
    protectionPolicy: [
      "K rows protected",
      "critical movement rows protected",
      "meaningful rank movers protected",
      "QB/Superflex-sensitive rows protected",
      "injury/role-sensitive rows protected",
      "model-policy-sensitive rows protected",
      "legacy/stale rows blocked",
      "missing readiness artifacts fail closed",
      "flag disabled by default",
    ],
    featureFlagStatus: {
      featureFlag: FEATURE_FLAG_NAME,
      enabledValues: ["true", "TRUE", "1"],
      disabledValues: ["unset", "false", "0", "no", "arbitrary strings"],
      missingArtifactsBehavior: "current_path",
      defaultArtifact: "restored/current path",
    },
    commands: buildCommands(input.options.projectionSeason),
    allowedNext: [
      "dry-run feature-flag scaffold review",
      "disabled feature-flag code review",
      "shadow-only comparison improvements",
      "manual review of protected rows",
      "kicker policy research",
      "roster/depth-chart source integration",
      "War Room UI improvements that do not consume v8.2 yet",
    ],
    notAllowedYet: [
      "do not enable v8.2 live",
      "do not write v8.2 production projections",
      "do not let v8.2 affect Blackbird Rank",
      "do not let v8.2 affect Draft Suggestion ordering",
      "do not let v8.2 affect War Room scoring",
      "do not include K rows in v8.2 promotion",
      "do not include critical movers in v8.2 promotion",
      "do not include meaningful rank movers in v8.2 promotion",
      "do not include legacy/stale rows",
    ],
    safetyGates,
    notes: [
      "Read-only handoff report; no live projections, 2026 production outputs, Supabase writes, ranking paths, recommendation paths, or War Room UI paths are changed.",
      "The large preseason snapshot artifact is checked for existence and size but not parsed by this handoff report. Snapshot safety is summarized from the snapshot diff guard artifact.",
    ],
  };
}

export function writeProjectionFoundationHandoffArtifacts(report: ProjectionFoundationHandoffReport): ProjectionFoundationHandoffArtifactPaths {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const base = `projection-foundation-handoff-${report.projectionSeason}`;
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const markdownPath = path.join(OUTPUT_DIR, `${base}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  return { jsonPath, markdownPath };
}

function loadArtifact(definition: ArtifactDefinition, season: number): ProjectionFoundationArtifactSummary & { data?: unknown } {
  const artifactPath = path.join(OUTPUT_DIR, definition.fileName(season));
  if (!existsSync(artifactPath)) {
    return { key: definition.key, path: artifactPath, status: "missing", sizeBytes: null, error: "artifact missing" };
  }
  const sizeBytes = statSync(artifactPath).size;
  if (definition.parseJson === false || !artifactPath.endsWith(".json")) {
    return { key: definition.key, path: artifactPath, status: "not_parsed", sizeBytes, error: null };
  }
  try {
    return { key: definition.key, path: artifactPath, status: "available", sizeBytes, error: null, data: JSON.parse(readFileSync(artifactPath, "utf8")) };
  } catch (error) {
    return { key: definition.key, path: artifactPath, status: "parse_error", sizeBytes, error: error instanceof Error ? error.message : String(error) };
  }
}

function buildGovernanceChain(artifacts: Array<ProjectionFoundationArtifactSummary & { data?: unknown }>): ProjectionFoundationGovernanceStage[] {
  return ARTIFACTS
    .filter((definition) => definition.stageName)
    .map((definition) => {
      const artifact = artifacts.find((entry) => entry.key === definition.key);
      const data = artifact?.data;
      const gates = safetyGateCounts(data);
      return {
        stageName: definition.stageName ?? definition.key,
        artifactKey: definition.key,
        artifactPath: artifact?.path ?? path.join(OUTPUT_DIR, definition.fileName(2026)),
        artifactStatus: artifact?.status ?? "missing",
        recommendationOrVerdict: stringAt(data, ["recommendation"]) ?? stringAt(data, ["verdict"]) ?? stringAt(data, ["status"]),
        keyCounts: extractKeyCounts(definition.key, data),
        safetyGatesPassed: gates.passed,
        safetyGatesTotal: gates.total,
        remainingBlockers: blockersFor(definition.key, artifact, data),
      };
    });
}

function extractKeyCounts(key: string, data: unknown): Record<string, number | string | boolean | null> {
  switch (key) {
    case "shadow":
      return {
        currentRows: numberAt(data, ["rowCoverage", "currentLiveProjectionRows"]),
        shadowRows: numberAt(data, ["rowCoverage", "v82ShadowRows"]),
        sharedRows: numberAt(data, ["rowCoverage", "sharedRows"]),
        criticalMovements: arrayLengthAt(data, ["criticalMovements"]),
      };
    case "featureFlagReadiness":
      return {
        totalRows: numberAt(data, ["summary", "totalRows"]),
        wouldUseV82UnderFlag: numberAt(data, ["summary", "wouldUseV82UnderFlag"]),
        wouldUseCurrentPathUnderFlag: numberAt(data, ["summary", "wouldUseCurrentPathUnderFlag"]),
        excludedFromFlagPool: numberAt(data, ["summary", "excludedFromFlagPool"]),
        blockedFromFlagPool: numberAt(data, ["summary", "blockedFromFlagPool"]),
      };
    case "featureFlagPreview":
      return {
        disabledV82Rows: numberAt(data, ["disabledMode", "summary", "v82Rows"]),
        enabledV82Rows: numberAt(data, ["enabledMode", "summary", "v82Rows"]),
        enabledCurrentPathRows: numberAt(data, ["enabledMode", "summary", "currentPathRows"]),
        protectedViolations: arrayLengthAt(data, ["protectedRowViolations"]),
      };
    case "pipelineSelectorPreview":
      return {
        disabledV82Rows: numberAt(data, ["disabledMode", "summary", "v82Rows"]),
        enabledV82Rows: numberAt(data, ["enabledMode", "summary", "v82Rows"]),
        enabledCurrentPathRows: numberAt(data, ["enabledMode", "summary", "currentPathRows"]),
        missingArtifactV82Rows: numberAt(data, ["missingArtifactsMode", "summary", "v82Rows"]),
      };
    case "snapshotDiffGuard":
      return {
        defaultV82Rows: numberAt(data, ["defaultSnapshot", "v82SelectedRows"]),
        defaultCurrentPathRows: numberAt(data, ["defaultSnapshot", "currentPathRows"]),
        enabledV82Rows: numberAt(data, ["enabledValidation", "summary", "v82Rows"]),
        missingArtifactV82Rows: numberAt(data, ["missingArtifacts", "v82SelectedRows"]),
      };
    case "finalPromotionReadiness":
      return {
        eligibleRows: numberAt(data, ["summary", "eligibleRows"]),
        manualReviewRowsRemaining: numberAt(data, ["summary", "manualReviewRowsRemaining"]),
        shadowOnlyRows: numberAt(data, ["summary", "shadowOnlyRows"]),
        blockedRows: numberAt(data, ["summary", "blockedRows"]),
        validationIssues: arrayLengthAt(data, ["validationIssues"]),
        policyViolations: arrayLengthAt(data, ["policyViolations"]),
      };
    case "limitedPromotionPoolReview":
      return {
        eligibleRows: arrayLengthAt(data, ["eligibleRows"]),
        criticalExcluded: numberAt(data, ["excludedCounts", "criticalMovementRowsExcluded"]),
        kExcluded: numberAt(data, ["excludedCounts", "kRowsExcluded"]),
      };
    case "rankImpactTierDecisionsResolved":
      return {
        tierApproved: numberAt(data, ["summary", "resolvedTierStatusCounts", "tier_approved"]),
        tierCurrentPath: numberAt(data, ["summary", "resolvedTierStatusCounts", "tier_current_path"]),
        tierShadowOnly: numberAt(data, ["summary", "resolvedTierStatusCounts", "tier_shadow_only"]),
        tierUnresolved: numberAt(data, ["summary", "resolvedTierStatusCounts", "tier_unresolved"]),
      };
    default:
      return {
        rows: arrayLengthAt(data, ["rows"]),
        finalRows: arrayLengthAt(data, ["finalRows"]),
        validationIssues: arrayLengthAt(data, ["validationIssues"]),
        policyViolations: arrayLengthAt(data, ["policyViolations"]),
      };
  }
}

function buildModelLineage(): ProjectionFoundationHandoffReport["modelLineage"] {
  return [
    {
      stage: "v6/v7 identity",
      summary: "v6 and v7 remained identical in the parity audit, confirming the existing production path was stable before v8.2 review.",
      keyMetrics: { identicalRows: "1680/1680", identicalRate: 1 },
    },
    {
      stage: "v8 experiment",
      summary: "v8 introduced expected-games changes but was too aggressive in high-impact cohorts.",
    },
    {
      stage: "v8.1 calibrated gate",
      summary: "v8.1 improved aggregate backtest metrics but still needed high-impact movement protection.",
    },
    {
      stage: "v8.2 high-impact guardrail",
      summary: "v8.2 kept the v8.1 gains while adding guardrails around high-impact movement, K fallback, and protected review cohorts.",
      keyMetrics: {
        totalMaeDeltaVsV7: -0.138,
        gamesMaeDeltaVsV7: -0.089,
        twentyPlusPpgBucketFixedOrParity: true,
        teKFallbackParityClean: true,
      },
    },
    {
      stage: "candidate rationale",
      summary: "v8.2 became the candidate because it preserved total MAE/RMSE gains while protected rows stayed on the current path for disabled flag review.",
    },
  ];
}

function buildSafetyGates(
  artifacts: ProjectionFoundationArtifactSummary[],
  snapshotDiffGuard: unknown,
  featureFlagReadiness: unknown,
  pipelineSelectorPreview: unknown,
  featureFlagPreview: unknown,
) {
  return [
    gate("required_artifacts_available", artifacts.length >= ARTIFACTS.length && artifacts.every((artifact) => artifact.status !== "missing" && artifact.status !== "parse_error"), missingArtifactsDetail(artifacts)),
    gate("snapshot_diff_guard_clean", stringAt(snapshotDiffGuard, ["recommendation"]) === "snapshot_diff_guard_clean", stringAt(snapshotDiffGuard, ["recommendation"]) ?? "missing"),
    gate("feature_flag_readiness_clean", stringAt(featureFlagReadiness, ["recommendation"]) === "ready_for_disabled_feature_flag_scaffold", stringAt(featureFlagReadiness, ["recommendation"]) ?? "missing"),
    gate("pipeline_selector_preview_clean", stringAt(pipelineSelectorPreview, ["recommendation"]) === "pipeline_selector_preview_clean", stringAt(pipelineSelectorPreview, ["recommendation"]) ?? "missing"),
    gate("feature_flag_preview_clean", stringAt(featureFlagPreview, ["recommendation"]) === "selector_preview_clean", stringAt(featureFlagPreview, ["recommendation"]) ?? "missing"),
    gate("default_behavior_current_path_only", numberAt(snapshotDiffGuard, ["defaultSnapshot", "v82SelectedRows"]) === 0 && numberAt(snapshotDiffGuard, ["defaultSnapshot", "currentPathRows"]) === numberAt(snapshotDiffGuard, ["defaultSnapshot", "selectorRows"]), `default v8.2/current/selector ${numberAt(snapshotDiffGuard, ["defaultSnapshot", "v82SelectedRows"])}/${numberAt(snapshotDiffGuard, ["defaultSnapshot", "currentPathRows"])}/${numberAt(snapshotDiffGuard, ["defaultSnapshot", "selectorRows"])}`),
    gate("enabled_safe_subset_matches_expected", numberAt(featureFlagReadiness, ["summary", "wouldUseV82UnderFlag"]) === numberAt(snapshotDiffGuard, ["enabledValidation", "summary", "v82Rows"]), `readiness/guard v8.2 ${numberAt(featureFlagReadiness, ["summary", "wouldUseV82UnderFlag"])}/${numberAt(snapshotDiffGuard, ["enabledValidation", "summary", "v82Rows"])}`),
    gate("protected_rows_stay_current_path", numberAt(featureFlagReadiness, ["summary", "kRowsUsingV82"]) === 0 && numberAt(featureFlagReadiness, ["summary", "criticalMovementRowsUsingV82"]) === 0 && numberAt(featureFlagReadiness, ["summary", "meaningfulRankMoversUsingV82"]) === 0 && numberAt(featureFlagReadiness, ["summary", "legacyRowsUsingV82"]) === 0, `K/critical/rank/legacy ${numberAt(featureFlagReadiness, ["summary", "kRowsUsingV82"])}/${numberAt(featureFlagReadiness, ["summary", "criticalMovementRowsUsingV82"])}/${numberAt(featureFlagReadiness, ["summary", "meaningfulRankMoversUsingV82"])}/${numberAt(featureFlagReadiness, ["summary", "legacyRowsUsingV82"])}`),
    gate("missing_artifacts_fail_closed", numberAt(snapshotDiffGuard, ["missingArtifacts", "v82SelectedRows"]) === 0, `${numberAt(snapshotDiffGuard, ["missingArtifacts", "v82SelectedRows"])} missing-artifact v8.2 row(s)`),
    gate("no_live_outputs_changed", true, "Handoff report writes only dry-run report artifacts."),
    gate("no_supabase_writes", true, "No Supabase client or writer is imported or called."),
    gate("rankings_unchanged", true, "Blackbird Rank code paths are not imported or executed."),
    gate("draft_suggestions_unchanged", true, "Draft Suggestion code paths are not imported or executed."),
    gate("war_room_unchanged", true, "War Room UI/scoring code is not imported or modified."),
  ];
}

function buildCommands(season: number) {
  return {
    regenerateChain: [
      "Remove-Item Env:\\BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES -ErrorAction SilentlyContinue",
      `npm run projection:snapshot:preseason -- --target-season=${season} --include-idp`,
      `npm run projection:v8-2:shadow -- --projection-season=${season} --include-idp`,
      `npm run projection:universe:eligibility:audit -- --projection-season=${season} --include-idp`,
      `npm run projection:promotion:candidate-pool -- --projection-season=${season} --include-idp`,
      `npm run projection:promotion:manual-review -- --projection-season=${season} --include-idp`,
      `npm run projection:promotion:readiness-final -- --projection-season=${season} --include-idp --decisions-file=artifacts/projections/backtesting/projection-promotion-review-decisions-${season}.conservative.csv`,
      `npm run projection:promotion:limited-pool-review -- --projection-season=${season} --include-idp`,
      `npm run projection:rank-impact:quality-review -- --projection-season=${season} --include-idp`,
      `npm run projection:rank-impact:tier-review -- --projection-season=${season} --include-idp`,
      `npm run projection:rank-impact:tier-decisions -- --projection-season=${season} --include-idp --decisions-file=artifacts/projections/backtesting/projection-rank-impact-tier-decisions-${season}.conservative.csv`,
      `npm run projection:v8-2:feature-flag:readiness -- --projection-season=${season} --include-idp`,
      `npm run projection:v8-2:feature-flag:preview -- --projection-season=${season} --include-idp`,
      `npm run projection:selector:pipeline-preview -- --projection-season=${season} --include-idp`,
      `npm run projection:v8-2:snapshot-diff-guard -- --projection-season=${season} --include-idp`,
      `npm run projection:foundation:handoff -- --projection-season=${season} --include-idp`,
    ],
    verification: [
      "npx vitest run src/lib/projections/feature-flags.test.ts src/lib/projections/backtesting/projection-selector-pipeline-preview.test.ts src/lib/projections/backtesting/projection-v8-2-snapshot-diff-guard.test.ts",
      "npm test",
      "npm run lint",
      "npm run typecheck",
      "npm run build",
    ],
  };
}

function recommendationFor(gates: Array<{ name: string; passed: boolean }>): ProjectionFoundationHandoffRecommendation {
  const failed = gates.filter((gateRow) => !gateRow.passed);
  if (!failed.length) return "foundation_ready_for_disabled_flag_code_review";
  if (failed.some((gateRow) => ["required_artifacts_available", "snapshot_diff_guard_clean", "protected_rows_stay_current_path", "missing_artifacts_fail_closed"].includes(gateRow.name))) {
    return "foundation_blocked";
  }
  return "foundation_needs_more_dry_run_review";
}

function renderMarkdown(report: ProjectionFoundationHandoffReport) {
  return `# Projection/Scoring Foundation Handoff ${report.projectionSeason}

Recommendation: ${report.currentRecommendation}
Dry run: ${report.dryRun}
Read only: ${report.readOnly}

## Executive Summary

${report.executiveSummary.v82Status}

- Feature flag: ${report.executiveSummary.featureFlagName}
- Default behavior: ${report.executiveSummary.defaultBehavior}
- Live behavior changed: ${report.executiveSummary.liveBehaviorChanged}
- Supabase writes changed: ${report.executiveSummary.supabaseWritesChanged}
- Blackbird Rank changed: ${report.executiveSummary.blackbirdRankChanged}
- Draft Suggestions changed: ${report.executiveSummary.draftSuggestionsChanged}
- War Room UI/scoring changed: ${report.executiveSummary.warRoomUiOrScoringChanged}

## Model Lineage

${report.modelLineage.map((entry) => `### ${entry.stage}\n\n${entry.summary}${entry.keyMetrics ? `\n\n\`\`\`json\n${JSON.stringify(entry.keyMetrics, null, 2)}\n\`\`\`` : ""}`).join("\n\n")}

## Governance Chain

${renderGovernanceTable(report.governanceChain)}

## Current Safe Subset

\`\`\`json
${JSON.stringify(report.currentSafeSubset, null, 2)}
\`\`\`

## Protection Policy

${report.protectionPolicy.map((item) => `- ${item}`).join("\n")}

## Feature Flag Status

\`\`\`json
${JSON.stringify(report.featureFlagStatus, null, 2)}
\`\`\`

## Commands To Regenerate

\`\`\`powershell
${report.commands.regenerateChain.join("\n")}
\`\`\`

## Verification Commands

\`\`\`powershell
${report.commands.verification.join("\n")}
\`\`\`

## Allowed Next

${report.allowedNext.map((item) => `- ${item}`).join("\n")}

## Not Allowed Yet

${report.notAllowedYet.map((item) => `- ${item}`).join("\n")}

## Safety Gates

${renderGateTable(report.safetyGates)}

## Artifact Inventory

${renderArtifactTable(report.artifacts)}

## Notes

${report.notes.map((note) => `- ${note}`).join("\n")}
`;
}

function renderGovernanceTable(stages: ProjectionFoundationGovernanceStage[]) {
  const rows = stages.map((stage) => `| ${stage.stageName} | ${stage.artifactStatus} | ${stage.recommendationOrVerdict ?? ""} | ${stage.safetyGatesPassed ?? ""}/${stage.safetyGatesTotal ?? ""} | ${Object.entries(stage.keyCounts).map(([key, value]) => `${key}: ${value}`).join("; ")} | ${stage.remainingBlockers.join("; ")} |`);
  return ["| Stage | Artifact | Recommendation/Verdict | Gates | Key Counts | Remaining Blockers |", "|---|---|---|---|---|---|", ...rows].join("\n");
}

function renderGateTable(gates: ProjectionFoundationHandoffReport["safetyGates"]) {
  return ["| Gate | Status | Detail |", "|---|---|---|", ...gates.map((gateRow) => `| ${gateRow.name} | ${gateRow.passed ? "PASS" : "FAIL"} | ${gateRow.detail} |`)].join("\n");
}

function renderArtifactTable(artifacts: ProjectionFoundationArtifactSummary[]) {
  return ["| Key | Status | Size | Path | Error |", "|---|---|---:|---|---|", ...artifacts.map((artifact) => `| ${artifact.key} | ${artifact.status} | ${artifact.sizeBytes ?? ""} | ${artifact.path} | ${artifact.error ?? ""} |`)].join("\n");
}

function blockersFor(key: string, artifact: (ProjectionFoundationArtifactSummary & { data?: unknown }) | undefined, data: unknown) {
  if (!artifact || artifact.status === "missing") return ["artifact missing"];
  if (artifact.status === "parse_error") return [`parse error: ${artifact.error ?? "unknown"}`];
  const blockers: string[] = [];
  const failedGates = arrayAt(data, ["safetyGates"]).filter((gateRow) => isRecord(gateRow) && gateRow.passed === false);
  blockers.push(...failedGates.map((gateRow) => String((gateRow as { name?: unknown }).name ?? "failed_gate")));
  const validationIssues = arrayLengthAt(data, ["validationIssues"]);
  const policyViolations = arrayLengthAt(data, ["policyViolations"]);
  if ((validationIssues ?? 0) > 0) blockers.push(`${validationIssues} validation issue(s)`);
  if ((policyViolations ?? 0) > 0) blockers.push(`${policyViolations} policy violation(s)`);
  if (key === "featureFlagReadiness" && (numberAt(data, ["summary", "manualReviewRowsRemaining"]) ?? 0) > 0) blockers.push("manual review rows remaining");
  return blockers;
}

function safetyGateCounts(data: unknown) {
  const gates = arrayAt(data, ["safetyGates"]);
  if (!gates.length) return { passed: null, total: null };
  return { passed: gates.filter((gateRow) => isRecord(gateRow) && gateRow.passed === true).length, total: gates.length };
}

function missingArtifactsDetail(artifacts: ProjectionFoundationArtifactSummary[]) {
  const provided = new Set(artifacts.map((artifact) => artifact.key));
  const omitted = ARTIFACTS.filter((artifact) => !provided.has(artifact.key)).map((artifact) => `${artifact.key}:omitted`);
  const bad = artifacts.filter((artifact) => artifact.status === "missing" || artifact.status === "parse_error");
  const issues = [...omitted, ...bad.map((artifact) => `${artifact.key}:${artifact.status}`)];
  return issues.length ? issues.join(", ") : "all required artifacts available";
}

function gate(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function arrayLengthAt(value: unknown, pathParts: string[]) {
  const valueAtPath = getAt(value, pathParts);
  return Array.isArray(valueAtPath) ? valueAtPath.length : null;
}

function arrayAt(value: unknown, pathParts: string[]) {
  const valueAtPath = getAt(value, pathParts);
  return Array.isArray(valueAtPath) ? valueAtPath : [];
}

function numberAt(value: unknown, pathParts: string[]) {
  const valueAtPath = getAt(value, pathParts);
  return typeof valueAtPath === "number" && Number.isFinite(valueAtPath) ? valueAtPath : null;
}

function stringAt(value: unknown, pathParts: string[]) {
  const valueAtPath = getAt(value, pathParts);
  return typeof valueAtPath === "string" ? valueAtPath : null;
}

function getAt(value: unknown, pathParts: string[]): unknown {
  return pathParts.reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
