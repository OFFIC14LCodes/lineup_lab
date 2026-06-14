// H7.2: Format group classification and snapshot compatibility.
//
// Format groups partition the ADP universe into buckets whose members can be
// blended into a consensus.  Snapshots from DIFFERENT groups must NOT be
// merged — their player values are not comparable.
//
// Fundamental incompatibilities (never blend):
//   • dynasty startup vs redraft
//   • dynasty startup vs dynasty ongoing
//   • best-ball vs standard draft
//
// Partial incompatibilities (blend with warning + positional discount):
//   • Superflex vs 1QB   — QB tiers diverge materially
//   • PPR vs non-PPR     — RB/WR/TE values shift
//   • TE-premium         — TE-specific value shift
//   • Large team-count gap (>4) — positional scarcity shifts

import type {
  AdpFormatGroup,
  AdpFormatGroupKey,
  AdpFormatProfile,
  LeagueFormatInput,
  SnapshotCompatibility,
  SnapshotCompatibilityReport,
} from "./types";

// --------------------------------------------------------------------------
// Format group labels
// --------------------------------------------------------------------------

export const FORMAT_GROUP_LABELS: Record<AdpFormatGroupKey, string> = {
  redraft_1qb: "Redraft 1QB",
  redraft_superflex: "Redraft Superflex",
  dynasty_startup_1qb: "Dynasty Startup 1QB",
  dynasty_startup_superflex: "Dynasty Startup Superflex",
  dynasty_ongoing_1qb: "Dynasty Ongoing 1QB",
  dynasty_ongoing_superflex: "Dynasty Ongoing Superflex",
  rookie_1qb: "Rookie Draft 1QB",
  rookie_superflex: "Rookie Draft Superflex",
  best_ball: "Best Ball",
};

// --------------------------------------------------------------------------
// Assign a format group key to an ADP source's format profile
// --------------------------------------------------------------------------

export function assignFormatGroupKey(profile: AdpFormatProfile): AdpFormatGroupKey {
  if (profile.isBestBall) return "best_ball";

  if (profile.isDynasty) {
    if (profile.isStartup) {
      return profile.isSuperflex ? "dynasty_startup_superflex" : "dynasty_startup_1qb";
    }
    // Ongoing dynasty (non-startup, non-best-ball dynasty)
    return profile.isSuperflex ? "dynasty_ongoing_superflex" : "dynasty_ongoing_1qb";
  }

  // Redraft
  return profile.isSuperflex ? "redraft_superflex" : "redraft_1qb";
}

// Assign a format group key from a league's configuration.
// Used to pick the best available group when selecting consensus for a league.
export function assignFormatGroupKeyForLeague(
  league: Pick<LeagueFormatInput, "isDynasty" | "isSuperflex" | "isBestBall">
): AdpFormatGroupKey {
  if (league.isBestBall) return "best_ball";
  if (league.isDynasty) return league.isSuperflex ? "dynasty_startup_superflex" : "dynasty_startup_1qb";
  return league.isSuperflex ? "redraft_superflex" : "redraft_1qb";
}

// --------------------------------------------------------------------------
// Snapshot pair compatibility
// --------------------------------------------------------------------------

export function classifySnapshotCompatibility(
  a: AdpFormatProfile,
  b: AdpFormatProfile
): SnapshotCompatibilityReport {
  const reasons: string[] = [];

  // Fundamental incompatibilities — never blend
  if (a.isDynasty !== b.isDynasty) {
    return {
      compatibility: "incompatible",
      reasons: [
        `Dynasty vs redraft mismatch (${a.isDynasty ? "dynasty" : "redraft"} vs ${b.isDynasty ? "dynasty" : "redraft"}) — player values are not comparable`,
      ],
    };
  }
  if (a.isDynasty && a.isStartup !== b.isStartup) {
    return {
      compatibility: "incompatible",
      reasons: [
        `Dynasty startup vs ongoing mismatch — startup ADP reflects career value, ongoing reflects current-team need`,
      ],
    };
  }
  if (a.isBestBall !== b.isBestBall) {
    return {
      compatibility: "incompatible",
      reasons: [
        `Best-ball vs standard draft mismatch — volatility is valued differently`,
      ],
    };
  }

  // Partial incompatibilities — blend with position-level discounts and warnings
  let partial = false;

  if (a.isSuperflex !== b.isSuperflex) {
    reasons.push(
      `Superflex vs 1QB mismatch — QB tier values diverge materially; QB positions should not be blended`
    );
    partial = true;
  }

  const pprDiff = Math.abs(a.pprValue - b.pprValue);
  if (pprDiff >= 0.5) {
    reasons.push(
      `PPR mismatch (${a.pprValue} vs ${b.pprValue}) — RB/WR/TE values shift by scoring format`
    );
    partial = true;
  }

  const teDiff = Math.abs(a.tePremiumValue - b.tePremiumValue);
  if (teDiff >= 0.5) {
    reasons.push(
      `TE premium mismatch (${a.tePremiumValue} vs ${b.tePremiumValue}) — TE-specific value shift`
    );
    partial = true;
  }

  const teamDiff = Math.abs(a.teamCount - b.teamCount);
  if (teamDiff > 4) {
    reasons.push(
      `Team count difference (${a.teamCount} vs ${b.teamCount}) — positional scarcity shifts at large roster gaps`
    );
    partial = true;
  }

  if (partial) return { compatibility: "partially_compatible", reasons };
  return { compatibility: "compatible", reasons: [] };
}

