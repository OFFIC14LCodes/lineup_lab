import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdLeagueRank } from "@/lib/draft/blackbird-league-rank";
import { buildLiveDraftSuggestions } from "@/lib/draft/live-draft-suggestion";
import { h1142LeagueContext, h1142Overlays, h1142Players } from "./h11-442-fixtures";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");
const leagueRank = buildBlackbirdLeagueRank({ players: h1142Players(), overlays: h1142Overlays(), draftedPlayerIds: ["sqb"], leagueContext: h1142LeagueContext });
const rbNeed = buildLiveDraftSuggestions({ leagueRankRows: leagueRank.rows, draftedPlayerIds: ["sqb"], positionNeeds: [{ position: "RB", needLevel: "urgent", deficit: 1 }], currentPickNumber: 24 });
const lbNeed = buildLiveDraftSuggestions({ leagueRankRows: leagueRank.rows, draftedPlayerIds: ["sqb"], positionNeeds: [{ position: "LB", needLevel: "urgent", deficit: 1 }], currentPickNumber: 24 });
const checks = [
  check("available_only", rbNeed.rows.every((row) => row.playerId !== "qb"), `rows=${rbNeed.rows.length}`),
  check("changes_with_roster_state", rbNeed.rows[0]?.playerId !== lbNeed.rows[0]?.playerId, `${rbNeed.rows[0]?.playerName} vs ${lbNeed.rows[0]?.playerName}`),
  check("rank_separate_from_blackbird", rbNeed.rows.some((row) => row.draftSuggestionRank !== row.blackbirdRank), "dynamic rank differs where live context requires it"),
  check("no_persistence", rbNeed.diagnostics.noPersistence, "read-only diagnostic"),
  check("no_banned_language", rbNeed.diagnostics.bannedLanguageFound.length === 0, rbNeed.diagnostics.bannedLanguageFound.join(", ") || "none"),
];
const artifact = { generatedAt: new Date().toISOString(), verdict: checks.every((row) => row.passed) ? "passed" : "failed", rbNeed: rbNeed.rows.slice(0, 8), lbNeed: lbNeed.rows.slice(0, 8), diagnostics: rbNeed.diagnostics, checks };
write("h11-live-draft-suggestions", artifact);
console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h11-live-draft-suggestions.json" }, null, 2));
if (artifact.verdict !== "passed") process.exitCode = 1;

function check(name: string, passed: boolean, detail: string) { return { name, passed, detail }; }
function write(name: string, artifact: unknown) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const json = JSON.stringify(artifact, null, 2);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.json`), json);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.md`), `# ${name}\n\n\`\`\`json\n${json}\n\`\`\`\n`);
}
