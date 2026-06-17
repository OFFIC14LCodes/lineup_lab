import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { BlackbirdBoardRow } from "@/lib/draft/blackbird-board";

import type { PlayerProfileEvidence } from "./player-profile-evidence";
import type { PlayerProfileReadModel } from "./player-profile-read-model";

export type ProfileEvidenceDiagnosticClassification =
  | "support"
  | "caution"
  | "hidden_value"
  | "profile_disagreement"
  | "profile_unavailable"
  | "insufficient_sample"
  | "neutral";

export type ProfileEvidenceDiagnosticSeverity =
  | "strong_support"
  | "mild_support"
  | "neutral"
  | "minor_caution"
  | "major_caution"
  | "mild_hidden_value"
  | "strong_hidden_value"
  | "profile_disagreement"
  | "profile_unavailable"
  | "insufficient_sample";

export type ProfileEvidenceDiagnosticsThresholds = {
  scoreCap: number;
  insufficientSampleGames: number;
  strongSupportScore: number;
  mildSupportScore: number;
  minorCautionScore: number;
  majorCautionScore: number;
  strongHiddenValueScore: number;
  mildHiddenValueScore: number;
  disagreementPositiveScore: number;
  disagreementNegativeScore: number;
  highRankThreshold: number;
  mildHiddenRankThreshold: number;
  strongHiddenRankThreshold: number;
  positiveDisagreementRankThreshold: number;
};

export type ProfileEvidenceDiagnosticBoardRow = Pick<
  BlackbirdBoardRow,
  | "playerId"
  | "playerName"
  | "position"
  | "team"
  | "blackbirdBoardRank"
  | "draftSuggestionRank"
  | "draftSuggestionScore"
  | "blackbirdValueScore"
  | "projectionPoints"
  | "projectionLow"
  | "projectionHigh"
>;

export type ProfileEvidenceDiagnosticInputRow = {
  boardRow: ProfileEvidenceDiagnosticBoardRow;
  profile: PlayerProfileReadModel | null;
  evidence: PlayerProfileEvidence;
  matchedBy?: string | null;
  duplicateKey?: string | null;
};

export type ProfileEvidenceDiagnosticRow = {
  playerId: string | null;
  playerName: string;
  position: string | null;
  team: string | null;
  sleeperId: string | null;
  gsisId: string | null;
  blackbirdRank: number | null;
  draftSuggestionRank: number | null;
  recommendationScore: number | null;
  valueScore: number | null;
  projection: {
    floor: number | null;
    median: number | null;
    ceiling: number | null;
  };
  profileAvailable: boolean;
  profileMatchedBy: string | null;
  profileDuplicateKey: string | null;
  profileMatchConfidence: string | null;
  scoringSource: PlayerProfileEvidence["scoringSource"];
  profileMetrics: {
    games: number | null;
    ppg: number | null;
    floor: number | null;
    median: number | null;
    ceiling: number | null;
    consistencyScore: number | null;
    spikeScore: number | null;
    availabilityScore: number | null;
  };
  positiveSignals: string[];
  cautionSignals: string[];
  badges: string[];
  profileEvidenceScore: number;
  severity: ProfileEvidenceDiagnosticSeverity;
  classification: ProfileEvidenceDiagnosticClassification;
  classificationReason: string;
  scoringNotes: string[];
};

export type ProfileEvidenceDiagnosticsResult = {
  generatedAt: string;
  dryRun: true;
  readOnly: true;
  draftRoomId: string | null;
  leagueId: string | null;
  totals: {
    playersEvaluated: number;
    profilesAvailable: number;
    profilesUnavailable: number;
    profileSupportCount: number;
    cautionCount: number;
    hiddenValueCount: number;
    disagreementCount: number;
    insufficientSampleCount: number;
    fallbackOrDefaultScoringCount: number;
    severityCounts: Record<ProfileEvidenceDiagnosticSeverity, number>;
  };
  categories: {
    strongSupport: ProfileEvidenceDiagnosticRow[];
    majorCautions: ProfileEvidenceDiagnosticRow[];
    strongHiddenValues: ProfileEvidenceDiagnosticRow[];
    profileDisagreements: ProfileEvidenceDiagnosticRow[];
    idpEvidenceStandouts: ProfileEvidenceDiagnosticRow[];
    strongConsistencyModestProjection: ProfileEvidenceDiagnosticRow[];
    spikeVolatilityCautions: ProfileEvidenceDiagnosticRow[];
    profileUnavailable: ProfileEvidenceDiagnosticRow[];
    fallbackOrDefaultScoring: ProfileEvidenceDiagnosticRow[];
  };
  thresholds: ProfileEvidenceDiagnosticsThresholds;
  rows: ProfileEvidenceDiagnosticRow[];
  limitations: string[];
  safety: {
    changesBlackbirdRank: false;
    changesDraftSuggestionOrder: false;
    changesProjectionGeneration: false;
    writesSupabase: false;
    writesProfileArtifact: false;
  };
};

