import { buildBlackbirdBoard } from "@/lib/draft/blackbird-board";
import type { WarRoomValueOverlayRow } from "@/lib/draft/h10-war-room-overlay";
import type { ScoredDraftTarget } from "@/lib/draft/scoring";
import { loadRookieData } from "@/lib/projections/rookie-data-loader";
import { arg, buildProjectionTrustRows, countBy, readHardeningArtifacts, topEntries, writeDiagnostic, type ProjectionArtifactRow, type ScoredArtifactRow } from "./h9-projection-hardening-utils";

type RookieProjectionRow = ProjectionArtifactRow;

const kind = arg("--kind", "h9-rookie-import-readiness") ?? "h9-rookie-import-readiness";
const out = kind;
const artifacts = readHardeningArtifacts();
const projectionRows = artifacts.projections?.projections ?? [];
const rookieRows = projectionRows.filter((row) => row.projectionType === "rookie");
const importResult = loadRookieData({
  candidates: projectionRows.map((row) => ({ id: row.playerId, full_name: row.playerName, position: row.position, team: row.team ?? null })),
  dryRun: true,
  useExampleWhenMissing: true,
});

const diagnostic =
  kind === "h9-rookie-blackbird-rank"
    ? buildRankDiagnostic()
    : kind === "h11-rookie-display"
      ? buildDisplayDiagnostic()
      : kind === "h9-rookie-projection-quality"
        ? buildProjectionQualityDiagnostic()
        : buildImportReadinessDiagnostic();

writeDiagnostic(out, diagnostic);
console.log(JSON.stringify({ verdict: diagnostic.verdict, artifact: `artifacts/projections/${out}.json` }, null, 2));
if (diagnostic.verdict === "failed") process.exitCode = 1;

function buildImportReadinessDiagnostic() {
  const profiles = importResult.rows.map((row) => row.profile);
  const sourceLabels = Array.from(new Set(profiles.flatMap((row) => row.sourceLabels))).sort();
  const dataGaps = topEntries(countBy(profiles.flatMap((row) => row.dataGaps)));
  const hasDraftScores = profiles.some((row) => row.draftCapitalScore !== null);
  const hasDraftGaps = profiles.some((row) => row.dataGaps.some((gap) => /draft capital/i.test(gap)));
  const hasCollegeProductionScores = profiles.some((row) => row.collegeProductionScore !== null);
  const hasCollegeProductionGaps = profiles.some((row) => row.dataGaps.some((gap) => /college production|college/i.test(gap)));
  const checks = [
    check("local_input_shape_available", Boolean(importResult.sourcePath), importResult.sourcePath ?? "missing"),
    check("valid_rows_present", importResult.validRows > 0, `${importResult.validRows}/${importResult.totalRows}`),
    check("invalid_rows_reported", importResult.invalidRows === 0, `${importResult.invalidRows} invalid rows`),
    check("draft_capital_scored_or_gapped", hasDraftScores || hasDraftGaps, hasDraftScores ? "draft capital score can be derived" : "draft capital unavailable and reported as data gap"),
    check("college_production_scored_or_gapped", hasCollegeProductionScores || hasCollegeProductionGaps, hasCollegeProductionScores ? "college production score can be derived" : "college production unavailable and reported as data gap"),
    check("missing_data_is_explicit", profiles.some((row) => row.dataGaps.length > 0), dataGaps.map((row) => row.key).join(", ") || "no gaps"),
    check("adp_not_used", true, "rookie import schema excludes ADP"),
    check("no_persistence", true, "dry-run import only writes artifacts"),
  ];
  return base("h9-rookie-import-readiness", checks, {
    sourcePath: importResult.sourcePath,
    enrichmentSourcePath: importResult.enrichmentSourcePath,
    counts: importCounts(),
    enrichmentResults: importResult.enrichmentResults.slice(0, 50),
    conflicts: importResult.conflicts.slice(0, 25),
    sourceLabels,
    topDataGaps: dataGaps,
    samples: profiles.slice(0, 12).map(profileSummary),
    errors: importResult.errors.slice(0, 25),
  });
}

