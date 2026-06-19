import type { BlackbirdBoardRow } from "@/lib/draft/blackbird-board";
import { BLACKBIRD_RANK_AUDIT_WATCHLIST } from "@/lib/draft/blackbird-rank-quality-audit";
import {
  calibratePlayerTrustConfidence,
  type PlayerTrustConfidenceReasonCode,
} from "@/lib/draft/player-trust-confidence";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import { buildProjectionTrust } from "@/lib/projections/projection-trust";
import type {
  BlackbirdTrustMetadataAuditReport,
  BlackbirdTrustMetadataAuditRow,
  BlackbirdTrustMetadataRecommendation,
  BuildBlackbirdTrustMetadataAuditInput,
} from "./blackbird-trust-metadata-audit-types";

const WATCHLIST = [
  ...BLACKBIRD_RANK_AUDIT_WATCHLIST,
  "Nico Collins",
  "Brian Thomas",
  "Drake London",
  "Patrick Mahomes",
] as const;

const REASON_CODES: PlayerTrustConfidenceReasonCode[] = [
  "missing_projection_confidence",
  "missing_identity_confidence",
  "missing_roster_confirmation",
  "missing_sleeper_metadata",
  "missing_historical_profile",
  "fallback_projection",
  "source_expansion_policy",
  "manual_review_policy",
  "blocked_or_archive_policy",
  "trust_defaulted_low",
  "trust_field_not_mapped",
  "trust_overridden_by_data_gap",
  "strong_identity",
  "active_roster_confirmed",
  "projection_present",
  "market_evidence_present",
  "source_confidence_present",
];

type TrustSourcePlayer = ScoredDraftTarget & {
  activePolicyClass?: string | null;
  active_policy?: string | null;
  policyGroup?: string | null;
  confidence?: string | null;
  confidenceScore?: number | null;
  marketRank?: number | null;
  marketMatchType?: string | null;
  externalMarketMatchConfidence?: string | null;
  gsisId?: string | null;
};

export function buildBlackbirdTrustMetadataAudit(input: BuildBlackbirdTrustMetadataAuditInput): BlackbirdTrustMetadataAuditReport {
  const rows = (input.rows as BlackbirdBoardRow[])
    .filter((row) => !row.drafted)
    .sort((a, b) => a.blackbirdBoardRank - b.blackbirdBoardRank || a.playerName.localeCompare(b.playerName))
    .slice(0, input.topN ?? 300);
  const auditRows = rows.map(toAuditRow);
  const top100 = auditRows.slice(0, 100);
  const top100BeforeTrustDistribution = trustDistribution(top100.map((row) => row.raw_trust_label));
  const top100AfterTrustDistribution = trustDistribution(top100.map((row) => row.calibrated_trust_label));
  const reasonCounts = countReasons(auditRows);
  const recommendation = recommend({ rows: auditRows, top100AfterTrustDistribution });

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    readOnly: true,
    projectionSeason: input.projectionSeason,
    recommendation,
    rowsAudited: auditRows.length,
    top100BeforeTrustDistribution,
    top100AfterTrustDistribution,
    reasonCounts,
    watchlist: WATCHLIST.map((name) => watchlistRow(name, auditRows)),
    rows: auditRows,
    safetyGates: [
      { name: "dry_run_only", passed: true, detail: "Trust audit reads local rows and writes local report files only." },
      { name: "no_supabase_writes", passed: true, detail: "No Supabase client is imported or called." },
      { name: "v8_2_not_enabled", passed: true, detail: "Audit does not read or write v8.2 feature flags." },
      { name: "market_anchor_default_disabled", passed: true, detail: "ADP/market rank are evidence fields only; Market Anchor remains disabled by default." },
    ],
    marketAnchorEnabledByDefault: false,
    supabaseWrites: false,
    v82Enabled: false,
  };
}

