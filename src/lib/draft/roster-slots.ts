export const POSITION_GROUPS = ["QB", "RB", "WR", "TE", "K", "DEF", "DL", "LB", "DB"] as const;
export type PositionGroup = (typeof POSITION_GROUPS)[number];
export type PositionNeedLevel = "urgent" | "high" | "moderate" | "low" | "filled" | "not_used";

export type NormalizedRosterRequirements = {
  directStarters: Record<PositionGroup, number>;
  offensiveFlexCount: number;
  superflexCount: number;
  idpFlexCount: number;
  benchCount: number;
  irCount: number;
  taxiCount: number;
  hasIDP: boolean;
  hasKicker: boolean;
  hasTeamDefense: boolean;
  unknownSlots: string[];
};

export type PositionNeed = {
  position: PositionGroup | "IDP";
  label: string;
  draftedCount: number;
  directStarterRequirement: number;
  sharedFlexDemand: number;
  minimumNeed: number;
  deficit: number;
  needLevel: PositionNeedLevel;
  kind: "direct" | "shared" | "depth";
  note?: string;
  sortScore: number;
};

const DIRECT_SLOT_MAP: Record<string, PositionGroup> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DEF",
  DST: "DEF",
  "D/ST": "DEF",
  DL: "DL",
  DE: "DL",
  DT: "DL",
  EDGE: "DL",
  LB: "LB",
  ILB: "LB",
  OLB: "LB",
  MLB: "LB",
  DB: "DB",
  CB: "DB",
  S: "DB",
  FS: "DB",
  SS: "DB"
};

const OFFENSIVE_FLEX_SLOTS = new Set(["FLEX", "W/R/T", "WRRB_FLEX", "WRRBTE_FLEX", "REC_FLEX"]);
const SUPERFLEX_SLOTS = new Set(["SUPER_FLEX", "SUPERFLEX", "OP"]);
const IDP_FLEX_SLOTS = new Set(["IDP", "IDP_FLEX", "FLEX_IDP", "DP"]);
const BENCH_SLOTS = new Set(["BN", "BENCH"]);
const IR_SLOTS = new Set(["IR", "RESERVE"]);
const TAXI_SLOTS = new Set(["TAXI", "TAXI_SQUAD"]);

export function buildNormalizedRosterRequirements(
  rosterSlots: string[] | null | undefined
): NormalizedRosterRequirements {
  const directStarters = Object.fromEntries(POSITION_GROUPS.map((position) => [position, 0])) as Record<PositionGroup, number>;
  const requirements: NormalizedRosterRequirements = {
    directStarters,
    offensiveFlexCount: 0,
    superflexCount: 0,
    idpFlexCount: 0,
    benchCount: 0,
    irCount: 0,
    taxiCount: 0,
    hasIDP: false,
    hasKicker: false,
    hasTeamDefense: false,
    unknownSlots: []
  };

  for (const rawSlot of Array.isArray(rosterSlots) ? rosterSlots : []) {
    const slot = normalizeRosterSlot(rawSlot);
    if (!slot) continue;

    if (BENCH_SLOTS.has(slot)) {
      requirements.benchCount += 1;
      continue;
    }
    if (IR_SLOTS.has(slot)) {
      requirements.irCount += 1;
      continue;
    }
    if (TAXI_SLOTS.has(slot)) {
      requirements.taxiCount += 1;
      continue;
    }
    if (OFFENSIVE_FLEX_SLOTS.has(slot)) {
      requirements.offensiveFlexCount += 1;
      continue;
    }
    if (SUPERFLEX_SLOTS.has(slot)) {
      requirements.superflexCount += 1;
      continue;
    }
    if (IDP_FLEX_SLOTS.has(slot)) {
      requirements.idpFlexCount += 1;
      requirements.hasIDP = true;
      continue;
    }

    const direct = DIRECT_SLOT_MAP[slot];
    if (direct) {
      requirements.directStarters[direct] += 1;
      if (direct === "K") requirements.hasKicker = true;
      if (direct === "DEF") requirements.hasTeamDefense = true;
      if (direct === "DL" || direct === "LB" || direct === "DB") requirements.hasIDP = true;
      continue;
    }

    requirements.unknownSlots.push(slot);
  }

  return requirements;
}

export function buildPositionNeeds(
  draftedCounts: Record<string, number>,
  requirements: NormalizedRosterRequirements
): PositionNeed[] {
  const needs = POSITION_GROUPS.map((position) => buildPositionNeed(position, draftedCounts[position] ?? 0, requirements));

  if (
    requirements.idpFlexCount > 0 &&
    requirements.directStarters.DL === 0 &&
    requirements.directStarters.LB === 0 &&
    requirements.directStarters.DB === 0
  ) {
    const totalIdpDrafted = (draftedCounts.DL ?? 0) + (draftedCounts.LB ?? 0) + (draftedCounts.DB ?? 0);
    needs.push({
      position: "IDP",
      label: "IDP Flex",
      draftedCount: totalIdpDrafted,
      directStarterRequirement: 0,
      sharedFlexDemand: requirements.idpFlexCount,
      minimumNeed: requirements.idpFlexCount,
      deficit: Math.max(0, requirements.idpFlexCount - totalIdpDrafted),
      needLevel:
        totalIdpDrafted === 0 ? "high" : totalIdpDrafted < requirements.idpFlexCount ? "moderate" : "filled",
      kind: totalIdpDrafted < requirements.idpFlexCount ? "shared" : "depth",
      note: "Shared defensive flex demand across DL/LB/DB.",
      sortScore: totalIdpDrafted === 0 ? 210 : totalIdpDrafted < requirements.idpFlexCount ? 135 : 15
    });
  }

  return needs.sort((a, b) => b.sortScore - a.sortScore || a.label.localeCompare(b.label));
}