const CATEGORY_LIMIT = 25;

const DEFAULT_THRESHOLDS: ProfileEvidenceDiagnosticsThresholds = {
  scoreCap: 100,
  insufficientSampleGames: 6,
  strongSupportScore: 45,
  mildSupportScore: 20,
  minorCautionScore: -15,
  majorCautionScore: -35,
  strongHiddenValueScore: 55,
  mildHiddenValueScore: 40,
  disagreementPositiveScore: 70,
  disagreementNegativeScore: -45,
  highRankThreshold: 25,
  mildHiddenRankThreshold: 150,
  strongHiddenRankThreshold: 300,
  positiveDisagreementRankThreshold: 500,
};

export function buildProfileEvidenceDiagnostics(input: {
  draftRoomId?: string | null;
  leagueId?: string | null;
  rows: ProfileEvidenceDiagnosticInputRow[];
  generatedAt?: string;
  maxRows?: number;
  limitations?: string[];
  thresholds?: Partial<ProfileEvidenceDiagnosticsThresholds>;
}): ProfileEvidenceDiagnosticsResult {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds };
  const diagnosticRows = input.rows
    .map((row) => toDiagnosticRow(row, thresholds, input.rows.length))
    .sort(sortDiagnosticRows)
    .slice(0, input.maxRows ?? input.rows.length);

  const categories = {
    strongSupport: cap(diagnosticRows.filter((row) => row.severity === "strong_support")),
    majorCautions: cap(diagnosticRows.filter((row) => row.severity === "major_caution")),
    strongHiddenValues: cap(diagnosticRows.filter((row) => row.severity === "strong_hidden_value")),
    profileDisagreements: cap(diagnosticRows.filter((row) => row.severity === "profile_disagreement")),
    idpEvidenceStandouts: cap(diagnosticRows.filter((row) => isIdp(row.position) && hasAnyBadge(row, ["idp-floor", "big-play"]))),
    strongConsistencyModestProjection: cap(
      diagnosticRows.filter((row) => {
        const consistency = row.profileMetrics.consistencyScore ?? 0;
        const ppg = row.profileMetrics.ppg ?? null;
        const projection = row.projection.median ?? null;
        return consistency >= 80 && ppg !== null && projection !== null && projection < ppg * 12;
      })
    ),
    spikeVolatilityCautions: cap(
      diagnosticRows.filter((row) => {
        const spike = row.profileMetrics.spikeScore ?? 0;
        return spike >= 70 && row.cautionSignals.some((signal) => /volatility|bust|floor|availability|sample/i.test(signal));
      })
    ),
    profileUnavailable: cap(diagnosticRows.filter((row) => row.severity === "profile_unavailable")),
    fallbackOrDefaultScoring: cap(diagnosticRows.filter((row) => row.scoringSource === "default" || row.scoringSource === "fallback")),
  };
  const severityCounts = countSeverity(diagnosticRows);

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    draftRoomId: input.draftRoomId ?? null,
    leagueId: input.leagueId ?? null,
    totals: {
      playersEvaluated: diagnosticRows.length,
      profilesAvailable: diagnosticRows.filter((row) => row.profileAvailable).length,
      profilesUnavailable: diagnosticRows.filter((row) => !row.profileAvailable).length,
      profileSupportCount: severityCounts.strong_support + severityCounts.mild_support,
      cautionCount: severityCounts.minor_caution + severityCounts.major_caution + severityCounts.insufficient_sample,
      hiddenValueCount: severityCounts.mild_hidden_value + severityCounts.strong_hidden_value,
      disagreementCount: severityCounts.profile_disagreement,
      insufficientSampleCount: severityCounts.insufficient_sample,
      fallbackOrDefaultScoringCount: diagnosticRows.filter((row) => row.scoringSource === "default" || row.scoringSource === "fallback").length,
      severityCounts,
    },
    categories,
    thresholds,
    rows: diagnosticRows,
    limitations: input.limitations ?? [
      "Historical profile evidence is observational only and is not included in Blackbird Rank.",
      "Historical profile evidence is observational only and is not included in Draft Suggestion ordering.",
    ],
    safety: {
      changesBlackbirdRank: false,
      changesDraftSuggestionOrder: false,
      changesProjectionGeneration: false,
      writesSupabase: false,
      writesProfileArtifact: false,
    },
  };
}

