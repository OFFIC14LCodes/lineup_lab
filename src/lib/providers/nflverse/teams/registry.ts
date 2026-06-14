// Canonical NFL team registry — 32 active franchises.
// Canonical IDs match nflverse abbreviations (used in schedules + PBP CSVs).

export type NflTeam = {
  id: string;
  fullName: string;
  conference: "AFC" | "NFC";
  division: string;
};

export const NFL_TEAMS: NflTeam[] = [
  { id: "ARI", fullName: "Arizona Cardinals",     conference: "NFC", division: "NFC West"  },
  { id: "ATL", fullName: "Atlanta Falcons",        conference: "NFC", division: "NFC South" },
  { id: "BAL", fullName: "Baltimore Ravens",       conference: "AFC", division: "AFC North" },
  { id: "BUF", fullName: "Buffalo Bills",          conference: "AFC", division: "AFC East"  },
  { id: "CAR", fullName: "Carolina Panthers",      conference: "NFC", division: "NFC South" },
  { id: "CHI", fullName: "Chicago Bears",          conference: "NFC", division: "NFC North" },
  { id: "CIN", fullName: "Cincinnati Bengals",     conference: "AFC", division: "AFC North" },
  { id: "CLE", fullName: "Cleveland Browns",       conference: "AFC", division: "AFC North" },
  { id: "DAL", fullName: "Dallas Cowboys",         conference: "NFC", division: "NFC East"  },
  { id: "DEN", fullName: "Denver Broncos",         conference: "AFC", division: "AFC West"  },
  { id: "DET", fullName: "Detroit Lions",          conference: "NFC", division: "NFC North" },
  { id: "GB",  fullName: "Green Bay Packers",      conference: "NFC", division: "NFC North" },
  { id: "HOU", fullName: "Houston Texans",         conference: "AFC", division: "AFC South" },
  { id: "IND", fullName: "Indianapolis Colts",     conference: "AFC", division: "AFC South" },
  { id: "JAX", fullName: "Jacksonville Jaguars",   conference: "AFC", division: "AFC South" },
  { id: "KC",  fullName: "Kansas City Chiefs",     conference: "AFC", division: "AFC West"  },
  { id: "LA",  fullName: "Los Angeles Rams",       conference: "NFC", division: "NFC West"  },
  { id: "LAC", fullName: "Los Angeles Chargers",   conference: "AFC", division: "AFC West"  },
  { id: "LV",  fullName: "Las Vegas Raiders",      conference: "AFC", division: "AFC West"  },
  { id: "MIA", fullName: "Miami Dolphins",         conference: "AFC", division: "AFC East"  },
  { id: "MIN", fullName: "Minnesota Vikings",      conference: "NFC", division: "NFC North" },
  { id: "NE",  fullName: "New England Patriots",   conference: "AFC", division: "AFC East"  },
  { id: "NO",  fullName: "New Orleans Saints",     conference: "NFC", division: "NFC South" },
  { id: "NYG", fullName: "New York Giants",        conference: "NFC", division: "NFC East"  },
  { id: "NYJ", fullName: "New York Jets",          conference: "AFC", division: "AFC East"  },
  { id: "PHI", fullName: "Philadelphia Eagles",    conference: "NFC", division: "NFC East"  },
  { id: "PIT", fullName: "Pittsburgh Steelers",    conference: "AFC", division: "AFC North" },
  { id: "SF",  fullName: "San Francisco 49ers",    conference: "NFC", division: "NFC West"  },
  { id: "SEA", fullName: "Seattle Seahawks",       conference: "NFC", division: "NFC West"  },
  { id: "TB",  fullName: "Tampa Bay Buccaneers",   conference: "NFC", division: "NFC South" },
  { id: "TEN", fullName: "Tennessee Titans",       conference: "AFC", division: "AFC South" },
  { id: "WAS", fullName: "Washington Commanders",  conference: "NFC", division: "NFC East"  },
];

export const NFL_TEAM_IDS = new Set(NFL_TEAMS.map((t) => t.id));

export const NFL_TEAMS_BY_ID = new Map(NFL_TEAMS.map((t) => [t.id, t]));
