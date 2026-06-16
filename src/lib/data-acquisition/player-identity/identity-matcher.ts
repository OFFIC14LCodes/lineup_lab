import { buildManualOverrideIndex, type IdentityManualOverride } from "./identity-manual-overrides";
import type { PlayerIdentityMatch, PlayerIdentityRecord, PlayerIdentityIds, IdentityMatchConfidence } from "./identity-match-types";

export type IdentityMatcherOptions = {
  manualOverrides?: IdentityManualOverride[];
};

type CandidateScore = {
  candidate: PlayerIdentityRecord;
  score: number;
  reasons: string[];
  conflictReasons: string[];
  exactId: boolean;
};

export function matchPlayerIdentity(sourcePlayer: PlayerIdentityRecord, candidates: PlayerIdentityRecord[], options: IdentityMatcherOptions = {}): PlayerIdentityMatch {
  const overrideMatch = matchManualOverride(sourcePlayer, candidates, options.manualOverrides ?? []);
  if (overrideMatch) return overrideMatch;

  const scored = candidates
    .map((candidate) => scoreCandidate(sourcePlayer, candidate))
    .filter((candidate) => candidate.score > 0 || candidate.conflictReasons.length > 0)
    .sort((a, b) => b.score - a.score || a.candidate.playerName.localeCompare(b.candidate.playerName) || a.candidate.playerId.localeCompare(b.candidate.playerId));

  const exact = scored.filter((candidate) => candidate.exactId);
  if (exact.length === 1) return buildMatch(sourcePlayer, exact[0], "exact_id", scored);
  if (exact.length > 1) return buildConflict(sourcePlayer, exact, "multiple exact ID candidates");

  const best = scored[0];
  if (!best) return buildUnmatched(sourcePlayer);

  const tiedBest = scored.filter((candidate) => candidate.score === best.score);
  if (tiedBest.length > 1 && best.score >= 65) {
    return buildConflict(sourcePlayer, tiedBest, "duplicate candidates at the best confidence score");
  }

  const confidence = confidenceForScore(best.score, best.conflictReasons);
  if (confidence === "conflict") return buildConflict(sourcePlayer, [best], best.conflictReasons.join("; "));
  if (confidence === "unmatched") return buildUnmatched(sourcePlayer, scored);
  return buildMatch(sourcePlayer, best, confidence, scored);
}

export function matchPlayerIdentities(sourcePlayers: PlayerIdentityRecord[], candidates: PlayerIdentityRecord[], options: IdentityMatcherOptions = {}): PlayerIdentityMatch[] {
  const index = buildCandidateIndex(candidates);
  const manualOverrideIndex = buildManualOverrideIndex(options.manualOverrides ?? []);
  return sourcePlayers.map((sourcePlayer) => {
    const selectedCandidates = indexedCandidates(sourcePlayer, index, manualOverrideIndex);
    return matchPlayerIdentity(sourcePlayer, selectedCandidates, options);
  });
}

function matchManualOverride(sourcePlayer: PlayerIdentityRecord, candidates: PlayerIdentityRecord[], manualOverrides: IdentityManualOverride[]): PlayerIdentityMatch | null {
  if (!sourcePlayer.ids.sleeperId || !manualOverrides.length) return null;
  const overrides = manualOverrides.filter((override) => override.sleeperId === sourcePlayer.ids.sleeperId);
  if (!overrides.length) return null;

  if (overrides.length > 1) {
    return buildConflict(
      sourcePlayer,
      overrides.map((override) => ({
        candidate: sourcePlayer,
        score: 1000,
        reasons: [`manual override duplicate for sleeper_id ${override.sleeperId}`],
        conflictReasons: [`multiple approved manual overrides for sleeper_id ${override.sleeperId}`],
        exactId: false,
      })),
      `multiple approved manual overrides for sleeper_id ${sourcePlayer.ids.sleeperId}`,
    );
  }

  const override = overrides[0];
  const targets = candidates.filter((candidate) => candidate.ids.gsisId === override.gsisId || candidate.playerId === override.gsisId);
  if (targets.length === 0) {
    return {
      sourcePlayer,
      matchedPlayer: null,
      confidence: "conflict",
      score: 1000,
      matchReasons: [
        `manual override requested: sleeper_id ${override.sleeperId} -> gsis_id ${override.gsisId}`,
        ...(override.reason ? [`manual override reason: ${override.reason}`] : []),
      ],
      conflictReasons: [`manual override target gsis_id not found: ${override.gsisId}`],
      candidateCount: candidates.length,
      candidateExamples: examples(candidates.map((candidate) => ({ candidate, score: 0, reasons: [], conflictReasons: [], exactId: false }))),
      preservedIds: sourcePlayer.ids,
    };
  }

  if (targets.length > 1) {
    return buildConflict(
      sourcePlayer,
      targets.map((candidate) => ({
        candidate,
        score: 1000,
        reasons: [`manual override target: sleeper_id ${override.sleeperId} -> gsis_id ${override.gsisId}`],
        conflictReasons: [`manual override target gsis_id maps to multiple candidates: ${override.gsisId}`],
        exactId: false,
      })),
      `manual override target gsis_id maps to multiple candidates: ${override.gsisId}`,
    );
  }

  return buildMatch(
    sourcePlayer,
    {
      candidate: targets[0],
      score: 1000,
      reasons: [
        `manual override applied: sleeper_id ${override.sleeperId} -> gsis_id ${override.gsisId}`,
        `manual override review_status: ${override.reviewStatus}`,
        ...(override.reason ? [`manual override reason: ${override.reason}`] : []),
      ],
      conflictReasons: [],
      exactId: false,
    },
    "manual_override",
    candidates.map((candidate) => ({
      candidate,
      score: candidate.playerId === targets[0].playerId ? 1000 : 0,
      reasons: candidate.playerId === targets[0].playerId ? [`manual override target: gsis_id ${override.gsisId}`] : [],
      conflictReasons: [],
      exactId: false,
    })),
  );
}