export function renderProfileEvidenceDiagnosticsMarkdown(result: ProfileEvidenceDiagnosticsResult): string {
  return [
    "# Historical Profile Evidence vs Draft Suggestions",
    "",
    `Generated: ${result.generatedAt}`,
    `Draft room: ${result.draftRoomId ?? "not provided"}`,
    `League: ${result.leagueId ?? "not provided"}`,
    `Dry run: ${result.dryRun}`,
    `Read-only: ${result.readOnly}`,
    "",
    "## Totals",
    "",
    `- Total players evaluated: ${result.totals.playersEvaluated}`,
    `- Profiles available: ${result.totals.profilesAvailable}`,
    `- Profiles unavailable: ${result.totals.profilesUnavailable}`,
    `- Profile support count: ${result.totals.profileSupportCount}`,
    `- Caution count: ${result.totals.cautionCount}`,
    `- Hidden value count: ${result.totals.hiddenValueCount}`,
    `- Disagreement count: ${result.totals.disagreementCount}`,
    `- Fallback/default scoring count: ${result.totals.fallbackOrDefaultScoringCount}`,
    "",
    "## Severity Counts",
    "",
    ...Object.entries(result.totals.severityCounts).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Scoring And Severity Thresholds",
    "",
    `- Evidence score cap: +/-${result.thresholds.scoreCap}`,
    `- Insufficient sample: fewer than ${result.thresholds.insufficientSampleGames} games`,
    `- Strong support: score >= ${result.thresholds.strongSupportScore}`,
    `- Mild support: score >= ${result.thresholds.mildSupportScore}`,
    `- Minor caution: score <= ${result.thresholds.minorCautionScore}`,
    `- Major caution: score <= ${result.thresholds.majorCautionScore}`,
    `- Strong hidden value: score >= ${result.thresholds.strongHiddenValueScore} and rank gap exceeds threshold`,
    `- Profile disagreement: high rank with score <= ${result.thresholds.disagreementNegativeScore}, or low rank with score >= ${result.thresholds.disagreementPositiveScore}`,
    `- Default scoring is reported as a note, not an automatic major caution.`,
    "",
    renderCategory("Top Strong Support", result.categories.strongSupport),
    renderCategory("Top Major Cautions", result.categories.majorCautions),
    renderCategory("Top Strong Hidden Values", result.categories.strongHiddenValues),
    renderCategory("Top Profile Disagreements", result.categories.profileDisagreements),
    renderCategory("Top IDP Evidence Standouts", result.categories.idpEvidenceStandouts),
    renderCategory("Strong Consistency With Modest Projection", result.categories.strongConsistencyModestProjection),
    renderCategory("Spike Profiles With Volatility Cautions", result.categories.spikeVolatilityCautions),
    renderCategory("Profile Unavailable", result.categories.profileUnavailable),
    renderCategory("Fallback Or Default Scoring", result.categories.fallbackOrDefaultScoring),
    "## Safety",
    "",
    `- Changes Blackbird Rank: ${result.safety.changesBlackbirdRank}`,
    `- Changes Draft Suggestion Order: ${result.safety.changesDraftSuggestionOrder}`,
    `- Changes Projection Generation: ${result.safety.changesProjectionGeneration}`,
    `- Writes Supabase: ${result.safety.writesSupabase}`,
    `- Writes Profile Artifact: ${result.safety.writesProfileArtifact}`,
    "",
    "## Limitations",
    "",
    ...result.limitations.map((limitation) => `- ${limitation}`),
    "",
  ].join("\n");
}