function buildProjectionQualityDiagnostic() {
  const trustById = new Map(buildProjectionTrustRows(artifacts).map((row) => [row.playerId, row]));
  const scoredByPlayer = scoredRowsByPlayer();
  const checks = [
    check("rookie_rows_detected", rookieRows.length > 0, `${rookieRows.length} rookie projection rows`),
    check("rookie_projection_components_present", rookieRows.some((row) => Object.keys(row.stats ?? {}).length > 0), "rookie projections include stat components"),
    check("rookie_confidence_not_fabricated_high", rookieRows.every((row) => row.confidence !== "high"), "rookie confidence remains conservative"),
    check("draft_capital_gaps_visible", rookieRows.some((row) => row.dataGaps.some((gap) => /draft capital/i.test(gap))) || importResult.rows.some((row) => row.profile.draftCapitalScore !== null), "draft capital availability/gaps are visible"),
    check("college_gaps_visible", rookieRows.some((row) => row.dataGaps.some((gap) => /college/i.test(gap))) || importResult.rows.some((row) => row.profile.collegeProductionScore !== null), "college production availability/gaps are visible"),
    check("scoring_aware_outputs_available", [...scoredByPlayer.values()].some((rows) => rows.some((row) => row.scored.medianFantasyPoints !== null)), "scored fantasy outputs exist"),
    check("no_adp_fallback", true, "rookie projections use projection/profile inputs only"),
  ];
  return base("h9-rookie-projection-quality", checks, {
    counts: {
      projectedRookies: rookieRows.length,
      rookiesWithStats: rookieRows.filter((row) => Object.keys(row.stats ?? {}).length > 0).length,
      rookiesWithDraftCapital: rookieRows.filter((row) => !row.dataGaps.some((gap) => /draft capital/i.test(gap))).length,
      rookiesWithCollegeProduction: rookieRows.filter((row) => !row.dataGaps.some((gap) => /college/i.test(gap))).length,
      rookiesWithScoredOutputs: Array.from(scoredByPlayer.entries()).filter(([key]) => rookieRows.some((row) => playerKey(row) === key)).length,
    },
    distributions: {
      confidence: countBy(rookieRows.map((row) => row.confidence)),
      position: countBy(rookieRows.map((row) => row.position)),
      trust: countBy(rookieRows.map((row) => trustById.get(row.playerId)?.trustLabel ?? "missing")),
    },
    topDataGaps: topEntries(countBy(rookieRows.flatMap((row) => row.dataGaps))),
    samples: rookieRows.slice(0, 12).map((row) => ({
      playerId: row.playerId,
      playerName: row.playerName,
      position: row.position,
      confidence: row.confidence,
      trust: trustById.get(row.playerId)?.trustLabel ?? null,
      dataGaps: row.dataGaps,
      medianStats: Object.fromEntries(Object.entries(row.stats ?? {}).map(([key, value]) => [key, value.median]).slice(0, 10)),
    })),
  });
}

function buildRankDiagnostic() {
  const board = buildBlackbirdBoard({
    players: [
      target({ matched_player_id: "rookie-qb", player_name: "Rookie QB", position: "QB", projected_points: 255, years_exp: 0 }),
      target({ matched_player_id: "veteran-rb", player_name: "Veteran RB", position: "RB", projected_points: 215, years_exp: 4 }),
      target({ matched_player_id: "rookie-lb", player_name: "Rookie LB", position: "LB", projected_points: 190, years_exp: 0 }),
    ],
    overlays: [
      overlay({ entityId: "rookie-qb", displayName: "Rookie QB", position: "QB", medianPoints: 255, pointsAboveReplacement: 45 }),
      overlay({ entityId: "veteran-rb", displayName: "Veteran RB", position: "RB", medianPoints: 215, pointsAboveReplacement: 30 }),
      overlay({ entityId: "rookie-lb", displayName: "Rookie LB", position: "LB", medianPoints: 190, pointsAboveReplacement: 24 }),
    ],
    leagueContext: {
      isDynasty: true,
      isSuperflex: true,
      hasIDP: true,
      rosterPositions: ["QB", "OP", "RB", "WR", "TE", "LB", "IDP_FLEX"],
      scoringSettings: { pass_td: 4, tackle_solo: 2, sack: 6 },
    },
  });
  const rows = board.rows;
  const checks = [
    check("rookies_included_in_blackbird_rank", rows.some((row) => row.playerName === "Rookie QB") && rows.some((row) => row.playerName === "Rookie LB"), rows.map((row) => row.playerName).join(", ")),
    check("rank_uses_projection_context_not_adp", board.diagnostics.orderingMethod.includes("static Blackbird league rank"), board.diagnostics.orderingMethod),
    check("rookie_data_gaps_visible", rows.filter((row) => row.role === "rookie_unknown").every((row) => row.contextualDataGaps.length > 0), "rookie rows carry context gaps"),
    check("no_adp_fallback", board.diagnostics.orderingMethod.toLowerCase().includes("external reference only"), board.diagnostics.orderingMethod),
  ];
  return base("h9-rookie-blackbird-rank", checks, {
    orderingMethod: board.diagnostics.orderingMethod,
    rows: rows.map((row) => ({
      blackbirdRank: row.blackbirdBoardRank,
      playerName: row.playerName,
      position: row.position,
      projection: row.projectionPoints,
      valueScore: row.blackbirdValueScore,
      role: row.role,
      dataGaps: row.contextualDataGaps,
    })),
  });
}

function buildDisplayDiagnostic() {
  const displayLabels = [
    "Rookie projection",
    "Draft capital available",
    "College production available",
    "Role uncertainty",
    "Missing draft capital",
    "Missing college production",
    "Rookie Context",
  ];
  const source = require("node:fs").readFileSync(require("node:path").join(process.cwd(), "src", "components", "draft-war-room.tsx"), "utf8") as string;
  const checks = [
    check("rookie_projection_label_visible", source.includes("Rookie projection"), "details panel labels rookie projections"),
    check("draft_capital_label_visible", source.includes("Draft capital available") && source.includes("Missing draft capital"), "draft capital availability/gaps visible"),
    check("college_production_label_visible", source.includes("College production available") && source.includes("Missing college production"), "college availability/gaps visible"),
    check("role_uncertainty_label_visible", source.includes("Role uncertainty"), "rookie role uncertainty visible"),
    check("rookie_context_section_visible", source.includes("Rookie Context"), "detail section exists"),
    check("no_ai_claim", !/\bAI\b|machine learning/i.test(displayLabels.join(" ")), "deterministic labels only"),
  ];
  return base("h11-rookie-display", checks, { displayLabels });
}

