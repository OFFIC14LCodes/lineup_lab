import { normalizeRookieProfile } from "@/lib/projections/rookie-data-sources";
import type { CollegeProductionRecord } from "./college-production-source";
import type { DraftCapitalRecord } from "./nfl-draft-capital-source";
import type { RoleNotesRecord } from "./role-notes-source";

export type CollegeProspectProfile = {
  playerId: string | null;
  playerName: string;
  position: string;
  team: string | null;
  draftCapitalScore: number | null;
  collegeProductionScore: number | null;
  opportunityScore: number | null;
  landingSpotRole: string;
  availableInputs: string[];
  dataGaps: string[];
  sourceLabels: string[];
  confidence: "very_low" | "low" | "medium" | "high";
};

export function buildCollegeProspectProfile(input: {
  draftCapital?: DraftCapitalRecord | null;
  collegeProduction?: CollegeProductionRecord | null;
  roleNotes?: RoleNotesRecord | null;
  fallback?: {
    playerId?: string | null;
    playerName: string;
    position: string;
    team?: string | null;
    season: number;
  };
}): CollegeProspectProfile {
  const fallback = input.fallback;
  const playerName = input.draftCapital?.playerName || input.collegeProduction?.playerName || input.roleNotes?.playerName || fallback?.playerName || "";
  const position = input.draftCapital?.position || input.collegeProduction?.position || input.roleNotes?.position || fallback?.position || "";
  const team = input.draftCapital?.team ?? input.roleNotes?.team ?? fallback?.team ?? null;
  const profile = normalizeRookieProfile({
    playerId: input.draftCapital?.playerId ?? input.collegeProduction?.playerId ?? input.roleNotes?.playerId ?? fallback?.playerId ?? null,
    playerName,
    position,
    team,
    season: input.draftCapital?.season ?? input.roleNotes?.season ?? fallback?.season ?? new Date().getFullYear(),
    nflDraftRound: input.draftCapital?.nflDraftRound ?? null,
    nflDraftPick: input.draftCapital?.nflDraftPick ?? null,
    nflDraftOverall: input.draftCapital?.nflDraftOverall ?? null,
    nflDraftTeam: input.draftCapital?.nflDraftTeam ?? null,
    college: input.collegeProduction?.college ?? null,
    collegeConference: input.collegeProduction?.collegeConference ?? null,
    ...input.collegeProduction?.stats,
    landingSpotRole: input.roleNotes?.landingSpotRole ?? null,
    opportunityNotes: input.roleNotes?.opportunityNotes ?? [],
    source: "csv_import",
    sourceLabel: [
      input.draftCapital?.attribution.sourceLabel,
      input.collegeProduction?.attribution.sourceLabel,
      input.roleNotes?.attribution.sourceLabel,
    ].filter((value): value is string => Boolean(value)).join(" + ") || "college prospect profile",
  });
  return {
    playerId: profile.playerId,
    playerName: profile.playerName,
    position: profile.position,
    team: profile.team,
    draftCapitalScore: profile.draftCapitalScore,
    collegeProductionScore: profile.collegeProductionScore,
    opportunityScore: profile.opportunityScore,
    landingSpotRole: profile.landingSpotRole,
    availableInputs: profile.availableInputs,
    dataGaps: profile.dataGaps,
    sourceLabels: profile.sourceLabels,
    confidence: profile.rookieProjectionConfidence,
  };
}