export function renderBlackbirdTrustMetadataMarkdown(report: BlackbirdTrustMetadataAuditReport): string {
  const lines = [
    "# Blackbird Trust Metadata Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Projection season: ${report.projectionSeason}`,
    `Recommendation: ${report.recommendation}`,
    "",
    "## Executive Summary",
    "",
    "Raw projection trust was globally low because current enriched projection rows are uploaded/current-season projections without stat component, floor, and ceiling metadata. Calibrated trust now uses identity, active roster policy, projection presence, source confidence, and ADP availability as evidence quality signals while keeping blocked/archive/manual-review/fallback rows capped.",
    "",
    "## Top 100 Trust Distribution",
    "",
    `- Before: high=${report.top100BeforeTrustDistribution.high}, medium=${report.top100BeforeTrustDistribution.medium}, low=${report.top100BeforeTrustDistribution.low}, very_low=${report.top100BeforeTrustDistribution.very_low}`,
    `- After: high=${report.top100AfterTrustDistribution.high}, medium=${report.top100AfterTrustDistribution.medium}, low=${report.top100AfterTrustDistribution.low}, very_low=${report.top100AfterTrustDistribution.very_low}`,
    "",
    "## Reason Counts",
    "",
    ...Object.entries(report.reasonCounts).map(([reason, count]) => `- ${reason}: ${count}`),
    "",
    "## Watchlist",
    "",
    ...report.watchlist.map((row) => `- ${row.player_name}: raw=${row.raw_trust_label ?? "missing"}, calibrated=${row.calibrated_trust_label ?? "missing"}, rank=${row.blackbird_rank ?? "missing"}, reasons=${row.reason_codes.join("|") || "none"}`),
    "",
    "## Top Rows",
    "",
    ...report.rows.slice(0, 50).map((row) => `- #${row.blackbird_rank} ${row.player_name} ${row.position ?? ""}: raw=${row.raw_trust_label}, calibrated=${row.calibrated_trust_label}, policy=${row.active_policy ?? "n/a"}, market=${row.market_adp_available ? "yes" : "no"}, reasons=${row.reason_codes.join("|") || "none"}`),
    "",
    "## Safety",
    "",
    ...report.safetyGates.map((gate) => `- ${gate.name}: ${gate.passed ? "pass" : "fail"} - ${gate.detail}`),
    `- Market anchor enabled by default: ${report.marketAnchorEnabledByDefault}`,
    `- Supabase writes: ${report.supabaseWrites}`,
    `- v8.2 enabled: ${report.v82Enabled}`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

export function renderBlackbirdTrustMetadataCsv(report: BlackbirdTrustMetadataAuditReport): string {
  const header: Array<keyof BlackbirdTrustMetadataAuditRow> = [
    "player_name",
    "position",
    "team",
    "blackbird_rank",
    "raw_trust_label",
    "calibrated_trust_label",
    "confidence",
    "projection_points",
    "projection_ppg",
    "projection_source",
    "projection_confidence",
    "identity_confidence",
    "active_policy",
    "current_roster_confirmation",
    "sleeper_metadata_status",
    "market_adp_available",
    "historical_profile_available",
    "risk_label",
    "data_gaps",
    "reason_codes",
    "reason_trust_is_low_medium_high",
  ];
  return [
    header.join(","),
    ...report.rows.map((row) => header.map((key) => csvCell(Array.isArray(row[key]) ? (row[key] as string[]).join("|") : row[key])).join(",")),
  ].join("\n") + "\n";
}

function toAuditRow(row: BlackbirdBoardRow): BlackbirdTrustMetadataAuditRow {
  const player = row.source.player as TrustSourcePlayer;
  const rawTrust = buildProjectionTrust({
    playerId: row.playerId,
    playerName: row.playerName,
    position: row.position,
    team: row.team,
    projectionUnit: row.projectionUnit,
    projectionSource: row.projectionSource,
    confidence: player.confidence ?? confidenceFromPlayer(player),
    dataGaps: row.contextualDataGaps,
    floorPoints: row.projectionLow,
    medianPoints: row.projectionPoints,
    ceilingPoints: row.projectionHigh,
    isFallback: player.is_fallback || row.projectionUnit === "fallback",
    matchStatus: player.match_status,
  });
  const calibration = calibratePlayerTrustConfidence({
    playerName: row.playerName,
    position: row.position,
    team: row.team,
    currentTrust: rawTrust,
    currentConfidence: player.confidence ?? row.confidence,
    projectionPoints: row.projectionPoints,
    projectionSource: row.projectionSource,
    projectionUnit: row.projectionUnit,
    isFallback: player.is_fallback || row.projectionUnit === "fallback",
    matchStatus: player.match_status,
    matchConfidence: player.match_confidence,
    inputCompleteness: player.inputCompleteness,
    activePolicyClass: activePolicyFor(row),
    policyGroup: player.policyGroup ?? null,
    sourceConfidence: player.confidence ?? null,
    sourceConfidenceScore: player.confidenceScore ?? null,
    marketAdp: row.adp,
    marketRank: player.marketRank ?? player.rank,
    marketMatchType: player.marketMatchType ?? player.externalMarketMatchConfidence ?? null,
    sleeperId: player.sleeper_player_id,
    playerId: row.playerId,
    gsisId: player.gsisId ?? null,
    hasHistoricalProfile: null,
    dataGaps: row.contextualDataGaps,
  });
  return {
    player_name: row.playerName,
    position: row.position,
    team: row.team,
    blackbird_rank: row.blackbirdBoardRank,
    raw_trust_label: rawTrust.trustLabel,
    calibrated_trust_label: row.projectionTrust.trustLabel,
    confidence: row.confidence,
    projection_points: row.projectionPoints,
    projection_ppg: row.projectionPoints === null ? null : round(row.projectionPoints / 17),
    projection_source: row.projectionSource,
    projection_confidence: player.confidence ?? row.confidence,
    identity_confidence: identityConfidence(player),
    active_policy: activePolicyFor(row),
    current_roster_confirmation: currentRosterConfirmation(activePolicyFor(row)),
    sleeper_metadata_status: player.sleeper_player_id || row.playerId ? "available" : "missing",
    market_adp_available: row.adp !== null || player.marketRank !== null,
    historical_profile_available: null,
    risk_label: row.risk,
    data_gaps: row.contextualDataGaps,
    reason_codes: calibration.reasonCodes,
    reason_trust_is_low_medium_high: calibration.reasons.join(" "),
  };
}

function recommend(input: {
  rows: BlackbirdTrustMetadataAuditRow[];
  top100AfterTrustDistribution: Record<"high" | "medium" | "low" | "very_low", number>;
}): BlackbirdTrustMetadataRecommendation {
  if (!input.rows.length) return "blackbird_trust_metadata_blocked";
  if (input.top100AfterTrustDistribution.low + input.top100AfterTrustDistribution.very_low > 50) return "blackbird_trust_metadata_needs_data_fix";
  return "blackbird_trust_metadata_ready_for_manual_review";
}

function trustDistribution(labels: string[]): Record<"high" | "medium" | "low" | "very_low", number> {
  return {
    high: labels.filter((label) => label === "high").length,
    medium: labels.filter((label) => label === "medium").length,
    low: labels.filter((label) => label === "low").length,
    very_low: labels.filter((label) => label === "very_low").length,
  };
}

function countReasons(rows: BlackbirdTrustMetadataAuditRow[]): Record<PlayerTrustConfidenceReasonCode, number> {
  const counts = Object.fromEntries(REASON_CODES.map((code) => [code, 0])) as Record<PlayerTrustConfidenceReasonCode, number>;
  for (const row of rows) {
    for (const reason of row.reason_codes) counts[reason] += 1;
  }
  return counts;
}

function watchlistRow(playerName: string, rows: BlackbirdTrustMetadataAuditRow[]): BlackbirdTrustMetadataAuditReport["watchlist"][number] {
  const row = rows.find((candidate) => normalizedName(candidate.player_name) === normalizedName(playerName));
  if (!row) {
    return {
      player_name: playerName,
      matched: false,
      blackbird_rank: null,
      raw_trust_label: null,
      calibrated_trust_label: null,
      reason_codes: [],
      reason: "No matching draftable row was found.",
    };
  }
  return {
    player_name: playerName,
    matched: true,
    blackbird_rank: row.blackbird_rank,
    raw_trust_label: row.raw_trust_label,
    calibrated_trust_label: row.calibrated_trust_label,
    reason_codes: row.reason_codes,
    reason: row.reason_trust_is_low_medium_high,
  };
}

function activePolicyFor(row: BlackbirdBoardRow): string | null {
  const player = row.source.player as TrustSourcePlayer;
  return player.activePolicyClass ?? player.active_policy ?? player.policyGroup ?? null;
}

function currentRosterConfirmation(policy: string | null): string {
  const normalized = (policy ?? "").toLowerCase();
  if (normalized.includes("confirmed_active_clear") || normalized.includes("active_candidate")) return "confirmed_active";
  if (normalized.includes("blocked") || normalized.includes("archive")) return "blocked_archive";
  if (normalized.includes("manual") || normalized.includes("review")) return "review_required";
  return "missing";
}

function identityConfidence(player: TrustSourcePlayer): string | null {
  if (player.match_confidence !== null && player.match_confidence !== undefined) return String(player.match_confidence);
  if (player.match_status) return player.match_status;
  return player.externalMarketMatchConfidence ?? null;
}

function confidenceFromPlayer(player: ScoredDraftTarget): string {
  if (player.match_status === "ambiguous" || player.match_status === "unmatched") return "low";
  if (player.inputCompleteness === "full") return "medium";
  if (player.inputCompleteness === "partial") return "medium-low";
  return "limited";
}

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
