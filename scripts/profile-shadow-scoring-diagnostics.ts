import path from "node:path";

import {
  buildProfileShadowScoring,
  type ProfileShadowPoolMode,
  writeProfileShadowScoringArtifacts,
} from "@/lib/player-profiles/player-profile-shadow-scoring";

import { arg, loadLocalEnv } from "./h9-projection-hardening-utils";
import { buildProfileEvidenceDiagnosticResult } from "./profile-evidence-diagnostics";

loadLocalEnv();

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const draftRoomId = arg("--draft-room-id");
  const poolMode = parsePoolMode(arg("--pool", "relevant"));
  const topN = Number(arg("--top", "410"));
  const { result: evidenceResult } = await buildProfileEvidenceDiagnosticResult(draftRoomId);
  const result = buildProfileShadowScoring({
    draftRoomId: evidenceResult.draftRoomId,
    leagueId: evidenceResult.leagueId,
    rows: evidenceResult.rows,
    poolMode,
    topN: Number.isFinite(topN) && topN > 0 ? topN : undefined,
  });
  const artifacts = writeProfileShadowScoringArtifacts(result);

  console.log("Blackbird Historical Profile Shadow Scoring Diagnostics");
  console.log(`  dry run: ${result.dryRun}`);
  console.log(`  read-only: ${result.readOnly}`);
  console.log(`  draft room: ${result.draftRoomId ?? "synthetic"}`);
  console.log(`  league: ${result.leagueId ?? "synthetic"}`);
  console.log(`  pool mode: ${result.pool.mode}`);
  console.log(`  candidates before filtering: ${result.pool.totalCandidatesBeforeFiltering}`);
  console.log(`  players evaluated: ${result.totals.playersEvaluated}`);
  console.log(`  average adjustment: ${result.totals.averageAdjustment}`);
  console.log(`  median adjustment: ${result.totals.medianAdjustment}`);
  console.log(`  max boost: ${result.totals.maxBoost}`);
  console.log(`  max penalty: ${result.totals.maxPenalty}`);
  console.log(`  boosted players: ${result.totals.boostedPlayers}`);
  console.log(`  penalized players: ${result.totals.penalizedPlayers}`);
  console.log(`  unchanged players: ${result.totals.unchangedPlayers}`);
  console.log(`  strong boosts: ${result.totals.strongBoostCount}`);
  console.log(`  strong penalties: ${result.totals.strongPenaltyCount}`);
  console.log(`  calibration verdict: ${result.calibration.verdict}`);
  console.log("  artifacts:");
  console.log(`    ${relative(artifacts.jsonPath)}`);
  console.log(`    ${relative(artifacts.markdownPath)}`);
  console.log(`    ${relative(artifacts.csvPath)}`);
}

function relative(filePath: string) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function parsePoolMode(value: string | null): ProfileShadowPoolMode {
  if (value === "all" || value === "topN" || value === "relevant") return value;
  return "relevant";
}