export function renderProfileEvidenceDiagnosticsCsv(result: ProfileEvidenceDiagnosticsResult): string {
  const header = [
    "classification",
    "severity",
    "player_name",
    "position",
    "team",
    "sleeper_id",
    "gsis_id",
    "blackbird_rank",
    "draft_suggestion_rank",
    "recommendation_score",
    "projection_median",
    "profile_evidence_score",
    "profile_available",
    "profile_match_confidence",
    "scoring_source",
    "profile_ppg",
    "consistency_score",
    "spike_score",
    "availability_score",
    "positive_signals",
    "caution_signals",
    "positive_signal_count",
    "caution_signal_count",
    "badges",
    "classification_reason",
  ];
  return [
    header.join(","),
    ...result.rows.map((row) =>
      [
        row.classification,
        row.severity,
        row.playerName,
        row.position ?? "",
        row.team ?? "",
        row.sleeperId ?? "",
        row.gsisId ?? "",
        row.blackbirdRank ?? "",
        row.draftSuggestionRank ?? "",
        row.recommendationScore ?? "",
        row.projection.median ?? "",
        row.profileEvidenceScore,
        row.profileAvailable,
        row.profileMatchConfidence ?? "",
        row.scoringSource,
        row.profileMetrics.ppg ?? "",
        row.profileMetrics.consistencyScore ?? "",
        row.profileMetrics.spikeScore ?? "",
        row.profileMetrics.availabilityScore ?? "",
        row.positiveSignals.join(" | "),
        row.cautionSignals.join(" | "),
        row.positiveSignals.length,
        row.cautionSignals.length,
        row.badges.join(" | "),
        row.classificationReason,
      ].map(csvCell).join(",")
    ),
  ].join("\n");
}

export function writeProfileEvidenceDiagnosticsArtifacts(
  result: ProfileEvidenceDiagnosticsResult,
  outputDir = path.join(process.cwd(), "artifacts", "projections")
) {
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "profile-evidence-diagnostics.json");
  const markdownPath = path.join(outputDir, "profile-evidence-diagnostics.md");
  const csvPath = path.join(outputDir, "profile-evidence-diagnostics.csv");
  writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(markdownPath, renderProfileEvidenceDiagnosticsMarkdown(result));
  writeFileSync(csvPath, `${renderProfileEvidenceDiagnosticsCsv(result)}\n`);
  return { jsonPath, markdownPath, csvPath };
}

function toDiagnosticRow(
  input: ProfileEvidenceDiagnosticInputRow,
  thresholds: ProfileEvidenceDiagnosticsThresholds,
  totalRows: number
): ProfileEvidenceDiagnosticRow {
  const profile = input.profile;
  const metrics = profile?.summaryMetrics ?? null;
  const baseRow: Omit<ProfileEvidenceDiagnosticRow, "classification" | "classificationReason" | "profileEvidenceScore" | "severity" | "scoringNotes"> = {
    playerId: input.boardRow.playerId,
    playerName: input.boardRow.playerName,
    position: input.boardRow.position,
    team: input.boardRow.team,
    sleeperId: profile?.identity.sleeper_id ?? null,
    gsisId: profile?.identity.gsis_id ?? null,
    blackbirdRank: numberOrNull(input.boardRow.blackbirdBoardRank),
    draftSuggestionRank: numberOrNull(input.boardRow.draftSuggestionRank),
    recommendationScore: numberOrNull(input.boardRow.draftSuggestionScore),
    valueScore: numberOrNull(input.boardRow.blackbirdValueScore),
    projection: {
      floor: numberOrNull(input.boardRow.projectionLow),
      median: numberOrNull(input.boardRow.projectionPoints),
      ceiling: numberOrNull(input.boardRow.projectionHigh),
    },
    profileAvailable: input.evidence.status === "available" && Boolean(profile),
    profileMatchedBy: input.matchedBy ?? null,
    profileDuplicateKey: input.duplicateKey ?? null,
    profileMatchConfidence: profile?.identity.match_confidence ?? null,
    scoringSource: input.evidence.scoringSource,
    profileMetrics: {
      games: metrics?.games ?? null,
      ppg: metrics?.points_per_game ?? null,
      floor: metrics?.floor ?? null,
      median: metrics?.median ?? null,
      ceiling: metrics?.ceiling ?? null,
      consistencyScore: metrics?.consistency_score ?? null,
      spikeScore: metrics?.spike_score ?? null,
      availabilityScore: metrics?.availability_score ?? null,
    },
    positiveSignals: [...input.evidence.positiveSignals],
    cautionSignals: [...input.evidence.cautionSignals],
    badges: [...input.evidence.badges],
  };
  const score = buildProfileEvidenceScore(baseRow, thresholds);
  const decision = classifyDiagnosticRow({ ...baseRow, profileEvidenceScore: score }, thresholds, totalRows);
  return {
    ...baseRow,
    profileEvidenceScore: score,
    severity: decision.severity,
    classification: decision.classification,
    classificationReason: decision.reason,
    scoringNotes: scoringNotes(baseRow),
  };
}