function scoreCandidate(source: PlayerIdentityRecord, candidate: PlayerIdentityRecord): CandidateScore {
  const reasons: string[] = [];
  const conflictReasons: string[] = [];
  let score = 0;

  const exactIds = matchingIdLabels(source.ids, candidate.ids);
  if (exactIds.length) {
    score += 100;
    reasons.push(`exact ID match: ${exactIds.join(", ")}`);
  }

  if (source.normalizedName && source.normalizedName === candidate.normalizedName) {
    score += 45;
    reasons.push("normalized full name match");
  }

  if (!exactIds.length && !reasons.includes("normalized full name match")) {
    return { candidate, score: 0, reasons: [], conflictReasons: [], exactId: false };
  }

  if (source.position && candidate.position && source.position === candidate.position) {
    score += 25;
    reasons.push("position match");
  } else if (source.position && candidate.position) {
    score -= 20;
    conflictReasons.push(`position mismatch: ${source.position} vs ${candidate.position}`);
  }

  if (source.team && candidate.team && source.team === candidate.team) {
    score += 15;
    reasons.push("team match");
  } else if (source.team && candidate.team) {
    score -= 8;
    reasons.push(`team mismatch lowered confidence: ${source.team} vs ${candidate.team}`);
  }

  if (source.rookieSeason && candidate.rookieSeason && source.rookieSeason === candidate.rookieSeason) {
    score += 8;
    reasons.push("rookie season match");
  } else if (source.rookieSeason && candidate.rookieSeason) {
    score -= 4;
    reasons.push(`rookie season mismatch lowered confidence: ${source.rookieSeason} vs ${candidate.rookieSeason}`);
  }

  if (source.birthDate && candidate.birthDate && source.birthDate === candidate.birthDate) {
    score += 10;
    reasons.push("birth date match");
  } else if (source.birthDate && candidate.birthDate) {
    score -= 12;
    conflictReasons.push(`birth date mismatch: ${source.birthDate} vs ${candidate.birthDate}`);
  }

  if (source.height && candidate.height && source.height === candidate.height) {
    score += 2;
    reasons.push("height support");
  }
  if (source.weight && candidate.weight && Math.abs(source.weight - candidate.weight) <= 5) {
    score += 2;
    reasons.push("weight support");
  }

  return {
    candidate,
    score,
    reasons,
    conflictReasons,
    exactId: exactIds.length > 0,
  };
}

function buildCandidateIndex(candidates: PlayerIdentityRecord[]) {
  const byId = new Map<string, PlayerIdentityRecord[]>();
  const byName = new Map<string, PlayerIdentityRecord[]>();
  for (const candidate of candidates) {
    addIndex(byName, candidate.normalizedName, candidate);
    for (const id of identityValues(candidate.ids)) {
      addIndex(byId, id, candidate);
    }
  }
  return { candidates, byId, byName };
}

function indexedCandidates(
  source: PlayerIdentityRecord,
  index: ReturnType<typeof buildCandidateIndex>,
  manualOverrideIndex: Map<string, IdentityManualOverride[]> = new Map(),
): PlayerIdentityRecord[] {
  const selected = new Map<string, PlayerIdentityRecord>();
  for (const id of identityValues(source.ids)) {
    for (const candidate of index.byId.get(id) ?? []) selected.set(candidate.playerId, candidate);
  }
  for (const override of manualOverrideIndex.get(source.ids.sleeperId ?? "") ?? []) {
    for (const candidate of index.byId.get(override.gsisId) ?? []) selected.set(candidate.playerId, candidate);
  }
  for (const candidate of index.byName.get(source.normalizedName) ?? []) selected.set(candidate.playerId, candidate);
  return Array.from(selected.values());
}

