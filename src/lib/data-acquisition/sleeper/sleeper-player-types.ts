import type { BlackbirdNflversePosition } from "@/lib/data-acquisition/nflverse";

export type SleeperRawPlayer = {
  player_id?: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  search_full_name?: string | null;
  position?: string | null;
  fantasy_positions?: string[] | null;
  team?: string | null;
  status?: string | null;
  active?: boolean | null;
  age?: number | string | null;
  birth_date?: string | null;
  height?: number | string | null;
  weight?: number | string | null;
  college?: string | null;
  years_exp?: number | string | null;
  injury_status?: string | null;
  search_rank?: number | string | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type SleeperNormalizedPlayer = {
  sleeperId: string;
  playerName: string;
  firstName: string | null;
  lastName: string | null;
  searchFullName: string | null;
  position: BlackbirdNflversePosition | null;
  rawPosition: string | null;
  fantasyPositions: BlackbirdNflversePosition[];
  team: string | null;
  status: string | null;
  active: boolean;
  age: number | null;
  birthDate: string | null;
  height: number | null;
  weight: number | null;
  college: string | null;
  yearsExperience: number | null;
  injuryStatus: string | null;
  searchRank: number | null;
  externalIds: Record<string, string>;
};