function classifyDiagnosticRow(
  row: Omit<ProfileEvidenceDiagnosticRow, "classification" | "classificationReason" | "severity" | "scoringNotes">,
  thresholds: ProfileEvidenceDiagnosticsThresholds,
  totalRows: number
): { classification: ProfileEvidenceDiagnosticClassification; severity: ProfileEvidenceDiagnosticSeverity; reason: string } {
  if (row.profileDuplicateKey || row.cautionSignals.some((signal) => /ambiguous/i.test(signal))) {
    return { classification: "profile_unavailable", severity: "profile_unavailable", reason: "Profile lookup is ambiguous, so no historical signal is applied." };
  }
  if (!row.profileAvailable) {
    return { classification: "profile_unavailable", severity: "profile_unavailable", reason: "No artifact-backed historical profile was found." };
  }
  const games = row.profileMetrics.games ?? 0;
  if (games < thresholds.insufficientSampleGames) {
    return { classification: "insufficient_sample", severity: "insufficient_sample", reason: `${games} game sample is below the ${thresholds.insufficientSampleGames}-game threshold.` };
  }

  const rankSignal = bestCurrentRank(row);
  const highRank = rankSignal !== null && rankSignal <= thresholds.highRankThreshold;
  const mildHiddenThreshold = dynamicRankThreshold(thresholds.mildHiddenRankThreshold, totalRows, 0.2);
  const strongHiddenThreshold = dynamicRankThreshold(thresholds.strongHiddenRankThreshold, totalRows, 0.3);
  const disagreementRankThreshold = dynamicRankThreshold(thresholds.positiveDisagreementRankThreshold, totalRows, 0.45);
  const lowRankForMildHidden = rankSignal !== null && rankSignal >= mildHiddenThreshold;
  const lowRankForStrongHidden = rankSignal !== null && rankSignal >= strongHiddenThreshold;
  const lowRankForDisagreement = rankSignal !== null && rankSignal >= disagreementRankThreshold;
  const acceptableConfidence = row.profileMatchConfidence === "exact_id" || row.profileMatchConfidence === "strong" || row.profileMatchConfidence === "medium";
  const leagueOrAcceptableScoring = row.scoringSource === "draft_room" || row.scoringSource === "league" || row.scoringSource === "default";

  if (highRank && row.profileEvidenceScore <= thresholds.disagreementNegativeScore) {
    return { classification: "profile_disagreement", severity: "profile_disagreement", reason: "Current rank is high, but historical profile score is materially negative." };
  }
  if (lowRankForDisagreement && row.profileEvidenceScore >= thresholds.disagreementPositiveScore && acceptableConfidence && leagueOrAcceptableScoring) {
    return { classification: "profile_disagreement", severity: "profile_disagreement", reason: "Current rank is low, but historical profile score is extremely positive." };
  }
  if (lowRankForStrongHidden && row.profileEvidenceScore >= thresholds.strongHiddenValueScore && acceptableConfidence && leagueOrAcceptableScoring) {
    return { classification: "hidden_value", severity: "strong_hidden_value", reason: "Historical score is strong and current rank is meaningfully lower than the profile signal." };
  }
  if (lowRankForMildHidden && row.profileEvidenceScore >= thresholds.mildHiddenValueScore && acceptableConfidence && leagueOrAcceptableScoring) {
    return { classification: "hidden_value", severity: "mild_hidden_value", reason: "Historical score is positive and current rank is lower than the profile signal." };
  }
  if (row.profileEvidenceScore >= thresholds.strongSupportScore) {
    return { classification: "support", severity: "strong_support", reason: "Historical profile score strongly supports the current board signal." };
  }
  if (row.profileEvidenceScore >= thresholds.mildSupportScore) {
    return { classification: "support", severity: "mild_support", reason: "Historical profile score mildly supports the current board signal." };
  }
  if (row.profileEvidenceScore <= thresholds.majorCautionScore) {
    return { classification: "caution", severity: "major_caution", reason: "Historical profile score has a meaningful negative signal." };
  }
  if (row.profileEvidenceScore <= thresholds.minorCautionScore) {
    return { classification: "caution", severity: "minor_caution", reason: "Historical profile score has a minor negative signal." };
  }
  return { classification: "neutral", severity: "neutral", reason: "Historical profile score is not strong enough to support or caution the current board signal." };
}

