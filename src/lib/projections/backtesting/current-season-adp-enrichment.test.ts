import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  matchCurrentAdpRows,
  runCurrentSeasonAdpEnrichment,
  writeCurrentSeasonAdpEnrichmentArtifacts,
} from "./current-season-adp-enrichment";
import type { HistoricalAdpNormalizedRow } from "./historical-adp-source-types";

describe("current season ADP enrichment", () => {
  it("discovers current universe sources and filters Superflex ADP rows", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "current-adp-"));
    try {
      const fixture = writeFixtures(cwd);

      const report = runCurrentSeasonAdpEnrichment({
        season: 2026,
        marketFormat: "SUPERFLEX",
        adpPath: fixture.adpPath,
        snapshotPath: fixture.snapshotPath,
        activePolicyPath: fixture.activePolicyPath,
        cwd,
      });

      expect(report.sourceDiscovery).toMatchObject({
        adpExists: true,
        snapshotExists: true,
        activePolicyExists: true,
        currentUniverseRows: 6,
      });
      expect(report.matchQuality.adpRowsForSelectedMarketFormat).toBe(6);
      expect(report.warRoomSafetyPreview.superflexMarketRowsAvailable).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("matches exact IDs, name/team/position, and unique name/position rows", () => {
    const universe = [
      universePlayer({ playerId: "p1", sleeperId: "s1", gsisId: "g1", playerName: "Exact Player", position: "QB", team: "BUF" }),
      universePlayer({ playerId: "p2", playerName: "Team Match", position: "WR", team: "CIN" }),
      universePlayer({ playerId: "p3", playerName: "Unique Match", position: "RB", team: "NYJ" }),
    ];
    const matches = matchCurrentAdpRows([
      adpRow({ playerName: "Exact Player", position: "QB", team: "BUF", playerId: "p1", rank: 1 }),
      adpRow({ playerName: "Team Match", position: "WR", team: "CIN", rank: 2 }),
      adpRow({ playerName: "Unique Match", position: "RB", team: null, rank: 3 }),
    ], universe);

    expect(matches.map((match) => match.matchMethod)).toEqual([
      "player_id_exact",
      "name_position_team_unique",
      "unique_name_position",
    ]);
  });

  it("reports review candidates and unmatched rows", () => {
    const universe = [
      universePlayer({ playerId: "p1", playerName: "Shared Name", position: "WR", team: "LAR" }),
      universePlayer({ playerId: "p2", playerName: "Shared Name", position: "WR", team: "SEA" }),
    ];
    const matches = matchCurrentAdpRows([
      adpRow({ playerName: "Shared Name", position: "WR", team: null, rank: 1 }),
      adpRow({ playerName: "Missing Player", position: "RB", team: "DAL", rank: 2 }),
    ], universe);

    expect(matches[0]).toMatchObject({ matchMethod: "review_candidate", confidence: "review" });
    expect(matches[1]).toMatchObject({ matchMethod: "unmatched", confidence: "none" });
  });

  it("builds market movement preview with default movement cap", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "current-adp-movement-"));
    try {
      const fixture = writeFixtures(cwd, {
        adpRows: [
          "2026,test,2026-06-19,SUPERFLEX,Low Confidence Rocket,QB,BUF,,1,,,,",
          "2026,test,2026-06-19,SUPERFLEX,Stable WR,WR,CIN,,40,,,,",
        ],
        snapshotRows: [
          snapshotRow({ sleeperId: "p1", playerName: "Low Confidence Rocket", position: "QB", team: "BUF", projectedTotalPoints: 10, confidence: "very_low", confidenceScore: 30 }),
          snapshotRow({ sleeperId: "p2", playerName: "Stable WR", position: "WR", team: "CIN", projectedTotalPoints: 100, confidence: "high", confidenceScore: 90 }),
        ],
        policyRows: [
          policyRow({ playerId: "p1", player: "Low Confidence Rocket", position: "QB", projectionTeam: "BUF" }),
          policyRow({ playerId: "p2", player: "Stable WR", position: "WR", projectionTeam: "CIN" }),
        ],
      });

      const report = runCurrentSeasonAdpEnrichment({ season: 2026, marketFormat: "SUPERFLEX", ...fixture, cwd });

      expect(report.marketSanityPreview.maxRankMovement).toBeLessThanOrEqual(24);
      expect(report.marketSanityPreview.playersWithMarketAdp).toBe(2);
      expect(report.marketSanityPreview.top25MovedUp[0]?.playerName).toBe("Low Confidence Rocket");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("keeps K, DST, and IDP ADP from overriding no-K/no-defense roster eligibility", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "current-adp-eligibility-"));
    try {
      const fixture = writeFixtures(cwd);
      const report = runCurrentSeasonAdpEnrichment({ season: 2026, marketFormat: "SUPERFLEX", ...fixture, cwd });

      expect(report.marketSanityPreview.kRowsPresentInAdp).toBe(true);
      expect(report.marketSanityPreview.kExcludedByNoKLeague).toBe(true);
      expect(report.warRoomSafetyPreview.kExcludedByRosterEligibilityWhenNoKSlot).toBe(true);
      expect(report.warRoomSafetyPreview.dstIdpExcludedWhenUnsupported).toBe(true);
      expect(report.marketSanityPreview.unsupportedPositionsFiltered).toEqual(["DEF", "K", "LB"]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("writes artifacts and reports no live mutation", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "current-adp-artifacts-"));
    try {
      const fixture = writeFixtures(cwd);
      const report = runCurrentSeasonAdpEnrichment({ season: 2026, marketFormat: "SUPERFLEX", ...fixture, cwd });
      const artifacts = writeCurrentSeasonAdpEnrichmentArtifacts(report, cwd);

      expect(report.recommendation).toBe("current_adp_enrichment_ready_for_market_anchor_review");
      expect(report.safetyGates.every((gate) => gate.passed)).toBe(true);
      expect(existsSync(artifacts.reportJsonPath)).toBe(true);
      expect(existsSync(artifacts.reportMarkdownPath)).toBe(true);
      expect(existsSync(artifacts.reportCsvPath)).toBe(true);
      expect(existsSync(artifacts.enrichedJsonPath)).toBe(true);
      expect(existsSync(artifacts.enrichedCsvPath)).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("reports missing current universe separately from identifier mapping", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "current-adp-missing-universe-"));
    try {
      const adpPath = path.join(cwd, "historical-adp-2026.normalized.csv");
      writeAdp(adpPath, ["2026,test,2026-06-19,SUPERFLEX,Josh Allen,QB,BUF,,1,,,,"]);

      const report = runCurrentSeasonAdpEnrichment({
        season: 2026,
        marketFormat: "SUPERFLEX",
        adpPath,
        snapshotPath: "missing-snapshot.json",
        activePolicyPath: "missing-policy.json",
        cwd,
      });

      expect(report.recommendation).toBe("current_adp_enrichment_needs_current_universe");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function writeFixtures(cwd: string, overrides?: {
  adpRows?: string[];
  snapshotRows?: Array<Record<string, unknown>>;
  policyRows?: Array<Record<string, unknown>>;
}) {
  const adpPath = path.join(cwd, "historical-adp-2026.normalized.csv");
  const snapshotPath = path.join(cwd, "preseason-projection-snapshot-2026.json");
  const activePolicyPath = path.join(cwd, "projection-active-policy-refresh-final-2026.json");
  writeAdp(adpPath, overrides?.adpRows ?? [
    "2026,test,2026-06-19,SUPERFLEX,Josh Allen,QB,BUF,,1,,,,",
    "2026,test,2026-06-19,PPR,Josh Allen,QB,BUF,,20,,,,",
    "2026,test,2026-06-19,SUPERFLEX,Ja'Marr Chase,WR,CIN,,3,,,,",
    "2026,test,2026-06-19,SUPERFLEX,Unique Runner,RB,,55,,,,",
    "2026,test,2026-06-19,SUPERFLEX,Top Kicker,K,BAL,,140,,,,",
    "2026,test,2026-06-19,SUPERFLEX,Top Defense,DST,DAL,,150,,,,",
    "2026,test,2026-06-19,SUPERFLEX,Top Linebacker,LB,SF,,210,,,,",
  ]);
  writeFileSync(snapshotPath, `${JSON.stringify({
    rows: overrides?.snapshotRows ?? [
      snapshotRow({ sleeperId: "p1", gsisId: "g1", playerName: "Josh Allen", position: "QB", team: "BUF", projectedTotalPoints: 435.2, confidence: "high", confidenceScore: 90 }),
      snapshotRow({ sleeperId: "p2", gsisId: "g2", playerName: "Ja'Marr Chase", position: "WR", team: "CIN", projectedTotalPoints: 370.6, confidence: "high", confidenceScore: 90 }),
      snapshotRow({ sleeperId: "p3", playerName: "Unique Runner", position: "RB", team: "NYJ", projectedTotalPoints: 200, confidence: "medium", confidenceScore: 70 }),
      snapshotRow({ sleeperId: "p4", playerName: "Top Kicker", position: "K", team: "BAL", projectedTotalPoints: 120, confidence: "medium", confidenceScore: 70 }),
      snapshotRow({ sleeperId: "p5", playerName: "Top Defense", position: "DST", team: "DAL", projectedTotalPoints: 130, confidence: "medium", confidenceScore: 70 }),
      snapshotRow({ sleeperId: "p6", playerName: "Top Linebacker", position: "LB", team: "SF", projectedTotalPoints: 210, confidence: "medium", confidenceScore: 70 }),
    ],
  }, null, 2)}\n`);
  writeFileSync(activePolicyPath, `${JSON.stringify({
    rows: overrides?.policyRows ?? [
      policyRow({ playerId: "p1", player: "Josh Allen", position: "QB", projectionTeam: "BUF" }),
      policyRow({ playerId: "p2", player: "Ja'Marr Chase", position: "WR", projectionTeam: "CIN" }),
      policyRow({ playerId: "p3", player: "Unique Runner", position: "RB", projectionTeam: "NYJ" }),
      policyRow({ playerId: "p4", player: "Top Kicker", position: "K", projectionTeam: "BAL" }),
      policyRow({ playerId: "p5", player: "Top Defense", position: "DST", projectionTeam: "DAL" }),
      policyRow({ playerId: "p6", player: "Top Linebacker", position: "LB", projectionTeam: "SF" }),
    ],
  }, null, 2)}\n`);
  return { adpPath, snapshotPath, activePolicyPath };
}

function writeAdp(filePath: string, rows: string[]) {
  const normalizedRows = rows.map((row) => {
    const parts = row.split(",");
    while (parts.length < 13) parts.push("");
    return parts.join(",");
  });
  writeFileSync(filePath, [
    "season,source,as_of_date,scoring_format,player_name,position,team,adp,rank,sleeper_id,gsis_id,player_id,notes",
    ...normalizedRows,
  ].join("\n"));
}

function snapshotRow(input: Partial<Record<"sleeperId" | "gsisId" | "playerName" | "position" | "team" | "confidence" | "variant", string>> & { projectedTotalPoints?: number; confidenceScore?: number }) {
  return {
    sleeperId: input.sleeperId,
    gsisId: input.gsisId ?? null,
    playerName: input.playerName,
    normalizedName: normalizeName(input.playerName ?? ""),
    position: input.position,
    team: input.team,
    projectedTotalPoints: input.projectedTotalPoints ?? 0,
    confidence: input.confidence ?? "medium",
    confidenceScore: input.confidenceScore ?? 70,
    variant: input.variant ?? "blackbird_availability_calibrated",
  };
}

function policyRow(input: Partial<Record<"playerId" | "player" | "position" | "projectionTeam" | "policyGroup" | "finalPolicyClass", string>>) {
  return {
    playerId: input.playerId,
    player: input.player,
    position: input.position,
    projectionTeam: input.projectionTeam,
    policyGroup: input.policyGroup ?? "current_active",
    finalPolicyClass: input.finalPolicyClass ?? "final_policy_active",
  };
}

function universePlayer(input: Partial<ReturnType<typeof policyRow>> & {
  sleeperId?: string | null;
  gsisId?: string | null;
  playerName: string;
  team?: string | null;
}) {
  return {
    playerId: input.playerId ?? input.sleeperId ?? input.playerName,
    sleeperId: input.sleeperId ?? null,
    gsisId: input.gsisId ?? null,
    playerName: input.playerName,
    normalizedPlayerName: normalizeName(input.playerName),
    position: input.position ?? "WR",
    team: input.team ?? input.projectionTeam ?? null,
    projectedPoints: 1,
    modelRank: 1,
    confidence: "high",
    confidenceScore: 90,
    policyGroup: "current_active",
    activePolicyClass: "final_policy_active",
    sourceVariant: "test",
  };
}

function adpRow(input: { playerName: string; position: string; team?: string | null; rank: number; playerId?: string | null; sleeperId?: string | null; gsisId?: string | null }): HistoricalAdpNormalizedRow {
  return {
    season: 2026,
    source: "test",
    asOfDate: "2026-06-19",
    scoringFormat: "SUPERFLEX",
    playerName: input.playerName,
    normalizedPlayerName: normalizeName(input.playerName),
    position: input.position,
    team: input.team ?? null,
    adp: input.rank,
    rank: input.rank,
    sleeperId: input.sleeperId ?? null,
    gsisId: input.gsisId ?? null,
    playerId: input.playerId ?? null,
    notes: [],
  };
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
