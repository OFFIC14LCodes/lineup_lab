import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildBlackbirdBoard } from "@/lib/draft/blackbird-board";
import { buildBlackbirdLeagueRank } from "@/lib/draft/blackbird-league-rank";
import { h1142LeagueContext, h1142Overlays, h1142Players } from "./h11-442-fixtures";

const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "projections");
const players = h1142Players();
const overlays = h1142Overlays();
const board = buildBlackbirdBoard({ players, overlays, draftedPlayerIds: ["sqb"], leagueContext: h1142LeagueContext, includeDrafted: true });
const leagueRank = buildBlackbirdLeagueRank({ players, overlays, draftedPlayerIds: ["sqb"], leagueContext: h1142LeagueContext });
const rankByKey = new Map(leagueRank.rows.flatMap((row) => [[row.playerId, row], [row.playerName.toLowerCase(), row]] as const));

const rows = board.rows.slice(0, 12).map((row) => {
  const rank = (row.playerId ? rankByKey.get(row.playerId) : undefined) ?? rankByKey.get(row.playerName.toLowerCase());
  const idp = ["DL", "LB", "DB"].includes(row.position ?? "");
  const valuesMatch = row.projectionPoints === row.playerDetailContext?.projectedFantasyPoints.median && row.projectionPoints === rank?.projectedFantasyPoints.median;
  return {
    playerName: row.playerName,
    playerId: row.playerId,
    position: row.position,
    team: row.team,
    draftedStatus: row.drafted ? "drafted" : "available",
    projectionSource: row.projectionSource,
    projectionRunId: rank?.source.projectionRunId ?? null,
    projectionVersion: rank?.source.projectionVersion ?? null,
    projectionUnit: row.projectionUnit,
    displayedBoardProjection: row.projectionPoints,
    displayedDetailFloor: row.playerDetailContext?.projectedFantasyPoints.low ?? null,
    displayedDetailMedian: row.playerDetailContext?.projectedFantasyPoints.median ?? null,
    displayedDetailCeiling: row.playerDetailContext?.projectedFantasyPoints.high ?? null,
    contextualValueProjectionInput: rank?.projectedFantasyPoints.median ?? null,
    parInput: row.pointsAboveReplacement,
    h10OverlayProjection: row.source.overlay?.medianPoints ?? null,
    allProjectionValuesMatchExpectedSource: valuesMatch,
    idpProjectionSuspiciouslyLow: idp && (row.projectionPoints ?? 0) < 50,
    staleV2ProjectionSuspected: idp && (row.source.player.projected_points ?? 0) < 20 && (row.source.overlay?.medianPoints ?? 0) > 100 && row.projectionPoints !== row.source.overlay?.medianPoints,
    fallbackProjectionShownWithoutLabel: row.projectionUnit === "fallback" && !row.contextualDataGaps.includes("projection median"),
  };
});

const checks = [
  check("board_detail_contextual_projection_match", rows.every((row) => row.allProjectionValuesMatchExpectedSource), "board/detail/contextual values align"),
  check("no_starter_idp_single_digit", rows.every((row) => !row.idpProjectionSuspiciouslyLow), "IDP rows use corrected season scale"),
  check("projection_unit_known", rows.every((row) => row.projectionUnit !== "unknown"), "projection units explicit"),
  check("corrected_idp_overlay_used", rows.filter((row) => ["DL", "LB", "DB"].includes(row.position ?? "")).every((row) => row.projectionVersion === "idp_k_dst_v3_or_later"), "IDP v3-or-later marker present"),
  check("no_stale_v2_projection", rows.every((row) => !row.staleV2ProjectionSuspected), "overlay source wins over stale ranking fallback"),
  check("fallback_labeled", rows.every((row) => !row.fallbackProjectionShownWithoutLabel), "fallback rows are labeled"),
];

const artifact = { generatedAt: new Date().toISOString(), verdict: checks.every((row) => row.passed) ? "passed" : "failed", rows, checks };
write("h11-board-projection-integrity", artifact);
console.log(JSON.stringify({ verdict: artifact.verdict, artifact: "artifacts/projections/h11-board-projection-integrity.json" }, null, 2));
if (artifact.verdict !== "passed") process.exitCode = 1;

function check(name: string, passed: boolean, detail: string) {
  return { name, passed, detail };
}

function write(name: string, artifact: unknown) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const json = JSON.stringify(artifact, null, 2);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.json`), json);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.md`), `# ${name}\n\n\`\`\`json\n${json}\n\`\`\`\n`);
}
