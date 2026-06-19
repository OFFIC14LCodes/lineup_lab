import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildPreDraftStrategyUiViewModel, findBannedStrategyUiLanguage } from "@/lib/draft/pre-draft-strategy-ui";

describe("DraftWarRoom H11 strategy UI wiring", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "components", "draft-war-room.tsx"), "utf8");
  const planAlignmentSource = readFileSync(path.join(process.cwd(), "src", "lib", "draft", "war-room-plan-alignment.ts"), "utf8");
  const modelSelectionStatusSource = readFileSync(path.join(process.cwd(), "src", "lib", "projections", "model-selection-status.ts"), "utf8");

  it("fetches the authenticated pre-draft strategy endpoint", () => {
    expect(source).toContain("/pre-draft-strategy");
    expect(source).toContain("cache: \"no-store\"");
  });

  it("renders required strategy sections and states", () => {
    [
      "League Summary",
      "Scoring Emphasis",
      "Roster Construction Plan",
      "Positional Priority Map",
      "Draft Slot Strategy",
      "Round Window Plan",
      "Tier Cliff Watchlist",
      "Value Pocket Watchlist",
      "Wait Positions",
      "Do-Not-Force Positions",
      "Contingency Plans",
      "Special Position Guidance",
      "Risk Notes",
      "Strategy preview is partial because some draft context is missing.",
      "Loading strategy preview",
      "Unable to load strategy preview. War Room remains usable.",
    ].forEach((text) => expect(source).toContain(text));
  });

  it("keeps read-only and experimental caveats visible", () => {
    const model = buildPreDraftStrategyUiViewModel({ loadState: "ready", error: null, sectionCounts: { scoringEmphasis: 1 } });

    expect(model.title).toBe("Pre-Draft Strategy Preview");
    expect(model.caveats).toContain("Read-only");
    expect(model.caveats).toContain("Experimental");
    expect(model.caveats).toContain("Historical outcome validation is not yet available.");
  });

  it("does not introduce banned H11 strategy UI language", () => {
    const visibleCopy = [
      "Pre-Draft Strategy Preview",
      "Read-only",
      "Experimental",
      "Blackbird Strategy Preview based on currently available projections, market context, and league context.",
      "Strategy preview is partial because some draft context is missing.",
      "Unable to load strategy preview. War Room remains usable.",
      "Historical outcome validation is not yet available.",
    ].join(" ");
    const bannedFound = findBannedStrategyUiLanguage(visibleCopy);

    expect(bannedFound).toEqual([]);
  });

  it("does not persist strategy UI state", () => {
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("pre-draft-strategy\", { method: \"POST\"");
  });

  it("renders the read-only Blackbird board controls and missing-data labels", () => {
    [
      "Blackbird Board",
      "Draft Suggestions are dynamic and available-only. Full Blackbird Rank is the static league board. Available Blackbird Rank filters that static board to remaining players.",
      "Draft Suggestions",
      "Full Blackbird Rank",
      "Available Blackbird Rank",
      "Dynamic live ordering for available players based on your roster, timing, plan fit, and current draft state.",
      "Static league-specific power ranking across drafted and undrafted draftable players.",
      "Remaining undrafted players sorted by static Blackbird Power Rank.",
      "No Draft Suggestions match these filters.",
      "No Full Blackbird Rank rows match these filters.",
      "No Available Blackbird Rank rows match these filters.",
      "Load more",
      "Projection unavailable",
      "Season projection",
      "Floor",
      "Median",
      "Ceiling",
      "Blackbird Power Rank",
      "Player",
      "Draft Suggestion",
      "Risk",
      "Live Plan Status",
      "Contingency active",
      "Wait plan supported",
      "Wait plan weakening",
      "Tier risk rising",
      "Unexpected value signal",
      "Data Gaps",
      "withFallbackDraftSuggestionRanks",
      "filterDraftEligiblePlayers",
      "eligibleBlackbirdPlayerPool",
      "eligibleRecommendations",
      "Filtered unsupported positions:",
      "Search, filters, load-more, and sort are local to this browser view.",
    ].forEach((text) => expect(source).toContain(text));
  });

  it("keeps War Room board view semantics separate", () => {
    [
      "if (boardViewMode === \"draft_suggestions\") return !row.drafted && row.draftSuggestionRank !== null;",
      "if (boardViewMode === \"available_blackbird\") return !row.drafted;",
      "if (boardViewMode === \"draft_suggestions\") return (a.draftSuggestionRank ?? 999999) - (b.draftSuggestionRank ?? 999999);",
      "return a.blackbirdBoardRank - b.blackbirdBoardRank;",
      "Draft Suggestions are dynamic and available-only. Full Blackbird Rank is the static league board. Available Blackbird Rank filters that static board to remaining players.",
    ].forEach((text) => expect(source).toContain(text));
  });

  it("renders dev-only scoring foundation status with v8.2 disabled", () => {
    const statusCombinedSource = `${source}\n${modelSelectionStatusSource}`;
    [
      "Scoring Foundation Status",
      "current path / v7-family",
      "ready_for_controlled_flag_review",
      "buildProjectionModelSelectionStatus",
      "BLACKBIRD_ENABLE_V8_2_EXPECTED_GAMES",
      "Feature flag name",
      "Flag state",
      "Flag default",
      "Current model selected in War Room",
      "v8.2 production usage",
      "Safe subset readiness",
      "Protected rows enforced",
      "Missing artifact behavior",
      "fail closed",
      "Projection universe",
      "5635 rows, 1245 blocked legacy/stale, 127 K excluded, hygiene review required",
      "War Room using v8.2",
      "Blackbird Rank using v8.2",
      "Draft Suggestions using v8.2",
      "Supabase production writes using v8.2",
      "SHOW_SCORING_FOUNDATION_STATUS",
    ].forEach((text) => expect(statusCombinedSource).toContain(text));
  });

  it("renders deterministic GM Brief preview without AI provider calls", () => {
    [
      "buildWarRoomAiContext",
      "buildWarRoomGmBrief",
      "GM Brief",
      "Preview",
      "Deterministic",
      "Brief will appear once draft context is available.",
      "Brief details",
      "Watch List",
      "No watch-list items are available yet.",
      "No top-player data gaps surfaced in this brief.",
      "Read-only preview; no AI API calls and not included in scoring, Blackbird Rank, or Draft Suggestions.",
      "draftSuggestions: draftSuggestionRows.map(toWarRoomAiBoardPlayer)",
      "fullBlackbirdRank: fullRankRows.map(toWarRoomAiBoardPlayer)",
      "availableBlackbirdRank: availableRankRows.map(toWarRoomAiBoardPlayer)",
    ].forEach((text) => expect(source).toContain(text));

    ["openai", "anthropic", "claude", "chat.completions", "messages.create"].forEach((text) => {
      expect(source.toLowerCase()).not.toContain(text);
    });
  });

  it("wires read-only historical player profiles into the player modal", () => {
    [
      "/api/player-profiles/",
      "weeklyLimit: \"8\"",
      "draftRoomId",
      "Historical Profile",
      "Loading historical profile...",
      "Historical profile not available yet.",
      "Historical profile data is not available in this deployment yet.",
      "Historical profile lookup is ambiguous and needs review.",
      "League projection profile is not available for this player yet.",
      "Scouting Lens",
      "projectedSeasons={profile?.history ?? []}",
      "ProjectedSeasonsTable",
      "Profile match confidence:",
      "Career coverage:",
      "Trend:",
      "Career Games",
      "Career Points",
      "Career PPG",
      "Role & Target Share",
      "Target & Route Usage",
      "Season & Game Log",
      "Projected Seasons",
      "ModalDisclosure",
      "compactHeader",
      "hasHighValueUsage",
      "sourceStatus === \"available\"",
      "highValueUsageMetrics",
      "highValueRoleWarnings",
      "70%+ Games",
      "Snap Trend",
      "roleUsageMetrics",
      "snapRoleMetrics",
      "formatCoverageLabel",
      "Review may be needed.",
      "Recent Weekly Game Log",
      "weeklyGameLog.slice(0, 8)",
      "profile.warnings.map",
      "buildWeeklyStatLine",
      "idpSummary",
      "Scored using this league's settings",
      "Scored using Blackbird default profile scoring",
      "League scoring unavailable; using default profile scoring",
      "buildPlayerProfileEvidence",
      "Scout Summary",
      "evidence.note",
      "Positive Signals",
    ].forEach((text) => expect(source).toContain(text));
  });

  it("keeps historical evidence read-only and separate from ranking math", () => {
    const rankingSectionStart = source.indexOf("function AvailablePlayersTable");
    const rankingSectionEnd = source.indexOf("function HistoricalPlayerProfilePanel");
    const rankingSection = source.slice(rankingSectionStart, rankingSectionEnd);

    expect(source).toContain("buildPlayerProfileEvidence({");
    expect(rankingSection).not.toContain("buildPlayerProfileEvidence");
    expect(source).not.toContain("profileEvidenceScore");
  });

  it("renders structured player reasoning without changing board ordering", () => {
    [
      "buildWarRoomPlayerReasonStack",
      "Player Reasoning",
      "Why Blackbird Likes",
      "Projection Profile",
      "Fit With Your Roster",
      "Risk and Confidence",
      "Data Gaps / Things to Verify",
      "Draft Timing / Value Note",
      "Board reasoning will appear when this player is opened from the Blackbird Board.",
      "It does not change ranking or suggestion math.",
      "setSelectedBoardRow(row)",
      "setSelectedBoardRow(null)",
    ].forEach((text) => expect(source).toContain(text));

    const orderingSection = source.slice(source.indexOf("const filteredBoardRows"), source.indexOf("const visibleBlackbirdRows"));
    expect(orderingSection).not.toContain("buildWarRoomPlayerReasonStack");
    expect(source.toLowerCase()).not.toContain("anthropic");
    expect(source.toLowerCase()).not.toContain("openai");
  });

  it("supports H13.4 board search, position chips, counts, and load-more as view-only controls", () => {
    [
      "const BOARD_POSITION_FILTERS = [\"All\", \"QB\", \"RB\", \"WR\", \"TE\", \"K\", \"DEF\", \"DL\", \"LB\", \"DB\"]",
      "const boardRowsForMode = useMemo(() =>",
      "const availableBoardPositions = useMemo(() =>",
      "normalizeBoardSearch(search)",
      "boardRowMatchesSearch(row, needle)",
      "row.playerName",
      "row.team",
      "row.position",
      "row.source.player.sleeper_player_id",
      "row.source.player.matched_player_id",
      "No players match this search.",
      "Filtered by:",
      "Showing {visibleBlackbirdRows.length} of {filteredBoardRows.length} filtered",
      "{boardRowsForMode.length} in this view",
      "Search, filters, load-more, and sort are local to this browser view.",
      "aria-pressed={active}",
      "disabled={!available}",
      "onClick={() => setPositionFilter(position)}",
      "setVisibleBoardRows((count) => count + 50)",
    ].forEach((text) => expect(source).toContain(text));
  });

  it("keeps H13.4 filtering after mode ordering so search and position filters do not mutate ranks", () => {
    const baseRowsSection = source.slice(source.indexOf("const boardRowsForMode"), source.indexOf("const availableBoardPositions"));
    const filteringSection = source.slice(source.indexOf("const filteredBoardRows"), source.indexOf("const visibleBlackbirdRows"));

    expect(baseRowsSection).toContain("if (boardViewMode === \"draft_suggestions\") return !row.drafted && row.draftSuggestionRank !== null;");
    expect(baseRowsSection).toContain("if (boardViewMode === \"available_blackbird\") return !row.drafted;");
    expect(baseRowsSection).toContain("return true;");
    expect(baseRowsSection).toContain("return a.blackbirdBoardRank - b.blackbirdBoardRank;");
    expect(filteringSection).toContain("positionFilter === \"All\" || row.position === positionFilter");
    expect(filteringSection).toContain("!needle || boardRowMatchesSearch(row, needle)");
    expect(filteringSection).toContain("matchFilter === \"Matched\"");
    expect(filteringSection).not.toContain("sort(");
    expect(filteringSection).not.toContain("buildLiveDraftSuggestions");
    expect(filteringSection).not.toContain("buildBlackbirdLeagueRank");
  });

  it("filters unsupported positions before building actionable board surfaces", () => {
    const boardBuildSection = source.slice(source.indexOf("const eligibleBlackbirdPlayerPool"), source.indexOf("const livePlanStatus"));
    const gmBriefSection = source.slice(source.indexOf("const gmBrief"), source.indexOf("if (error && !state)"));

    expect(boardBuildSection).toContain("filterDraftEligiblePlayers(blackbirdPlayerPool, { rosterRequirements: state.rosterRequirements })");
    expect(boardBuildSection).toContain("filterDraftEligiblePlayers(state.recommendations, { rosterRequirements: state.rosterRequirements }).players");
    expect(boardBuildSection).toContain("players: eligibleBlackbirdPlayerPool.players");
    const buildBlackbirdBoardCall = boardBuildSection.slice(boardBuildSection.indexOf("return buildBlackbirdBoard({"), boardBuildSection.indexOf("const livePlanStatus"));
    expect(buildBlackbirdBoardCall).not.toContain("players: blackbirdPlayerPool");
    expect(source).toContain("topPlayer={eligibleRecommendations[0] ?? null}");
    expect(source).toContain("legacyRows={eligibleRecommendations.slice(0, 10)}");
    expect(source).toContain("players={eligibleRecommendations.slice(0, 10)}");
    expect(gmBriefSection).toContain("draftSuggestions: draftSuggestionRows.map(toWarRoomAiBoardPlayer)");
    expect(gmBriefSection).toContain("fullBlackbirdRank: fullRankRows.map(toWarRoomAiBoardPlayer)");
    expect(gmBriefSection).toContain("availableBlackbirdRank: availableRankRows.map(toWarRoomAiBoardPlayer)");
  });

  it("renders H13.5 roster construction and plan alignment without changing ordering", () => {
    const planAlignmentCombinedSource = `${source}\n${planAlignmentSource}`;
    [
      "Current roster by position",
      "Next Pick Lens",
      "Roster construction will appear once your picks are available.",
      "No major roster gaps detected yet.",
      "Plan alignment will appear once Draft Suggestions are loaded.",
      "PlanAlignmentChips",
      "buildWarRoomPlanAlignmentLabels",
      "Plan Fit",
      "Need Fit",
      "Value Fit",
      "Scarcity Fit",
      "Depth Pick",
      "Luxury Pick",
      "Risk Check",
      "buildRosterPlanSummaries",
      "planSummaries: buildRosterPlanSummaries(state).summaryLines",
      "Strengths",
      "Needs",
      "Avoid forcing",
      "Use value and tier signals; roster construction is not forcing a position.",
    ].forEach((text) => expect(planAlignmentCombinedSource).toContain(text));

    const sidebarMarkup = source.slice(source.indexOf("<aside className=\"min-w-0 space-y-5\">"), source.indexOf("</aside>"));
    const sidebarOrder = [
      "/* 1. Draft Signal",
      "/* 2. Recent Signals",
      "/* 3. Recommended Targets",
      "/* 4. My Roster Construction",
      "/* 5. Pre-Draft Strategy",
      "/* 6. Live Plan Details",
      "/* 7. Blackbird Value Preview",
      "SHOW_SCORING_FOUNDATION_STATUS",
    ].map((text) => sidebarMarkup.indexOf(text));
    expect(sidebarOrder.every((index) => index >= 0)).toBe(true);
    expect(sidebarOrder).toEqual([...sidebarOrder].sort((a, b) => a - b));

    const orderingSection = source.slice(source.indexOf("const boardRowsForMode"), source.indexOf("const visibleBlackbirdRows"));
    expect(orderingSection).not.toContain("buildPlanAlignmentLabels");
    expect(orderingSection).not.toContain("buildWarRoomPlanAlignmentLabels");
    expect(orderingSection).not.toContain("buildRosterPlanSummaries");
  });

  it("renders H13.6 live sync status and stale warnings without changing ordering", () => {
    [
      "buildWarRoomLiveState",
      "LiveSyncStatusIndicator",
      "LiveStateWarning",
      "lastStateLoadedAt",
      "syncError",
      "Refresh draft state",
      "Last updated",
      "Sleeper sync",
      "liveState: {",
      "warnings: liveState.warnings",
      "...liveState.warnings",
      "setLastStateLoadedAt(new Date().toISOString())",
      "window.setInterval(() => setCurrentTime(new Date()), 1000)",
      "Unable to load draft room.",
      "Sync failed.",
    ].forEach((text) => expect(source).toContain(text));

    const orderingSection = source.slice(source.indexOf("const boardRowsForMode"), source.indexOf("const visibleBlackbirdRows"));
    expect(orderingSection).not.toContain("buildWarRoomLiveState");
    expect(orderingSection).not.toContain("liveState");
    expect(orderingSection).not.toContain("syncError");
    expect(source.toLowerCase()).not.toContain("anthropic");
    expect(source.toLowerCase()).not.toContain("openai");
  });

  it("renders WR-6B recent signals and live draft cues without changing ordering", () => {
    [
      "useRef",
      "recentlyDraftedPickNo",
      "recentlyDraftedPlayerKey",
      "draftSignalUpdated",
      "picksUntilTurnChanged",
      "targetLostAlert",
      "previousPickCountRef",
      "previousTopSuggestionRef",
      "previousPicksUntilTurnRef",
      "buildRadarAlerts",
      "RecentSignalsPanel",
      "RecentSignalRow",
      "detectTurnAlert",
      "detectPositionRun",
      "positionRunFromWindow",
      "pickMatchesTopSuggestion",
      "Target lost",
      "Recent Signals",
      "Live draft movement and board changes",
      "Recalculating board",
      "Draft Signal updated",
      "No active signals right now.",
      "Turn approaching",
      "Tier risk",
      "Position run",
      "Value available",
      "Fallback active",
      "Wait plan weakening",
      "position-run-",
      "recentlyDraftedPickNo={recentlyDraftedPickNo}",
      "recentlyDraftedPlayerKey={recentlyDraftedPlayerKey}",
      "isRecentlyDrafted",
      "ring-electric/50",
      "row.drafted ? \"opacity-75\"",
    ].forEach((text) => expect(source).toContain(text));

    const orderingSection = source.slice(source.indexOf("const boardRowsForMode"), source.indexOf("const visibleBlackbirdRows"));
    expect(orderingSection).not.toContain("buildRadarAlerts");
    expect(orderingSection).not.toContain("recentlyDraftedPickNo");
    expect(orderingSection).not.toContain("draftSignalUpdated");
    expect(orderingSection).not.toContain("targetLostAlert");

    const draftSignalSection = source.slice(source.indexOf("function DraftSignalPanel"), source.indexOf("function RecentSignalsPanel"));
    expect(draftSignalSection).not.toContain("Recent Signals");
    expect(draftSignalSection).not.toContain("radarAlerts");

    const recentSignalsSection = source.slice(source.indexOf("function RecentSignalsPanel"), source.indexOf("function LivePlanStatusPanel"));
    expect(recentSignalsSection).toContain("alerts.slice(0, 3)");
    expect(recentSignalsSection).toContain("alerts.slice(3)");
    expect(recentSignalsSection).toContain("+{hiddenSignals.length} more signal");

    const radarBuilderSection = source.slice(source.indexOf("function buildRadarAlerts"), source.indexOf("function detectTurnAlert"));
    expect(radarBuilderSection.indexOf("input.targetLostAlert")).toBeLessThan(radarBuilderSection.indexOf("detectTurnAlert"));
    expect(radarBuilderSection.indexOf("Tier risk")).toBeLessThan(radarBuilderSection.indexOf("detectPositionRun"));
    expect(radarBuilderSection.indexOf("detectPositionRun")).toBeLessThan(radarBuilderSection.indexOf("Value available"));
    expect(radarBuilderSection.indexOf("Value available")).toBeLessThan(radarBuilderSection.indexOf("Fallback active"));
    expect(radarBuilderSection.indexOf("Fallback active")).toBeLessThan(radarBuilderSection.indexOf("Wait plan weakening"));
    expect(radarBuilderSection).toContain("item.status !== \"supported\"");
    expect(radarBuilderSection).not.toContain("Syncing");
  });
});
