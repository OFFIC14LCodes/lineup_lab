import { buildEligibleDraftPositions } from "./league-position-eligibility";
import { buildPlayerPositionEligibility, type PlayerPositionEligibility } from "./player-position-eligibility";
import type { ScoredDraftTarget } from "./scoring";
import type { BlackbirdBoardRow } from "./blackbird-board";
import type { NormalizedRosterRequirements } from "./roster-slots";

export type MultiPositionEligibilityAuditRow = {
  playerName: string;
  position: string | null;
  rawEligiblePositions: string[];
  displayPosition: string;
  displayPositions: string[];
  filterPositions: string[];
  rosterFitPositions: string[];
  valueModelPositions: string[];
  eligibilityClass: PlayerPositionEligibility["eligibilityClass"];
  eligibilityWarnings: string[];
  team: string | null;
  onBoard: boolean;
  secondaryPositionChangesDraftability: boolean;
  secondaryPositionChangesRosterFit: boolean;
  secondaryPositionChangesFilterVisibility: boolean;
  secondaryPositionChangesValue: boolean;
};

export type MultiPositionEligibilityAuditReport = {
  dryRun: true;
  readOnly: true;
  projectionSeason: number;
  recommendation: "multi_position_eligibility_ready_for_manual_review" | "multi_position_eligibility_no_source_rows" | "multi_position_eligibility_blocked";
  summary: {
    playersWithMultipleRawEligiblePositions: number;
    multiPositionPlayersOnBoard: number;
    secondaryPositionChangesDraftability: number;
    secondaryPositionChangesRosterFit: number;
    secondaryPositionChangesFilterVisibility: number;
    secondaryPositionChangesValue: number;
    combos: Record<string, number>;
    classes: Record<PlayerPositionEligibility["eligibilityClass"], number>;
    suppressedComboExamples: string[];
    trustedIdpExamples: string[];
    travisHunterRows: MultiPositionEligibilityAuditRow[];
  };
  rows: MultiPositionEligibilityAuditRow[];
};

const CLASSES: PlayerPositionEligibility["eligibilityClass"][] = [
  "single_position",
  "trusted_idp_multi_position",
  "travis_hunter_wr_db",
  "suppressed_unsupported_combo",
  "invalid_cross_family_combo",
  "unknown_multi_position",
];

export function buildMultiPositionEligibilityAudit(input: {
  projectionSeason: number;
  players: ScoredDraftTarget[];
  boardRows: BlackbirdBoardRow[];
  rosterRequirements: NormalizedRosterRequirements;
}): MultiPositionEligibilityAuditReport {
  const boardKeys = new Set(input.boardRows.map((row) => rowKey(row.playerId, row.playerName)));
  const eligibleLeaguePositions = buildEligibleDraftPositions({ rosterRequirements: input.rosterRequirements });
  const rows = input.players
    .map((player): MultiPositionEligibilityAuditRow | null => {
      const eligibility = buildPlayerPositionEligibility(player);
      if (eligibility.rawEligiblePositions.length <= 1) return null;
      const primary = eligibility.primaryPosition;
      const primarySupported = Boolean(primary && eligibleLeaguePositions.has(primary));
      return {
        playerName: player.player_name ?? "Unknown",
        position: player.position,
        rawEligiblePositions: eligibility.rawEligiblePositions,
        displayPosition: eligibility.displayPosition,
        displayPositions: eligibility.displayPositions,
        filterPositions: eligibility.filterPositions,
        rosterFitPositions: eligibility.rosterFitPositions,
        valueModelPositions: eligibility.valueModelPositions,
        eligibilityClass: eligibility.eligibilityClass,
        eligibilityWarnings: eligibility.eligibilityWarnings,
        team: player.team,
        onBoard: boardKeys.has(rowKey(player.sleeper_player_id ?? player.matched_player_id, player.player_name)),
        secondaryPositionChangesDraftability: !primarySupported && hasSupportedSecondary(eligibility.rosterFitPositions, primary, eligibleLeaguePositions),
        secondaryPositionChangesRosterFit: hasSupportedSecondary(eligibility.rosterFitPositions, primary, eligibleLeaguePositions),
        secondaryPositionChangesFilterVisibility: eligibility.filterPositions.some((position) => position !== primary),
        secondaryPositionChangesValue: hasSupportedSecondary(eligibility.valueModelPositions, primary, eligibleLeaguePositions),
      };
    })
    .filter((row): row is MultiPositionEligibilityAuditRow => Boolean(row));
  const combos = rows.reduce<Record<string, number>>((counts, row) => {
    const combo = row.rawEligiblePositions.join("/");
    counts[combo] = (counts[combo] ?? 0) + 1;
    return counts;
  }, {});
  const classes = Object.fromEntries(CLASSES.map((eligibilityClass) => [eligibilityClass, 0])) as Record<PlayerPositionEligibility["eligibilityClass"], number>;
  for (const row of rows) classes[row.eligibilityClass] += 1;
  return {
    dryRun: true,
    readOnly: true,
    projectionSeason: input.projectionSeason,
    recommendation: rows.length ? "multi_position_eligibility_ready_for_manual_review" : "multi_position_eligibility_no_source_rows",
    summary: {
      playersWithMultipleRawEligiblePositions: rows.length,
      multiPositionPlayersOnBoard: rows.filter((row) => row.onBoard).length,
      secondaryPositionChangesDraftability: rows.filter((row) => row.secondaryPositionChangesDraftability).length,
      secondaryPositionChangesRosterFit: rows.filter((row) => row.secondaryPositionChangesRosterFit).length,
      secondaryPositionChangesFilterVisibility: rows.filter((row) => row.secondaryPositionChangesFilterVisibility).length,
      secondaryPositionChangesValue: rows.filter((row) => row.secondaryPositionChangesValue).length,
      combos,
      classes,
      suppressedComboExamples: rows
        .filter((row) => row.eligibilityClass === "suppressed_unsupported_combo" || row.eligibilityClass === "invalid_cross_family_combo" || row.eligibilityClass === "unknown_multi_position")
        .slice(0, 12)
        .map((row) => `${row.playerName} ${row.rawEligiblePositions.join("/")}`),
      trustedIdpExamples: rows
        .filter((row) => row.eligibilityClass === "trusted_idp_multi_position")
        .slice(0, 12)
        .map((row) => `${row.playerName} ${row.rawEligiblePositions.join("/")}`),
      travisHunterRows: rows.filter((row) => row.eligibilityClass === "travis_hunter_wr_db"),
    },
    rows,
  };
}

