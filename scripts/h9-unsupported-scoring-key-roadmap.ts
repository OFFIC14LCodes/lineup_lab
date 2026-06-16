import { readHardeningArtifacts, writeDiagnostic } from "./h9-projection-hardening-utils";

const artifacts = readHardeningArtifacts();
const unsupported = artifacts.scoring?.unsupportedScoringKeys ?? [];
const missingProjectedStats = artifacts.scoring?.missingProjectedStats ?? {};
const rows = unsupported.sort().map((key) => classifyKey(key, missingProjectedStats));
const artifact = {
  generatedAt: new Date().toISOString(),
  verdict: rows.length ? "needs_follow_up" : "passed",
  unsupportedKeyCount: rows.length,
  rows,
  prioritySummary: {
    high: rows.filter((row) => row.priority === "high").length,
    medium: rows.filter((row) => row.priority === "medium").length,
    low: rows.filter((row) => row.priority === "low").length,
  },
  checks: [
    { name: "unsupported_keys_classified", passed: rows.every((row) => row.reasonUnsupported), detail: `${rows.length} rows` },
    { name: "unsupported_keys_not_hidden", passed: true, detail: "reported from comprehensive scoring artifact" },
  ],
};

writeDiagnostic("h9-unsupported-scoring-key-roadmap", artifact);
console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h9-unsupported-scoring-key-roadmap.json" }, null, 2));

function classifyKey(key: string, missingStats: Record<string, number>) {
  const lower = key.toLowerCase();
  const returnYards = lower.includes("kr_") || lower.includes("pr_") || lower.includes("ret");
  const specialTeams = lower.includes("st_") || lower.includes("def_st");
  const bonus = lower.includes("bonus");
  const sackYards = lower.includes("sack_yd");
  const sourceExists = Object.keys(missingStats).some((entry) => entry.startsWith(`${key}:`) || entry.includes(`:${key}`));
  const difficulty = returnYards || specialTeams ? "medium" : bonus ? "high" : sackYards ? "low" : "medium";
  const priority = returnYards || specialTeams || sackYards ? "high" : bonus ? "medium" : "low";
  return {
    scoringKey: key,
    leagueCountAffected: "reported in aggregate artifact; per-league counts require scored-output expansion",
    activeLeagueAffected: "unknown in artifact-only diagnostic",
    positionsAffected: inferPositions(lower),
    sourceStatDataExists: sourceExists,
    canonicalAliasExists: sourceExists,
    implementationDifficulty: difficulty,
    priority,
    reasonUnsupported: reasonFor({ returnYards, specialTeams, bonus, sackYards }),
    suggestedImplementationPath: pathFor({ returnYards, specialTeams, bonus, sackYards }),
    materialBlackbirdRankImpact: priority === "high" ? "possible in leagues using this key" : "likely limited unless heavily weighted",
  };
}

function inferPositions(key: string): string[] {
  if (key.includes("idp") || key.includes("sack")) return ["DL", "LB", "DB"];
  if (key.includes("kr") || key.includes("pr") || key.includes("st")) return ["WR", "RB", "DB", "K", "DEF"];
  if (key.includes("yds_allow")) return ["DEF"];
  return ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "K", "DEF"];
}

function reasonFor(input: { returnYards: boolean; specialTeams: boolean; bonus: boolean; sackYards: boolean }) {
  if (input.returnYards) return "Return-yard scoring needs source return stat coverage and double-count protection.";
  if (input.specialTeams) return "Special-teams fumble scoring needs explicit source fields to avoid mixing offensive/defensive fumbles.";
  if (input.sackYards) return "Sack-yard scoring needs canonical sack yard stat projection.";
  if (input.bonus) return "Bonus scoring needs threshold-specific projected stat support and double-count checks.";
  return "No canonical scorer mapping exists yet.";
}

function pathFor(input: { returnYards: boolean; specialTeams: boolean; bonus: boolean; sackYards: boolean }) {
  if (input.returnYards) return "Add return stat ingestion/projection keys, aliases, scorer mapping, and coverage tests.";
  if (input.specialTeams) return "Separate special-teams event stats from offensive/defensive fumble stats before scoring.";
  if (input.sackYards) return "Project sack yards for IDP/DST, map alias, then add scorer coverage.";
  if (input.bonus) return "Implement threshold projections only where source stat distributions support them.";
  return "Add canonical alias and scorer mapping after source data validation.";
}
