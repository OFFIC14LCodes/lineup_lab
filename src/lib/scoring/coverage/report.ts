import { SCORING_COVERAGE_REGISTRY } from "./registry";
import type { CoverageAuditResult, ScoringCoverageRecord, ScoringDataStatus } from "./types";

// ---------------------------------------------------------------------------
// JSON report
// ---------------------------------------------------------------------------

export function generateJsonReport(result: CoverageAuditResult): string {
  const report = {
    meta: {
      auditedAt: result.auditedAt,
      totalRegistryKeys: result.totalRegistryKeys,
      totalEngineKeys: result.totalEngineKeys,
      operationalNowKeyCount: result.operationalKeys.length,
      currentScopeBacklogKeyCount: result.dataGapKeys.length,
      deferredCurrentPhaseKeyCount: result.outOfScopeKeys.length,
      findingCount: result.findings.length,
      errorCount: result.findings.filter((f) => f.severity === "error").length,
      warningCount: result.findings.filter((f) => f.severity === "warning").length
    },
    summary: {
      engineStatus: result.engineStatusSummary,
      dataAvailabilityStatus: result.dataStatusSummary,
      statFamily: result.familySummary,
      sourceClassification: result.sourceSummary,
      scopeClassification: result.scopeSummary,
      verificationLevel: result.verificationSummary
    },
    summaryNotes: [
      "Each summary dimension is independent and reconciles to 105 keys on its own.",
      "Do not add counts across independent dimensions.",
      "Only scopeClassification is intended as an implementation partition.",
      "Previous stale reporting misclassified pass_pick6 and pass_int_td as backlog even though the derived-stat pipeline and scoring merge path already supported them."
    ],
    operationalKeys: result.operationalKeys,
    currentScopeBacklogKeys: result.dataGapKeys,
    deferredCurrentPhaseKeys: result.outOfScopeKeys,
    h2VerifiedKeys: result.h2VerificationEntries,
    h4Backlog: result.h4BacklogGroups,
    findings: result.findings,
    implementationRoadmap: result.implementationRoadmap.map((r) => ({
      key: r.key,
      label: r.label,
      family: r.family,
      dataStatus: r.dataStatus,
      blockers: r.blockers,
      notes: r.notes
    })),
    registry: SCORING_COVERAGE_REGISTRY.map((r) => ({
      key: r.key,
      label: r.label,
      family: r.family,
      category: r.category,
      allowedPositions: r.allowedPositions,
      engineStatus: r.engineStatus,
      dataStatus: r.dataStatus,
      canonicalStatKey: r.canonicalStatKey,
      derivedStatExpression: r.derivedStatExpression,
      normalizedFrom: r.normalizedFrom,
      implementationPhase: r.implementationPhase,
      blockers: r.blockers,
      notes: r.notes
    }))
  };
  return JSON.stringify(report, null, 2);
}

// ---------------------------------------------------------------------------
// Markdown report
// ---------------------------------------------------------------------------