function buildProfileEvidenceScore(
  row: Omit<ProfileEvidenceDiagnosticRow, "classification" | "classificationReason" | "profileEvidenceScore" | "severity" | "scoringNotes">,
  thresholds: ProfileEvidenceDiagnosticsThresholds
) {
  if (!row.profileAvailable || row.profileDuplicateKey) return -5;
  let score = 0;
  const games = row.profileMetrics.games ?? 0;
  const confidence = row.profileMatchConfidence ?? "unknown";
  const position = row.position ?? "";
  const ppg = row.profileMetrics.ppg;
  const consistency = row.profileMetrics.consistencyScore;
  const availability = row.profileMetrics.availabilityScore;
  const floor = row.profileMetrics.floor;
  const ceiling = row.profileMetrics.ceiling;
  const spike = row.profileMetrics.spikeScore;

  if (confidence === "exact_id" || confidence === "strong") score += 10;
  else if (confidence === "medium") score -= 8;
  else if (confidence === "weak") score -= 28;
  else score -= 12;

  if (games >= 14) score += 12;
  else if (games >= 10) score += 8;
  else if (games >= thresholds.insufficientSampleGames) score += 2;
  else score -= 35;

  if (row.scoringSource === "draft_room" || row.scoringSource === "league") score += 5;
  else if (row.scoringSource === "fallback") score -= 5;

  if (ppg !== null) {
    if (ppg >= strongPpgThreshold(position)) score += 15;
    else if (ppg >= strongPpgThreshold(position) * 0.8) score += 6;
    else if (ppg <= lowPpgThreshold(position)) score -= 12;
  }

  if (consistency !== null) {
    if (consistency >= 85) score += 15;
    else if (consistency >= 75) score += 8;
    else if (consistency < 45) score -= 15;
    else if (consistency < 60) score -= 5;
  }

  if (availability !== null) {
    if (availability >= 90) score += 10;
    else if (availability >= 75) score += 5;
    else if (availability < 50) score -= 22;
    else if (availability < 65) score -= 10;
  }

  if (floor !== null) {
    if (floor >= strongFloorThreshold(position)) score += 8;
    else if (floor <= lowFloorThreshold(position)) score -= 10;
  }

  if (ceiling !== null && ceiling >= strongCeilingThreshold(position)) score += 6;
  if (spike !== null && spike >= 75) score += 6;
  if (spike !== null && spike >= 75 && ((floor !== null && floor <= lowFloorThreshold(position)) || (consistency !== null && consistency < 60))) {
    score -= 12;
  }

  if (row.badges.includes("idp-floor")) score += 8;
  if (row.badges.includes("big-play")) score += 5;
  if (row.badges.includes("rushing") || row.badges.includes("receiving")) score += 3;

  return clamp(score, -thresholds.scoreCap, thresholds.scoreCap);
}

function sortDiagnosticRows(a: ProfileEvidenceDiagnosticRow, b: ProfileEvidenceDiagnosticRow) {
  return (
    ascNullable(a.draftSuggestionRank, b.draftSuggestionRank) ||
    ascNullable(a.blackbirdRank, b.blackbirdRank) ||
    descNullable(a.recommendationScore, b.recommendationScore) ||
    a.playerName.localeCompare(b.playerName)
  );
}

