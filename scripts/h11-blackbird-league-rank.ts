import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdLeagueRank } from "@/lib/draft/blackbird-league-rank";
import { h1142LeagueContext, h1142Overlays, h1142Players } from "./h11-442-fixtures";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");
const players = h1142Players();
const first = buildBlackbirdLeagueRank({ players, overlays: h1142Overlays(), draftedPlayerIds: [], leagueContext: h1142LeagueContext });
const afterPicks = buildBlackbirdLeagueRank({ players, overlays: h1142Overlays(), draftedPlayerIds: ["sqb", "slb"], leagueContext: h1142LeagueContext });
const stable = first.rows.every((row) => afterPicks.rows.find((next) => next.playerId === row.playerId)?.blackbirdRank === row.blackbirdRank);
const checks = [
  check("drafted_and_undrafted_included", afterPicks.diagnostics.draftedPlayersIncluded === 2 && afterPicks.diagnostics.undraftedPlayersIncluded > 0, JSON.stringify(afterPicks.diagnostics)),
  check("rank_static_after_picks", stable, "rank map unchanged after simulated picks"),
  check("adp_not_primary", afterPicks.diagnostics.adpPrimarySignal === false && !afterPicks.diagnostics.orderingMethod.toLowerCase().includes("adp fallback"), afterPicks.diagnostics.orderingMethod),
  check("projection_units_visible", Object.values(afterPicks.diagnostics.projectionUnits).some((count) => count > 0), JSON.stringify(afterPicks.diagnostics.projectionUnits)),
  check("no_banned_language", afterPicks.diagnostics.bannedLanguageFound.length === 0, afterPicks.diagnostics.bannedLanguageFound.join(", ") || "none"),
];
const artifact = { generatedAt: new Date().toISOString(), verdict: checks.every((row) => row.passed) ? "passed" : "failed", diagnostics: afterPicks.diagnostics, sampleRows: afterPicks.rows.slice(0, 10), checks };
write("h11-blackbird-league-rank", artifact);
console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h11-blackbird-league-rank.json" }, null, 2));
if (artifact.verdict !== "passed") process.exitCode = 1;

function check(name: string, passed: boolean, detail: string) { return { name, passed, detail }; }
function write(name: string, artifact: unknown) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const json = JSON.stringify(artifact, null, 2);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.json`), json);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.md`), `# ${name}\n\n\`\`\`json\n${json}\n\`\`\`\n`);
}