export function generateMarkdownReport(result: CoverageAuditResult): string {
  const lines: string[] = [];
  const {
    dataStatusSummary,
    engineStatusSummary,
    familySummary,
    sourceSummary,
    scopeSummary,
    verificationSummary
  } = result;
  const errors = result.findings.filter((f) => f.severity === "error");
  const warnings = result.findings.filter((f) => f.severity === "warning");

  lines.push("# Scoring Coverage Audit Report");
  lines.push("");
  lines.push(`**Audited:** ${result.auditedAt}`);
  lines.push(`**Registry keys:** ${result.totalRegistryKeys}  |  **Engine keys:** ${result.totalEngineKeys}`);
  lines.push(`**Findings:** ${errors.length} errors, ${warnings.length} warnings`);
  lines.push("");

  lines.push("## Coverage Status Overview");
  lines.push("");
  lines.push("Independent dimensions below are separate 105-key reconciliations. They overlap conceptually and must not be added across sections.");
  lines.push("Correction: the stale H3 report undercounted H2/H2.1 PBP support because `pass_pick6` and its alias `pass_int_td` were still classified as backlog after the derived-stat pipeline landed.");
  lines.push("");
  pushSummaryTable(lines, "### Engine Implementation Status", "Engine status", engineStatusSummary);
  pushSummaryTable(lines, "### Data Availability Status", "Data status", dataStatusSummary);
  pushSummaryTable(lines, "### Scope Classification", "Scope classification", scopeSummary);
  pushSummaryTable(lines, "### Source Classification", "Source classification", sourceSummary);
  pushSummaryTable(lines, "### Verification Level", "Verification level", verificationSummary);

  lines.push("## Keys by Stat Family");
  lines.push("");
  lines.push("| Family | Keys |");
  lines.push("|--------|------|");
  for (const [family, count] of Object.entries(familySummary).sort()) {
    lines.push(`| ${family} | ${count} |`);
  }
  lines.push("");

  lines.push("## H2 / H2.1 Verification Table");
  lines.push("");
  lines.push("| Scoring key | Engine status | Data status | Source | Persistence path | Scoring read path | Unit-test evidence | Integration-test evidence | Real-play verification evidence |");
  lines.push("|-------------|---------------|-------------|--------|------------------|-------------------|--------------------|---------------------------|---------------------------------|");
  for (const entry of result.h2VerificationEntries) {
    lines.push(
      `| \`${entry.scoringKey}\` | ${entry.engineStatus} | ${entry.dataStatus} | ${entry.source} | ${entry.persistencePath} | ${entry.scoringReadPath} | ${entry.unitTestEvidence} | ${entry.integrationTestEvidence} | ${entry.realPlayVerificationEvidence} |`
    );
  }
  lines.push("");

  if (result.findings.length === 0) {
    lines.push("## Findings");
    lines.push("");
    lines.push("No findings — registry is consistent with engine code.");
    lines.push("");
  } else {
    lines.push("## Findings");
    lines.push("");
    for (const finding of result.findings) {
      const icon = finding.severity === "error" ? "ERROR" : finding.severity === "warning" ? "WARN" : "INFO";
      lines.push(`- [${icon}] \`${finding.key}\` — ${finding.type}: ${finding.detail}`);
    }
    lines.push("");
  }

  lines.push("## Implementation Roadmap (Current-Scope Backlog)");
  lines.push("");

  if (result.implementationRoadmap.length === 0) {
    lines.push("All keys are operational or deferred.");
  } else {
    lines.push("Keys ordered by implementation effort (lowest to highest):");
    lines.push("");
    lines.push("| Key | Data status | Blocker |");
    lines.push("|-----|-------------|---------|");
    for (const r of result.implementationRoadmap) {
      const blocker = r.blockers.length > 0 ? r.blockers[0] : "—";
      lines.push(`| \`${r.key}\` | ${r.dataStatus} | ${blocker} |`);
    }
  }
  lines.push("");

  lines.push("## H4 Backlog Groups");
  lines.push("");
  for (const group of result.h4BacklogGroups) {
    lines.push(`### ${group.title}`);
    lines.push("");
    lines.push(group.description);
    lines.push("");
    lines.push(`Current key count: **${group.currentKeyCount}**`);
    lines.push("");
    lines.push("| Key | Family | Data status | Recommended path | Primary blocker |");
    lines.push("|-----|--------|-------------|------------------|-----------------|");
    for (const entry of group.keys) {
      lines.push(`| \`${entry.key}\` | ${entry.family} | ${entry.dataStatus} | ${entry.recommendedPath} | ${entry.blockers[0] ?? "—"} |`);
    }
    lines.push("");
  }

  lines.push("## Operational Keys");
  lines.push("");
  lines.push(result.operationalKeys.map((k) => `\`${k}\``).join(", "));
  lines.push("");

  lines.push("## Full Registry");
  lines.push("");
  lines.push("| Key | Label | Family | Engine | Data status | Phase |");
  lines.push("|-----|-------|--------|--------|-------------|-------|");
  for (const r of SCORING_COVERAGE_REGISTRY) {
    const phase = r.implementationPhase ?? "—";
    lines.push(`| \`${r.key}\` | ${r.label} | ${r.family} | ${r.engineStatus} | ${r.dataStatus} | ${phase} |`);
  }
  lines.push("");

  return lines.join("\n");
}

function pushSummaryTable(lines: string[], title: string, label: string, summary: Record<string, number>) {
  lines.push(title);
  lines.push("");
  lines.push(`| ${label} | Keys |`);
  lines.push(`|${"-".repeat(label.length + 2)}|------|`);
  for (const [status, count] of Object.entries(summary)) {
    lines.push(`| ${status} | ${count} |`);
  }
  lines.push("");
}

// ---------------------------------------------------------------------------
// Helpers: quick stats a CLI or test can use without running a full audit
// ---------------------------------------------------------------------------

export function countByDataStatus(status: ScoringDataStatus): number {
  return SCORING_COVERAGE_REGISTRY.filter((r) => r.dataStatus === status).length;
}

export function getRegistryKeysByDataStatus(status: ScoringDataStatus): ScoringCoverageRecord[] {
  return SCORING_COVERAGE_REGISTRY.filter((r) => r.dataStatus === status);
}
