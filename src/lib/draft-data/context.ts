import type { ContextRoadmapItem, TeamContextFoundation } from "@/lib/draft-data/types";

export type TeamGameContextRow = {
  season: number;
  team_id: string;
  points_scored: number | null;
  points_allowed: number | null;
  offensive_yards: number | null;
  yards_allowed: number | null;
};

export function buildTeamContextFoundation(season: number, rows: TeamGameContextRow[]): TeamContextFoundation {
  const byTeam = new Map<string, TeamGameContextRow[]>();
  for (const row of rows.filter((item) => item.season === season)) {
    byTeam.set(row.team_id, [...(byTeam.get(row.team_id) ?? []), row]);
  }

  return {
    season,
    teamCount: byTeam.size,
    teams: [...byTeam.entries()]
      .map(([teamId, teamRows]) => ({
        teamId,
        games: teamRows.length,
        pointsScoredPerGame: averageNullable(teamRows.map((row) => row.points_scored)),
        pointsAllowedPerGame: averageNullable(teamRows.map((row) => row.points_allowed)),
        offensiveYardsPerGame: averageNullable(teamRows.map((row) => row.offensive_yards)),
        yardsAllowedPerGame: averageNullable(teamRows.map((row) => row.yards_allowed)),
        sourceStatus: "available_from_team_game_stats" as const
      }))
      .sort((a, b) => a.teamId.localeCompare(b.teamId)),
    limitations: [
      "Team-game context is historical only in H6.",
      "Pass/run rate, play volume, pace, offensive line, depth chart, injury, and schedule strength require future source ingestion.",
      "No player projection or ADP adjustments are produced from team context in H6."
    ]
  };
}

export function buildContextRoadmap(): ContextRoadmapItem[] {
  return [
    roadmap("Role and depth chart", "Separate starters, committees, handcuffs, and low-confidence depth roles.", ["Sleeper depth charts", "team sites", "manual analyst tags"], "weekly plus preseason"),
    roadmap("Player injuries", "Distinguish unavailable, limited, returning, and healthy players.", ["official injury reports", "provider injury feeds"], "daily in season"),
    roadmap("Team offensive environment", "Capture pace, plays, points, yards, pass/rush tendency, and scoring opportunity.", ["team_game_stats", "nflverse team/player weekly data"], "weekly"),
    roadmap("Quarterback environment", "Model receiving/rushing efficiency changes driven by QB quality and continuity.", ["depth charts", "nflverse passing efficiency"], "weekly"),
    roadmap("Teammate competition", "Estimate target, carry, snap, and red-zone competition by team and position.", ["snap counts", "targets", "carries", "routes"], "weekly"),
    roadmap("Schedule strength", "Adjust future weeks by opponent, venue, rest, and playoff-week matchups.", ["NFL schedule", "team defense metrics", "weather later"], "weekly"),
    roadmap("ADP and market", "Detect value versus market price and draft-room opportunity cost.", ["Sleeper ADP", "rankings uploads", "draft history"], "daily during draft season"),
    roadmap("Projection provider blend", "Blend forward-looking projections with historical evidence and league scoring.", ["FantasyPros", "SportsDataIO", "nflverse projections"], "provider-specific")
  ];
}

function roadmap(area: string, purpose: string, futureSourceCandidates: string[], refreshCadence: string): ContextRoadmapItem {
  return {
    area,
    purpose,
    currentStatus: area === "Team offensive environment" ? "foundation_available" : "schema_only",
    currentSource: area === "Team offensive environment" ? "team_game_stats historical rows" : "none in H6",
    futureSourceCandidates,
    refreshCadence,
    confidencePolicy: "Unknown remains unknown until source-backed evidence exists; no neutral defaults are inferred."
  };
}

function averageNullable(values: Array<number | null>) {
  const numeric = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (numeric.length === 0) return null;
  return Math.round((numeric.reduce((sum, value) => sum + value, 0) / numeric.length) * 1000) / 1000;
}

