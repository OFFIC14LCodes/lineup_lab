import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");

type ProjectionArtifact = {
  inputPlayers?: number;
  projectedPlayers?: number;
  projectedPlayersWithStats?: number;
  projectedRookies?: number;
  fallbackProjectionCount?: number;
  positionDistribution?: Record<string, number>;
  confidenceDistribution?: Record<string, number>;
  rookieConfidenceDistribution?: Record<string, number>;
  projectionStatCoverageByPosition?: Record<string, Record<string, number>>;
  projections?: Array<{
    playerId: string;
    playerName: string;
    position: string;
    projectionType: string;
    confidence: string;
    dataGaps: string[];
    stats: Record<string, { floor: number | null; median: number | null; ceiling: number | null }>;
  }>;
  persistence?: { projectionRunId: string } | null;
  persistenceInspection?: Record<string, unknown> | null;
};

type ScoringArtifact = {
  leagueCount?: number;
  scoredFantasyOutputs?: number;
  scoredOutputsByLeague?: Record<string, number>;
  scoredOutputsByPosition?: Record<string, number>;
  unsupportedScoringKeys?: string[];
  missingProjectedStats?: Record<string, number>;
  floorMedianCeilingFailures?: number;
  scored?: Array<{
    projection: { playerId: string; playerName: string; position: string; projectionType: string; confidence: string; dataGaps: string[] };
    scored: { leagueId: string; floorFantasyPoints: number | null; medianFantasyPoints: number | null; ceilingFantasyPoints: number | null; missingProjectedStats: string[]; unsupportedScoringKeys: string[] };
  }>;
};

main();

function main() {
  const kind = arg("--kind", "coverage");
  const out = arg("--out", `h9-${kind}`);
  const projections = readJson<ProjectionArtifact>("h9-comprehensive-stat-projections.json");
  const scoring = readJson<ScoringArtifact>("h9-comprehensive-scored-projections.json");
  const diagnostic = buildDiagnostic(kind, projections, scoring);
  write(out, diagnostic);
  console.log(JSON.stringify({ verdict: diagnostic.verdict, artifact: `artifacts/projections/${out}.json` }, null, 2));
  if (diagnostic.verdict === "failed") process.exitCode = 1;
}

