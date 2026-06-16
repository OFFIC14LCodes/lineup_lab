import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdLeagueRank } from "@/lib/draft/blackbird-league-rank";
import { buildLiveDraftSuggestions } from "@/lib/draft/live-draft-suggestion";
import { h1142LeagueContext, h1142Overlays, h1142Players } from "./h11-442-fixtures";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");
const rank = buildBlackbirdLeagueRank({ players: h1142Players(), overlays: h1142Overlays(), draftedPlayerIds: ["sqb"], leagueContext: h1142LeagueContext });
const suggestions = buildLiveDraftSuggestions({
  leagueRankRows: rank.rows,
  draftedPlayerIds: ["sqb"],
  positionNeeds: [{ position: "RB", needLevel: "urgent" }, { position: "K", needLevel: "filled" }, { position: "DEF", needLevel: "filled" }],
  currentPickNumber: 24,
});
const checks = [
  check("suggestion_differs_from_static_when_needed", suggestions.diagnostics.rankChangedFromStatic, "live score changes rank"),
  check("available_only", suggestions.rows.every((row) => row.playerId !== "qb"), "drafted QB excluded"),
  check("needs_recognized", suggestions.rows.some((row) => row.suggestionType === "need"), "need type present"),
  check("k_dst_not_overpushed_early", suggestions.rows.findIndex((row) => row.position === "K") > 3 && suggestions.rows.findIndex((row) => row.position === "DEF") > 3, "K/DST below core early"),
  check("idp_caveats_visible", suggestions.rows.filter((row) => ["DL", "LB", "DB"].includes(row.position)).some((row) => row.dataGaps.length || row.cautions.length), "IDP carries caveat/context"),
  check("superflex_qb_handled", rank.rows.some((row) => row.position === "QB" && row.valueComponents.superflexFit > 50), "QB superflex component elevated"),
  check("te_premium_handled", rank.rows.some((row) => row.position === "TE" && row.valueComponents.leagueFormatFit > 50), "TE premium component elevated"),
  check("best_ball_ceiling_handled", rank.rows.some((row) => row.position === "WR" && row.valueComponents.bestBallFit > 50), "WR ceiling component elevated"),
  check("no_banned_language", suggestions.diagnostics.bannedLanguageFound.length === 0, suggestions.diagnostics.bannedLanguageFound.join(", ") || "none"),
];
const artifact = { generatedAt: new Date().toISOString(), verdict: checks.every((row) => row.passed) ? "passed" : "failed", topSuggestions: suggestions.rows.slice(0, 10), checks };
write("h11-recommendation-quality", artifact);
console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h11-recommendation-quality.json" }, null, 2));
if (artifact.verdict !== "passed") process.exitCode = 1;

function check(name: string, passed: boolean, detail: string) { return { name, passed, detail }; }
function write(name: string, artifact: unknown) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const json = JSON.stringify(artifact, null, 2);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.json`), json);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.md`), `# ${name}\n\n\`\`\`json\n${json}\n\`\`\`\n`);
}