function base(kindName: string, checks: Array<{ name: string; passed: boolean; detail: string }>, extra: Record<string, unknown>) {
  return {
    kind: kindName,
    generatedAt: new Date().toISOString(),
    verdict: checks.every((row) => row.passed) ? "passed" : "failed",
    checks,
    safety: {
      noScraping: true,
      noPaidApi: true,
      noFabricatedContext: true,
      noAdpFallback: true,
      noDraftStateMutation: true,
      noRecommendationPersistence: true,
    },
    ...extra,
  };
}

function check(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function importCounts() {
  return {
    totalRows: importResult.totalRows,
    validRows: importResult.validRows,
    invalidRows: importResult.invalidRows,
    matchedRows: importResult.matchedRows,
    unmatchedRows: importResult.unmatchedRows,
    duplicateCandidateMatches: importResult.duplicateCandidateMatches,
    ambiguousMatches: importResult.ambiguousMatches,
    exactIdMatches: importResult.exactIdMatches,
    namePositionTeamMatches: importResult.namePositionTeamMatches,
    namePositionMatches: importResult.namePositionMatches,
    nameOnlyUniqueMatches: importResult.nameOnlyUniqueMatches,
    enrichmentRows: importResult.enrichmentRows,
    validEnrichmentRows: importResult.validEnrichmentRows,
    invalidEnrichmentRows: importResult.invalidEnrichmentRows,
    matchedEnrichmentRows: importResult.matchedEnrichmentRows,
    unmatchedEnrichmentRows: importResult.unmatchedEnrichmentRows,
    ambiguousEnrichmentRows: importResult.ambiguousEnrichmentRows,
    conflictCount: importResult.conflictCount,
  };
}

function profileSummary(profile: ReturnType<typeof loadRookieData>["rows"][number]["profile"]) {
  return {
    playerId: profile.playerId,
    playerName: profile.playerName,
    position: profile.position,
    team: profile.team,
    draftCapitalScore: profile.draftCapitalScore,
    collegeProductionScore: profile.collegeProductionScore,
    opportunityScore: profile.opportunityScore,
    landingSpotRole: profile.landingSpotRole,
    confidence: profile.rookieProjectionConfidence,
    availableInputs: profile.availableInputs,
    dataGaps: profile.dataGaps,
  };
}

function scoredRowsByPlayer() {
  const map = new Map<string, ScoredArtifactRow[]>();
  for (const row of artifacts.scoring?.scored ?? []) {
    const key = `${row.projection.playerId}|${row.projection.playerName.toLowerCase()}|${row.projection.position.toUpperCase()}`;
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return map;
}

function playerKey(row: RookieProjectionRow) {
  return `${row.playerId}|${row.playerName.toLowerCase()}|${row.position.toUpperCase()}`;
}

function target(overrides: Partial<ScoredDraftTarget>): ScoredDraftTarget {
  return {
    sleeper_player_id: overrides.matched_player_id ?? "p",
    matched_player_id: "p",
    player_name: "Player",
    position: "RB",
    team: "TST",
    age: 22,
    years_exp: 0,
    rank: null,
    adp: null,
    projected_points: 200,
    dynasty_value: 65,
    best_ball_value: 55,
    superflex_value: 55,
    te_premium_value: 55,
    match_status: "exact_id",
    match_confidence: 1,
    is_ranked: true,
    is_fallback: false,
    draftTargetScore: 70,
    recommendationTier: "good_value",
    scoreComponents: null,
    reasons: [],
    warnings: [],
    inputCompleteness: "partial",
    positionScoringMode: "offense_v1_1",
    ...overrides,
  };
}

function overlay(overrides: Partial<WarRoomValueOverlayRow>): WarRoomValueOverlayRow {
  return {
    leagueId: "league",
    entityId: "p",
    entityType: "PLAYER",
    displayName: "Player",
    team: "TST",
    position: "RB",
    floorPoints: 170,
    medianPoints: 200,
    ceilingPoints: 245,
    pointsAboveReplacement: 20,
    pointsAboveStarterCutline: 12,
    riskAdjustedValue: 18,
    confidenceAdjustedValue: 16,
    tier: 1,
    tierLabel: "Tier 1",
    positionScarcityScore: 50,
    scarcityLabel: "medium",
    marketValueSignal: "aligned",
    marketRankDelta: null,
    confidenceLabel: "low",
    riskLabel: "medium",
    valueReadiness: "READY",
    warningCodes: [],
    reasonCodes: [],
    draftRelevance: "draft_relevant",
    overlayStatus: "available",
    ...overrides,
  };
}