function addIndex(index: Map<string, PlayerIdentityRecord[]>, key: string | null | undefined, record: PlayerIdentityRecord) {
  if (!key) return;
  index.set(key, [...(index.get(key) ?? []), record]);
}

function confidenceForScore(score: number, conflictReasons: string[]): IdentityMatchConfidence {
  if (conflictReasons.some((reason) => reason.startsWith("birth date mismatch"))) return "conflict";
  if (score >= 80) return "strong";
  if (score >= 65) return "strong";
  if (score >= 50) return "medium";
  if (score >= 35) return "weak";
  return "unmatched";
}

function buildMatch(
  sourcePlayer: PlayerIdentityRecord,
  best: CandidateScore,
  confidence: IdentityMatchConfidence,
  scored: CandidateScore[],
): PlayerIdentityMatch {
  return {
    sourcePlayer,
    matchedPlayer: best.candidate,
    confidence,
    score: best.score,
    matchReasons: best.reasons,
    conflictReasons: best.conflictReasons,
    candidateCount: scored.length,
    candidateExamples: examples(scored),
    preservedIds: mergeIds(sourcePlayer.ids, best.candidate.ids),
  };
}

function buildConflict(sourcePlayer: PlayerIdentityRecord, conflicts: CandidateScore[], reason: string): PlayerIdentityMatch {
  return {
    sourcePlayer,
    matchedPlayer: null,
    confidence: "conflict",
    score: conflicts[0]?.score ?? 0,
    matchReasons: conflicts.flatMap((candidate) => candidate.reasons),
    conflictReasons: [reason, ...conflicts.flatMap((candidate) => candidate.conflictReasons)],
    candidateCount: conflicts.length,
    candidateExamples: examples(conflicts),
    preservedIds: sourcePlayer.ids,
  };
}

function buildUnmatched(sourcePlayer: PlayerIdentityRecord, scored: CandidateScore[] = []): PlayerIdentityMatch {
  return {
    sourcePlayer,
    matchedPlayer: null,
    confidence: "unmatched",
    score: scored[0]?.score ?? 0,
    matchReasons: scored[0]?.reasons ?? [],
    conflictReasons: scored[0]?.conflictReasons ?? [],
    candidateCount: scored.length,
    candidateExamples: examples(scored),
    preservedIds: sourcePlayer.ids,
  };
}

function examples(scored: CandidateScore[]): PlayerIdentityMatch["candidateExamples"] {
  return scored.slice(0, 5).map((candidate) => ({
    playerId: candidate.candidate.playerId,
    playerName: candidate.candidate.playerName,
    position: candidate.candidate.position,
    team: candidate.candidate.team,
    score: candidate.score,
    reasons: candidate.reasons,
  }));
}

function matchingIdLabels(source: PlayerIdentityIds, candidate: PlayerIdentityIds): string[] {
  const labels: string[] = [];
  if (source.sleeperId && candidate.sleeperId && source.sleeperId === candidate.sleeperId) labels.push("sleeper_id");
  if (source.gsisId && candidate.gsisId && source.gsisId === candidate.gsisId) labels.push("gsis_id");
  if (source.espnId && candidate.espnId && source.espnId === candidate.espnId) labels.push("espn_id");
  if (source.pfrId && candidate.pfrId && source.pfrId === candidate.pfrId) labels.push("pfr_id");
  if (source.nflId && candidate.nflId && source.nflId === candidate.nflId) labels.push("nfl_id");
  if (source.smartId && candidate.smartId && source.smartId === candidate.smartId) labels.push("smart_id");
  return labels;
}

function identityValues(ids: PlayerIdentityIds): string[] {
  return [ids.sleeperId, ids.gsisId, ids.espnId, ids.pfrId, ids.nflId, ids.smartId, ids.blackbirdPlayerId].filter((id): id is string => Boolean(id));
}

function mergeIds(source: PlayerIdentityIds, candidate: PlayerIdentityIds): PlayerIdentityIds {
  return {
    blackbirdPlayerId: source.blackbirdPlayerId ?? candidate.blackbirdPlayerId,
    sleeperId: source.sleeperId ?? candidate.sleeperId,
    gsisId: source.gsisId ?? candidate.gsisId,
    espnId: source.espnId ?? candidate.espnId,
    pfrId: source.pfrId ?? candidate.pfrId,
    nflId: source.nflId ?? candidate.nflId,
    smartId: source.smartId ?? candidate.smartId,
  };
}
