import type { AvailabilityModel, DraftStageVariance } from "./types";

// Abramowitz & Stegun erf approximation (max error 1.5e-7).
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return sign * (1 - poly * Math.exp(-x * x));
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// P(player available at pick p) assuming ADP ~ N(adp, sigma)
// = P(pick > p) = 1 - CDF((p - adp) / sigma)
function probAvailableAtPick(adp: number, sigma: number, pick: number): number {
  if (sigma <= 0) return pick < adp ? 1 : pick === adp ? 0.5 : 0;
  return Math.max(0, Math.min(1, 1 - normalCdf((pick - adp) / sigma)));
}

function draftStage(adp: number): DraftStageVariance {
  if (adp <= 24) return "tight";
  if (adp <= 96) return "normal";
  return "wide";
}

function effectiveStddev(adp: number, rawStddev: number | null): number {
  const estimated = rawStddev ?? Math.max(5, adp * 0.10);
  const stage = draftStage(adp);
  if (stage === "tight") return Math.max(4, estimated * 0.75);
  if (stage === "wide") return Math.max(12, estimated * 1.25);
  return Math.max(7, estimated);
}

// Pick windows to precompute: from pick 1 to pick 240, every pick.
// Callers can sample any pick from the returned record.
const PICK_RANGE = Array.from({ length: 240 }, (_, i) => i + 1);

export function buildAvailabilityModel(
  canonicalPlayerId: string,
  playerName: string | null,
  overallAdp: number,
  rawStddev: number | null
): AvailabilityModel {
  const sigma = effectiveStddev(overallAdp, rawStddev);
  const stage = draftStage(overallAdp);

  const probAvailableAt: Record<string, number> = {};
  for (const pick of PICK_RANGE) {
    const prob = probAvailableAtPick(overallAdp, sigma, pick);
    if (prob >= 0.001) {
      // Only store non-negligible probabilities to keep the object compact
      probAvailableAt[String(pick)] = Math.round(prob * 1000) / 1000;
    }
  }

  return {
    canonicalPlayerId,
    playerName,
    overallAdp,
    rawStddev: rawStddev !== null ? Math.round(rawStddev * 100) / 100 : null,
    effectiveStddev: Math.round(sigma * 100) / 100,
    draftStageVariance: stage,
    probAvailableAt,
  };
}

// Convenience: probability a player is available one round later in a k-team league.
export function probAvailableNextRound(model: AvailabilityModel, currentPick: number, teamCount: number): number {
  const targetPick = currentPick + teamCount;
  return Number(model.probAvailableAt[String(targetPick)] ?? 0);
}

// Build availability models for all resolved players in a consensus set.
export function buildAvailabilityModels(
  players: Array<{ canonicalPlayerId: string; playerName: string | null; overallAdp: number; adpStddev: number | null }>
): AvailabilityModel[] {
  return players.map((p) =>
    buildAvailabilityModel(p.canonicalPlayerId, p.playerName, p.overallAdp, p.adpStddev)
  );
}
