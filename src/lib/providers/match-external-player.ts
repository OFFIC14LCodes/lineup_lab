import {
  classifySideOfBall,
  normalizePlayerName,
  normalizePositionGroup,
  normalizeTeam
} from "@/lib/players/normalize";
import {
  normalizeExternalEntityType,
  normalizeExternalId,
  normalizeProviderName
} from "@/lib/providers/constants";
import type {
  ExternalPlayerCandidate,
  ExternalMappingResult,
  PlayerExternalIdRow
} from "@/lib/providers/types";

export type ExternalMatchablePlayer = {
  id: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  normalized_name?: string | null;
  team: string | null;
  primary_position?: string | null;
  position_group?: string | null;
  side_of_ball?: string | null;
  metadata_json?: Record<string, unknown> | null;
  existingExternalIds?: Array<Pick<PlayerExternalIdRow, "provider" | "external_id" | "external_type">>;
};

type MatchContext = {
  candidate: ExternalPlayerCandidate;
  externalId: string;
  externalType: ReturnType<typeof normalizeExternalEntityType>;
  normalizedName: string;
  normalizedTeam: string | null;
  normalizedPositionGroup: string | null;
  sideOfBall: string | null;
};

export function matchExternalPlayer(
  candidate: ExternalPlayerCandidate,
  players: ExternalMatchablePlayer[]
): ExternalMappingResult {
  const context = buildContext(candidate);
  const exactMapped = players.filter((player) => hasExistingExternalId(player, context));
  if (exactMapped.length === 1) {
    return matched(exactMapped[0].id, "verified", "provider_supplied", 1, ["Existing provider ID mapping found."]);
  }
  if (exactMapped.length > 1) {
    return manualReview(exactMapped, ["Existing provider ID is attached to multiple internal players."]);
  }

  const directBridgeMatches = players.filter((player) => hasMetadataBridge(player, context));
  if (directBridgeMatches.length === 1) {
    return matched(directBridgeMatches[0].id, "verified", "direct_bridge", 0.99, ["Direct bridge ID found in player metadata."]);
  }
  if (directBridgeMatches.length > 1) {
    return manualReview(directBridgeMatches, ["Direct bridge data points to multiple internal players."]);
  }

  if (context.externalType === "team_defense" || context.normalizedPositionGroup === "DEF") {
    // DEF/DST stays mapped to the existing players row for that NFL team rather than a separate entity model.
    const defenseMatches = players.filter(
      (player) => getPlayerPositionGroup(player) === "DEF" && normalizeTeam(player.team) === context.normalizedTeam
    );
    if (defenseMatches.length === 1) {
      return matched(defenseMatches[0].id, "auto_matched", "exact_name_team_position", 0.99, [
        "Matched team defense using team and position group."
      ]);
    }
    if (defenseMatches.length > 1) {
      return manualReview(defenseMatches, ["Multiple team defense rows matched the same candidate."]);
    }
  }

  const scopedPlayers = players.filter((player) => matchesNameScope(player, context));

  const nameTeamPosition = scopedPlayers.filter(
    (player) =>
      normalizeTeam(player.team) === context.normalizedTeam &&
      getPlayerPositionGroup(player) === context.normalizedPositionGroup
  );
  if (nameTeamPosition.length === 1) {
    return matched(nameTeamPosition[0].id, "auto_matched", "exact_name_team_position", 0.98, [
      "Exact name, team, and position group match."
    ]);
  }
  if (nameTeamPosition.length > 1) {
    return manualReview(nameTeamPosition, ["Exact name, team, and position group produced multiple candidates."]);
  }

  const namePosition = scopedPlayers.filter(
    (player) => getPlayerPositionGroup(player) === context.normalizedPositionGroup
  );
  if (namePosition.length === 1) {
    return matched(namePosition[0].id, "auto_matched", "exact_name_position", 0.94, [
      "Exact name and position group match."
    ]);
  }
  if (namePosition.length > 1) {
    return manualReview(namePosition, ["Exact name and position group produced multiple candidates."]);
  }

  const nameTeam = scopedPlayers.filter((player) => normalizeTeam(player.team) === context.normalizedTeam);
  if (nameTeam.length === 1) {
    return matched(nameTeam[0].id, "auto_matched", "exact_name_team", 0.9, ["Exact name and team match."]);
  }
  if (nameTeam.length > 1) {
    return manualReview(nameTeam, ["Exact name and team produced multiple candidates."]);
  }

  if (scopedPlayers.length > 1) {
    return manualReview(scopedPlayers, ["Duplicate normalized player names require manual review."]);
  }

  return {
    playerId: null,
    status: "manual_review",
    method: null,
    confidence: 0,
    reasons: ["No safe automatic match was found."],
    candidatePlayerIds: [],
    warnings: ["Manual review required."]
  };
}