export function renderMultiPositionEligibilityAuditMarkdown(report: MultiPositionEligibilityAuditReport): string {
  return [
    `# Multi-Position Eligibility Audit - ${report.projectionSeason}`,
    "",
    `- Dry run: ${report.dryRun}`,
    `- Read only: ${report.readOnly}`,
    `- Recommendation: ${report.recommendation}`,
    `- Multi-position source rows: ${report.summary.playersWithMultipleRawEligiblePositions}`,
    `- Multi-position players on board: ${report.summary.multiPositionPlayersOnBoard}`,
    `- Secondary position changes draftability: ${report.summary.secondaryPositionChangesDraftability}`,
    `- Secondary position changes roster fit: ${report.summary.secondaryPositionChangesRosterFit}`,
    `- Secondary position changes filter visibility: ${report.summary.secondaryPositionChangesFilterVisibility}`,
    `- Secondary position changes value: ${report.summary.secondaryPositionChangesValue}`,
    "",
    "## Classes",
    "",
    ...Object.entries(report.summary.classes).map(([eligibilityClass, count]) => `- ${eligibilityClass}: ${count}`),
    "",
    "## Combos",
    "",
    ...Object.entries(report.summary.combos).map(([combo, count]) => `- ${combo}: ${count}`),
    "",
    "## Trusted IDP Examples",
    "",
    ...(report.summary.trustedIdpExamples.length ? report.summary.trustedIdpExamples.map((value) => `- ${escapeMd(value)}`) : ["- none"]),
    "",
    "## Travis Hunter",
    "",
    ...(report.summary.travisHunterRows.length
      ? report.summary.travisHunterRows.map((row) => `- ${escapeMd(row.playerName)}: display=${row.displayPosition}, roster_fit=${row.rosterFitPositions.join("/")}, value=${row.valueModelPositions.join("/")}`)
      : ["- not present"]),
    "",
    "## Suppressed Combo Examples",
    "",
    ...(report.summary.suppressedComboExamples.length ? report.summary.suppressedComboExamples.map((value) => `- ${escapeMd(value)}`) : ["- none"]),
    "",
    "## Rows",
    "",
    "| Player | Team | Primary | Raw | Class | Display | Filter | Roster Fit | Value | On Board | Draftability | Roster Fit Impact | Value Impact | Warnings |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.rows.slice(0, 75).map((row) =>
      `| ${escapeMd(row.playerName)} | ${row.team ?? "-"} | ${row.position ?? "-"} | ${row.rawEligiblePositions.join("/")} | ${row.eligibilityClass} | ${row.displayPosition} | ${row.filterPositions.join("/")} | ${row.rosterFitPositions.join("/")} | ${row.valueModelPositions.join("/")} | ${row.onBoard} | ${row.secondaryPositionChangesDraftability} | ${row.secondaryPositionChangesRosterFit} | ${row.secondaryPositionChangesValue} | ${escapeMd(row.eligibilityWarnings.join("; ")) || "-"} |`
    ),
    "",
  ].join("\n");
}

export function renderMultiPositionEligibilityAuditCsv(rows: MultiPositionEligibilityAuditRow[]): string {
  const headers = [
    "player_name",
    "team",
    "position",
    "raw_eligible_positions",
    "eligibility_class",
    "display_position",
    "display_positions",
    "filter_positions",
    "roster_fit_positions",
    "value_model_positions",
    "eligibility_warnings",
    "on_board",
    "secondary_position_changes_draftability",
    "secondary_position_changes_roster_fit",
    "secondary_position_changes_filter_visibility",
    "secondary_position_changes_value",
  ];
  return [
    headers.join(","),
    ...rows.map((row) => [
      csv(row.playerName),
      csv(row.team),
      csv(row.position),
      csv(row.rawEligiblePositions.join("/")),
      csv(row.eligibilityClass),
      csv(row.displayPosition),
      csv(row.displayPositions.join("/")),
      csv(row.filterPositions.join("/")),
      csv(row.rosterFitPositions.join("/")),
      csv(row.valueModelPositions.join("/")),
      csv(row.eligibilityWarnings.join("; ")),
      row.onBoard,
      row.secondaryPositionChangesDraftability,
      row.secondaryPositionChangesRosterFit,
      row.secondaryPositionChangesFilterVisibility,
      row.secondaryPositionChangesValue,
    ].join(",")),
  ].join("\n") + "\n";
}

function hasSupportedSecondary(positions: string[], primary: string | null, eligibleLeaguePositions: Set<string>): boolean {
  return positions.some((position) => position !== primary && eligibleLeaguePositions.has(position));
}

function rowKey(id: string | null | undefined, name: string | null | undefined): string {
  return `${id ?? ""}|${(name ?? "").trim().toLowerCase()}`;
}

function csv(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeMd(value: string): string {
  return value.replace(/\|/g, "\\|");
}