function renderCategory(title: string, rows: ProfileEvidenceDiagnosticRow[]) {
  return [
    `## ${title}`,
    "",
    rows.length
      ? rows.map((row) => `- ${row.playerName} (${row.position ?? "?"}) - ${row.severity}; score=${row.profileEvidenceScore}, rank=${row.blackbirdRank ?? "n/a"}, suggestion=${row.draftSuggestionRank ?? "n/a"}, PPG=${format(row.profileMetrics.ppg)}, reason=${row.classificationReason}`).join("\n")
      : "- None",
    "",
  ].join("\n");
}

function countSeverity(rows: ProfileEvidenceDiagnosticRow[]): Record<ProfileEvidenceDiagnosticSeverity, number> {
  const keys: ProfileEvidenceDiagnosticSeverity[] = [
    "strong_support",
    "mild_support",
    "neutral",
    "minor_caution",
    "major_caution",
    "mild_hidden_value",
    "strong_hidden_value",
    "profile_disagreement",
    "profile_unavailable",
    "insufficient_sample",
  ];
  return Object.fromEntries(keys.map((key) => [key, rows.filter((row) => row.severity === key).length])) as Record<ProfileEvidenceDiagnosticSeverity, number>;
}

function bestCurrentRank(row: Pick<ProfileEvidenceDiagnosticRow, "draftSuggestionRank" | "blackbirdRank">) {
  return Math.min(row.draftSuggestionRank ?? 999999, row.blackbirdRank ?? 999999);
}

function dynamicRankThreshold(base: number, totalRows: number, fraction: number) {
  return Math.max(base, Math.floor(totalRows * fraction));
}

function scoringNotes(row: Pick<ProfileEvidenceDiagnosticRow, "scoringSource" | "profileMatchConfidence" | "profileMetrics">) {
  const notes: string[] = [];
  if (row.scoringSource === "default") notes.push("Default scoring used; this is a note, not an automatic major caution.");
  if (row.scoringSource === "fallback") notes.push("Fallback scoring used; league scoring was unavailable.");
  if (row.profileMatchConfidence === "medium") notes.push("Medium identity confidence is treated as a minor issue.");
  if (row.profileMatchConfidence === "weak") notes.push("Weak identity confidence is treated as a major issue.");
  if ((row.profileMetrics.games ?? 0) > 0 && (row.profileMetrics.games ?? 0) < DEFAULT_THRESHOLDS.insufficientSampleGames) notes.push("Low sample size limits diagnostic confidence.");
  return notes;
}

function strongPpgThreshold(position: string) {
  if (position === "QB") return 18;
  if (position === "K") return 8;
  if (["DL", "LB", "DB"].includes(position)) return 10;
  return 14;
}

function lowPpgThreshold(position: string) {
  if (position === "QB") return 10;
  if (position === "K") return 5;
  if (["DL", "LB", "DB"].includes(position)) return 5;
  return 7;
}

function strongFloorThreshold(position: string) {
  if (position === "QB") return 14;
  if (position === "K") return 6;
  if (["DL", "LB", "DB"].includes(position)) return 7;
  return 9;
}

function lowFloorThreshold(position: string) {
  if (position === "QB") return 7;
  if (position === "K") return 3;
  if (["DL", "LB", "DB"].includes(position)) return 3;
  return 4;
}

function strongCeilingThreshold(position: string) {
  if (position === "QB") return 25;
  if (position === "K") return 12;
  if (["DL", "LB", "DB"].includes(position)) return 14;
  return 20;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cap<T>(rows: T[]) {
  return rows.slice(0, CATEGORY_LIMIT);
}

function hasAnyBadge(row: ProfileEvidenceDiagnosticRow, badges: string[]) {
  return badges.some((badge) => row.badges.includes(badge));
}

function isIdp(position: string | null) {
  return position === "DL" || position === "LB" || position === "DB";
}

function numberOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ascNullable(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function descNullable(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function format(value: number | null) {
  return value === null ? "n/a" : value.toFixed(1);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