// --------------------------------------------------------------------------
// Group snapshots by format key
// --------------------------------------------------------------------------

export function groupSnapshotsByFormat(
  snapshots: Array<{ id: string; formatProfile: AdpFormatProfile }>
): Map<AdpFormatGroupKey, AdpFormatGroup> {
  const groups = new Map<AdpFormatGroupKey, AdpFormatGroup>();

  for (const snap of snapshots) {
    const key = assignFormatGroupKey(snap.formatProfile);

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: FORMAT_GROUP_LABELS[key],
        snapshotIds: [],
        isDynasty: snap.formatProfile.isDynasty,
        isSuperflex: snap.formatProfile.isSuperflex,
        isStartup: snap.formatProfile.isStartup,
        isRookieOnly: false,
        isBestBall: snap.formatProfile.isBestBall,
      });
    }
    groups.get(key)!.snapshotIds.push(snap.id);
  }

  return groups;
}

// --------------------------------------------------------------------------
// Select the best available format group for a given league
// --------------------------------------------------------------------------

// Returns the format group most compatible with a league's configuration,
// along with the compatibility level and any cross-group warnings.
export function selectBestFormatGroup(
  groups: Map<AdpFormatGroupKey, AdpFormatGroup>,
  league: Pick<LeagueFormatInput, "isDynasty" | "isSuperflex" | "isBestBall">
): {
  group: AdpFormatGroup;
  compatibility: SnapshotCompatibility;
  warnings: string[];
} | null {
  if (groups.size === 0) return null;

  const idealKey = assignFormatGroupKeyForLeague(league);

  // Exact match
  const exact = groups.get(idealKey);
  if (exact) return { group: exact, compatibility: "compatible", warnings: [] };

  // Partial fallback: same dynasty/redraft dimension, different superflex
  const partialKey: AdpFormatGroupKey = league.isDynasty
    ? league.isSuperflex
      ? "dynasty_startup_1qb"
      : "dynasty_startup_superflex"
    : league.isSuperflex
    ? "redraft_1qb"
    : "redraft_superflex";

  const partial = groups.get(partialKey);
  if (partial) {
    const warnings = league.isSuperflex
      ? ["No Superflex ADP available — using 1QB source; QB tiers are less reliable for Superflex leagues"]
      : ["No 1QB ADP available — using Superflex source; QB ADP inflated relative to 1QB leagues"];
    return { group: partial, compatibility: "partially_compatible", warnings };
  }

  // Cross dynasty/redraft fallback (incompatible but shown separately)
  const crossKey = league.isDynasty
    ? league.isSuperflex ? "redraft_superflex" : "redraft_1qb"
    : league.isSuperflex ? "dynasty_startup_superflex" : "dynasty_startup_1qb";
  const cross = groups.get(crossKey);
  if (cross) {
    return {
      group: cross,
      compatibility: "incompatible",
      warnings: [`ADP source (${cross.label}) is incompatible with league format — shown for reference only, not blended`],
    };
  }

  // Anything available
  const fallback = [...groups.values()][0];
  return {
    group: fallback,
    compatibility: "incompatible",
    warnings: [`ADP source (${fallback.label}) format is incompatible with this league — shown for reference only`],
  };
}