function buildContext(candidate: ExternalPlayerCandidate): MatchContext {
  const provider = normalizeProviderName(candidate.provider);
  const externalId = normalizeExternalId(candidate.externalId);
  const externalType = normalizeExternalEntityType(candidate.externalType);
  const normalizedName = normalizePlayerName(candidate.fullName);
  const normalizedTeam = normalizeTeam(candidate.team);
  const normalizedPositionGroup =
    candidate.normalizedPositionGroup
      ? normalizePositionGroup(candidate.normalizedPositionGroup)
      : normalizePositionGroup(candidate.rawPosition);
  const sideOfBall = classifySideOfBall(candidate.normalizedPositionGroup ?? candidate.rawPosition);

  return {
    candidate: {
      ...candidate,
      provider,
      externalId,
      externalType
    },
    externalId,
    externalType,
    normalizedName,
    normalizedTeam,
    normalizedPositionGroup,
    sideOfBall
  };
}

function matchesNameScope(player: ExternalMatchablePlayer, context: MatchContext) {
  const playerName = player.normalized_name ?? normalizePlayerName(buildPlayerName(player));
  if (playerName !== context.normalizedName) {
    return false;
  }

  if (!context.sideOfBall) {
    return true;
  }

  return getPlayerSideOfBall(player) === context.sideOfBall;
}

function hasExistingExternalId(player: ExternalMatchablePlayer, context: MatchContext) {
  return (player.existingExternalIds ?? []).some(
    (mapping) =>
      mapping.provider === context.candidate.provider &&
      mapping.external_id === context.externalId &&
      mapping.external_type === context.externalType
  );
}

function hasMetadataBridge(player: ExternalMatchablePlayer, context: MatchContext) {
  const metadata = player.metadata_json;
  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  const directKeys = [
    `${context.candidate.provider}_id`,
    `${context.candidate.provider}Id`,
    `${context.candidate.provider.toUpperCase()}_ID`
  ];
  for (const key of directKeys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim() === context.externalId) {
      return true;
    }
  }

  const externalIds = metadata.external_ids;
  if (externalIds && typeof externalIds === "object" && !Array.isArray(externalIds)) {
    const externalIdMap = externalIds as Record<string, unknown>;
    const direct = externalIdMap[context.candidate.provider];
    if (typeof direct === "string" && direct.trim() === context.externalId) {
      return true;
    }
  }

  return false;
}

function buildPlayerName(player: ExternalMatchablePlayer) {
  return player.full_name?.trim() || [player.first_name, player.last_name].filter(Boolean).join(" ").trim();
}

function getPlayerPositionGroup(player: ExternalMatchablePlayer) {
  return player.position_group ?? normalizePositionGroup(player.primary_position);
}

function getPlayerSideOfBall(player: ExternalMatchablePlayer) {
  return player.side_of_ball ?? classifySideOfBall(player.primary_position ?? player.position_group);
}

function matched(
  playerId: string,
  status: ExternalMappingResult["status"],
  method: NonNullable<ExternalMappingResult["method"]>,
  confidence: number,
  reasons: string[]
): ExternalMappingResult {
  return {
    playerId,
    status,
    method,
    confidence,
    reasons,
    candidatePlayerIds: [playerId],
    warnings: []
  };
}

function manualReview(players: ExternalMatchablePlayer[], reasons: string[]): ExternalMappingResult {
  return {
    playerId: null,
    status: "manual_review",
    method: null,
    confidence: 0.25,
    reasons,
    candidatePlayerIds: players.map((player) => player.id),
    warnings: ["Manual review required."]
  };
}