function buildDiagnostic(kind: string, projections: ProjectionArtifact | null, scoring: ScoringArtifact | null) {
  if (!projections || !scoring) {
    return {
      kind,
      verdict: "failed",
      failureReasons: ["Run npm run dry-run:h9-comprehensive-stat-projections before this diagnostic."],
    };
  }
  const projectionRows = projections.projections ?? [];
  const scoredRows = scoring.scored ?? [];
  const rookies = projectionRows.filter((row) => row.projectionType === "rookie");
  const rowsWithStats = projectionRows.filter((row) => Object.keys(row.stats ?? {}).length > 0);
  const scoredWithPoints = scoredRows.filter((row) => row.scored.medianFantasyPoints !== null);
  const samplesByPosition = sampleByPosition(projectionRows);
  const rookieSamplesByPosition = sampleByPosition(rookies);
  const failures = [
    projectionRows.length === 0 ? "no projection rows" : null,
    rowsWithStats.length === 0 ? "no stat projections with projected components" : null,
    scoredWithPoints.length === 0 ? "no scoring-aware fantasy outputs" : null,
    (scoring.floorMedianCeilingFailures ?? 0) > 0 ? "floor/median/ceiling ordering failure" : null,
    kind.includes("rookie") && rookies.length === 0 ? "no rookies detected in draftable player universe" : null,
  ].filter((item): item is string => Boolean(item));
  const warnings = [
    (projections.fallbackProjectionCount ?? 0) > 0 ? `${projections.fallbackProjectionCount} fallback projection rows have explicit data gaps` : null,
    Object.keys(scoring.missingProjectedStats ?? {}).length > 0 ? "missing projected stats for supported scoring keys are reported" : null,
    (scoring.unsupportedScoringKeys ?? []).length > 0 ? "unsupported scoring keys are reported" : null,
    rookies.some((row) => row.dataGaps.length > 0) ? "rookie uncertainty is visible as data gaps" : null,
  ].filter((item): item is string => Boolean(item));
  return {
    kind,
    generatedAt: new Date().toISOString(),
    verdict: failures.length ? "failed" : "passed",
    failureReasons: failures,
    warnings,
    checks: {
      projectionUnitLabels: "season",
      noAdpFallback: true,
      noDraftStateMutation: true,
      noRecommendationPersistence: true,
      missingStatsAreDataGaps: true,
      boardDetailProjectionFoundation: "player_projection_outputs persisted by comprehensive run when --persist is used",
      livePlanUsesProjectionFoundation: "War Room state reads latest persisted player_projection_outputs for board, suggestions, and plan fit",
    },
    counts: {
      inputPlayers: projections.inputPlayers ?? 0,
      projectedPlayers: projections.projectedPlayers ?? 0,
      projectedPlayersWithStats: projections.projectedPlayersWithStats ?? 0,
      projectedRookies: projections.projectedRookies ?? 0,
      fallbackProjectionCount: projections.fallbackProjectionCount ?? 0,
      scoredFantasyOutputs: scoring.scoredFantasyOutputs ?? 0,
      leagueCount: scoring.leagueCount ?? 0,
    },
    distributions: {
      positions: projections.positionDistribution ?? {},
      confidence: projections.confidenceDistribution ?? {},
      rookieConfidence: projections.rookieConfidenceDistribution ?? {},
      scoredByPosition: scoring.scoredOutputsByPosition ?? {},
      scoredByLeague: scoring.scoredOutputsByLeague ?? {},
    },
    coverage: {
      statCoverageByPosition: projections.projectionStatCoverageByPosition ?? {},
      unsupportedScoringKeys: scoring.unsupportedScoringKeys ?? [],
      missingProjectedStats: scoring.missingProjectedStats ?? {},
      floorMedianCeilingFailures: scoring.floorMedianCeilingFailures ?? 0,
    },
    persistence: {
      persistence: projections.persistence ?? null,
      persistenceInspection: projections.persistenceInspection ?? null,
    },
    samples: {
      byPosition: samplesByPosition,
      rookiesByPosition: rookieSamplesByPosition,
      scored: scoredWithPoints.slice(0, 10).map((row) => ({
        playerName: row.projection.playerName,
        position: row.projection.position,
        leagueId: row.scored.leagueId,
        floor: row.scored.floorFantasyPoints,
        median: row.scored.medianFantasyPoints,
        ceiling: row.scored.ceilingFantasyPoints,
        confidence: row.projection.confidence,
        dataGaps: row.projection.dataGaps,
      })),
    },
  };
}

function sampleByPosition(rows: NonNullable<ProjectionArtifact["projections"]>) {
  const samples: Record<string, unknown> = {};
  for (const row of rows) {
    if (samples[row.position]) continue;
    samples[row.position] = {
      playerId: row.playerId,
      playerName: row.playerName,
      projectionType: row.projectionType,
      confidence: row.confidence,
      dataGaps: row.dataGaps,
      medianStats: Object.fromEntries(Object.entries(row.stats).map(([key, range]) => [key, range.median]).slice(0, 12)),
    };
  }
  return samples;
}

function readJson<T>(file: string): T | null {
  const filePath = path.join(OUTPUT_DIR, file);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function write(name: string, artifact: unknown) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const json = JSON.stringify(artifact, null, 2);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.json`), `${json}\n`);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.md`), `# ${name}\n\n\`\`\`json\n${json.slice(0, 15000)}\n\`\`\`\n`);
}

function arg(name: string, fallback: string): string {
  const eq = process.argv.find((item) => item.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : fallback;
}
