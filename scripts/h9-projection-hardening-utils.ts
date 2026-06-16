import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildProjectionTrust, type ProjectionTrust } from "@/lib/projections/projection-trust";

export const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");

export type ProjectionArtifactRow = {
  playerId: string;
  playerName: string;
  position: string;
  team?: string | null;
  projectionType: string;
  confidence: string;
  dataGaps: string[];
  stats: Record<string, { floor: number | null; median: number | null; ceiling: number | null }>;
};

export type ProjectionArtifact = {
  inputPlayers?: number;
  projectedPlayers?: number;
  projectedPlayersWithStats?: number;
  projectedRookies?: number;
  fallbackProjectionCount?: number;
  positionDistribution?: Record<string, number>;
  confidenceDistribution?: Record<string, number>;
  rookieConfidenceDistribution?: Record<string, number>;
  projections?: ProjectionArtifactRow[];
  persistence?: { projectionRunId?: string | null; reusedCompleteRun?: boolean } | null;
  persistenceInspection?: Record<string, unknown> | null;
};

export type ScoredArtifactRow = {
  projection: {
    playerId: string;
    playerName: string;
    position: string;
    projectionType: string;
    confidence: string;
    dataGaps: string[];
  };
  scored: {
    leagueId: string;
    floorFantasyPoints: number | null;
    medianFantasyPoints: number | null;
    ceilingFantasyPoints: number | null;
    missingProjectedStats: string[];
    unsupportedScoringKeys: string[];
  };
};

export type ScoringArtifact = {
  leagueCount?: number;
  scoredFantasyOutputs?: number;
  scoredOutputsByLeague?: Record<string, number>;
  scoredOutputsByPosition?: Record<string, number>;
  unsupportedScoringKeys?: string[];
  missingProjectedStats?: Record<string, number>;
  scored?: ScoredArtifactRow[];
};

export type ProjectionHardeningArtifacts = {
  projections: ProjectionArtifact | null;
  scoring: ScoringArtifact | null;
};

export function readHardeningArtifacts(): ProjectionHardeningArtifacts {
  return {
    projections: readJson<ProjectionArtifact>("h9-comprehensive-stat-projections.json"),
    scoring: readJson<ScoringArtifact>("h9-comprehensive-scored-projections.json"),
  };
}

export function buildProjectionTrustRows(artifacts: ProjectionHardeningArtifacts): ProjectionTrust[] {
  const projectionRunId = artifacts.projections?.persistence?.projectionRunId ?? null;
  const scoredByPlayer = new Map<string, ScoredArtifactRow[]>();
  for (const row of artifacts.scoring?.scored ?? []) {
    const key = playerKey(row.projection.playerId, row.projection.playerName, row.projection.position);
    scoredByPlayer.set(key, [...(scoredByPlayer.get(key) ?? []), row]);
  }

  return (artifacts.projections?.projections ?? []).map((row) => {
    const scoredRows = scoredByPlayer.get(playerKey(row.playerId, row.playerName, row.position)) ?? [];
    const firstScored = scoredRows.find((candidate) => candidate.scored.medianFantasyPoints !== null) ?? scoredRows[0];
    return buildProjectionTrust({
      playerId: row.playerId,
      playerName: row.playerName,
      position: row.position,
      team: row.team ?? null,
      projectionRunId,
      projectionVersion: "comprehensive-stat-projections-v1",
      projectionUnit: row.projectionType === "fallback" ? "fallback" : "season",
      projectionType: row.projectionType,
      confidence: row.confidence,
      dataGaps: row.dataGaps,
      stats: row.stats,
      floorPoints: firstScored?.scored.floorFantasyPoints ?? null,
      medianPoints: firstScored?.scored.medianFantasyPoints ?? null,
      ceilingPoints: firstScored?.scored.ceilingFantasyPoints ?? null,
      isFallback: row.projectionType === "fallback",
    });
  });
}

export function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

export function topEntries(counts: Record<string, number>, limit = 20) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

export function writeDiagnostic(name: string, artifact: unknown) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const json = JSON.stringify(artifact, null, 2);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.json`), `${json}\n`);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.md`), renderMarkdown(name, json));
}

export function arg(name: string, fallback: string | null = null): string | null {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0 && process.argv[exactIndex + 1]) return process.argv[exactIndex + 1];
  const eq = process.argv.find((item) => item.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : fallback;
}

export function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = trimmed.slice(sep + 1).trim().replace(/^['"]|['"]$/g, "");
  }
}

function readJson<T>(fileName: string): T | null {
  const filePath = path.join(OUTPUT_DIR, fileName);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function playerKey(id: string | null | undefined, name: string | null | undefined, position: string | null | undefined): string {
  return `${id ?? ""}|${(name ?? "").toLowerCase()}|${(position ?? "").toUpperCase()}`;
}

function renderMarkdown(name: string, json: string): string {
  return `# ${name}\n\n\`\`\`json\n${json.slice(0, 30000)}\n\`\`\`\n`;
}