export function buildTopNeeds(positionNeeds: PositionNeed[]): Array<{
  position: string;
  current: number;
  target: number;
  need: number;
  sharedFlexDemand?: number;
  needLevel?: PositionNeedLevel;
  kind?: "direct" | "shared" | "depth";
  label?: string;
  note?: string;
}> {
  return positionNeeds
    .filter((need) => need.needLevel !== "filled" && need.needLevel !== "not_used")
    .map((need) => ({
      position: need.position,
      current: need.draftedCount,
      target: need.minimumNeed,
      need: need.sortScore,
      sharedFlexDemand: need.sharedFlexDemand,
      needLevel: need.needLevel,
      kind: need.kind,
      label: need.label,
      note: need.note
    }))
    .slice(0, 8);
}

function buildPositionNeed(
  position: PositionGroup,
  draftedCount: number,
  requirements: NormalizedRosterRequirements
): PositionNeed {
  const directStarterRequirement = requirements.directStarters[position];
  const sharedFlexDemand = getSharedFlexDemand(position, requirements);
  const minimumNeed = getMinimumNeed(position, directStarterRequirement, sharedFlexDemand);
  const deficit = Math.max(0, minimumNeed - draftedCount);
  const usesPosition = directStarterRequirement > 0 || sharedFlexDemand > 0;

  if (!usesPosition) {
    return {
      position,
      label: position,
      draftedCount,
      directStarterRequirement,
      sharedFlexDemand,
      minimumNeed,
      deficit,
      needLevel: "not_used",
      kind: "direct",
      sortScore: 0
    };
  }

  const directDeficit = Math.max(0, directStarterRequirement - draftedCount);
  const hasSharedPressure = sharedFlexDemand > 0;
  const depthGap = draftedCount <= directStarterRequirement && hasSharedPressure;

  let needLevel: PositionNeedLevel = "filled";
  let kind: PositionNeed["kind"] = "direct";
  let note: string | undefined;

  if (directDeficit > 1 || (position === "QB" && requirements.superflexCount > 0 && draftedCount === 0)) {
    needLevel = "urgent";
  } else if (directDeficit === 1 || (position === "QB" && requirements.superflexCount > 0 && draftedCount === 1)) {
    needLevel = "high";
  } else if (depthGap) {
    needLevel = "moderate";
    kind = "shared";
  } else if (hasSharedPressure && draftedCount === minimumNeed) {
    needLevel = "low";
    kind = "depth";
  } else {
    needLevel = "filled";
  }

  if (position === "QB" && requirements.superflexCount > 0) {
    note = "Superflex keeps QB demand elevated.";
  } else if (["RB", "WR", "TE"].includes(position) && requirements.offensiveFlexCount > 0) {
    note = "Shared offensive flex demand still matters.";
  } else if (["DL", "LB", "DB"].includes(position) && requirements.idpFlexCount > 0) {
    note = "IDP flex still influences defensive depth.";
  }

  return {
    position,
    label: position,
    draftedCount,
    directStarterRequirement,
    sharedFlexDemand,
    minimumNeed,
    deficit,
    needLevel,
    kind,
    note,
    sortScore: scoreNeed(position, needLevel, directDeficit, sharedFlexDemand)
  };
}

function getSharedFlexDemand(position: PositionGroup, requirements: NormalizedRosterRequirements) {
  if (position === "QB") return requirements.superflexCount;
  if (position === "RB" || position === "WR" || position === "TE") {
    return requirements.offensiveFlexCount + requirements.superflexCount;
  }
  if (position === "DL" || position === "LB" || position === "DB") {
    return requirements.idpFlexCount;
  }
  return 0;
}

function getMinimumNeed(position: PositionGroup, directStarterRequirement: number, sharedFlexDemand: number) {
  if (position === "QB") return directStarterRequirement + Math.min(sharedFlexDemand, 1);
  if (position === "RB" || position === "WR") return directStarterRequirement + (sharedFlexDemand > 0 ? 1 : 0);
  if (position === "TE") return directStarterRequirement + (sharedFlexDemand >= 2 ? 1 : 0);
  if (position === "DL" || position === "LB" || position === "DB") return directStarterRequirement + (sharedFlexDemand > 0 ? 1 : 0);
  return directStarterRequirement;
}

function scoreNeed(
  position: PositionGroup,
  needLevel: PositionNeedLevel,
  directDeficit: number,
  sharedFlexDemand: number
) {
  const base =
    needLevel === "urgent"
      ? 220
      : needLevel === "high"
        ? 170
        : needLevel === "moderate"
          ? 120
          : needLevel === "low"
            ? 70
            : needLevel === "filled"
              ? 15
              : 0;

  const positionBias = position === "QB" ? 9 : position === "RB" || position === "WR" ? 6 : position === "TE" ? 4 : 2;
  return base + directDeficit * 10 + sharedFlexDemand * 2 + positionBias;
}

function normalizeRosterSlot(slot: string | null | undefined) {
  return slot?.trim().toUpperCase().replace(/\s+/g, "_") || null;
}

// Example inputs for manual verification:
// ["QB","RB","RB","WR","WR","TE","FLEX","BN"] => offense-only
// ["QB","SUPER_FLEX","RB","RB","WR","WR","TE"] => superflex
// ["QB","RB","RB","WR","WR","TE","K","DEF"] => kicker and team defense
// ["DL","LB","DB","IDP_FLEX","BN"] => direct IDP plus shared defensive flex

// TODO: Add defensive slot assignment using player multi-position eligibility.
