import { normalizeAdapterRecords, normalizeInjuryRecord, normalizeProjectionRecord, normalizeSeasonStatsRecord, normalizeWeeklyStatsRecord } from "@/lib/providers/adapters/normalize";
import type { FootballDataAdapter } from "@/lib/providers/adapters/contracts";
import type { ProviderCapabilities } from "@/lib/providers/adapters/types";

const capabilities: ProviderCapabilities = {
  weeklyStats: true,
  seasonStats: true,
  weeklyProjections: true,
  seasonProjections: true,
  restOfSeasonProjections: true,
  injuries: true,
  offense: true,
  kicker: true,
  teamDefense: true,
  idp: true,
  rawStats: true,
  providerFantasyPoints: true,
  scheduleContext: true,
  supportedPositionGroups: ["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"]
};

export const mockAdapter: FootballDataAdapter = {
  provider: "manual",
  capabilities,
  normalizeWeeklyStats(input) {
    return normalizeAdapterRecords(input, (value) => normalizeWeeklyStatsRecord(value, "manual"));
  },
  normalizeSeasonStats(input) {
    return normalizeAdapterRecords(input, (value) => normalizeSeasonStatsRecord(value, "manual"));
  },
  normalizeProjections(input) {
    return normalizeAdapterRecords(input, (value) => normalizeProjectionRecord(value, "manual"));
  },
  normalizeInjuries(input) {
    return normalizeAdapterRecords(input, (value) => normalizeInjuryRecord(value, "manual"));
  }
};
