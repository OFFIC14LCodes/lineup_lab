import type { PlayerProfileScoringMetadata } from "./player-profile-rescoring";
import type { PlayerProfileReadModel } from "./player-profile-read-model";

export type PlayerProfileEvidenceStatus = "available" | "unavailable";
export type PlayerProfileEvidenceBadge =
  | "league-scored"
  | "default-scored"
  | "fallback-scored"
  | "consistent"
  | "available"
  | "spike"
  | "floor"
  | "ceiling"
  | "sample"
  | "idp-floor"
  | "big-play"
  | "rushing"
  | "receiving"
  | "review"
  | "role"
  | "usage"
  | "fragile-role"
  | "snap-role"
  | "high-value"
  | "red-zone"
  | "goal-line";

export type PlayerProfileEvidence = {
  status: PlayerProfileEvidenceStatus;
  scoringSource: PlayerProfileScoringMetadata["scoringSource"] | "none";
  summary: string;
  positiveSignals: string[];
  cautionSignals: string[];
  badges: PlayerProfileEvidenceBadge[];
  note: string;
};

export function buildPlayerProfileEvidence(input: {
  profile: PlayerProfileReadModel | null;
  scoring: PlayerProfileScoringMetadata | null;
  unavailableReason?: "profile_not_found" | "not_found" | "artifact_unavailable" | "ambiguous" | "error" | null;
  maxSignals?: number;
}): PlayerProfileEvidence {
  const maxSignals = Math.max(1, input.maxSignals ?? 4);

  if (!input.profile) {
    return {
      status: "unavailable",
      scoringSource: input.scoring?.scoringSource ?? "none",
      summary: unavailableSummary(input.unavailableReason),
      positiveSignals: [],
      cautionSignals: [unavailableCaution(input.unavailableReason)].filter(Boolean).slice(0, maxSignals),
      badges: [],
      note: "Historical evidence only; not yet included in Blackbird Rank.",
    };
  }

  const profile = input.profile;
  const metrics = profile.summaryMetrics;
  const positives: string[] = [];
  const cautions: string[] = [];
  const badges: PlayerProfileEvidenceBadge[] = [];
  const confidence = profile.identity.match_confidence.toLowerCase();
  const scoringSource = input.scoring?.scoringSource ?? "none";
  const position = profile.header.position;
  const totals = profile.seasonSummaries[0]?.keyStatTotals ?? {};
  const idpSummary = profile.idpSummary ?? {};

  if (confidence === "exact_id" || confidence === "strong") {
    positives.push("Strong profile identity match");
  } else if (confidence === "medium" || confidence === "weak") {
    cautions.push(`Profile match confidence is ${confidence}; review may be needed`);
    badges.push("review");
  }

  if (metrics.games >= 10) {
    positives.push(`${metrics.games} game historical sample`);
    badges.push("sample");
  } else if (metrics.games > 0) {
    cautions.push(`Small historical sample: ${metrics.games} game${metrics.games === 1 ? "" : "s"}`);
  } else {
    cautions.push("No weekly stats available for this profile");
  }

  if (metrics.points_per_game !== null) {
    if (metrics.points_per_game >= strongPpgThreshold(position)) {
      positives.push(`${formatNumber(metrics.points_per_game)} PPG under ${scoringBasis(scoringSource)}`);
    } else if (metrics.points_per_game <= lowPpgThreshold(position)) {
      cautions.push(`${formatNumber(metrics.points_per_game)} PPG historical scoring profile`);
    }
  }

  if (metrics.consistency_score >= 80) {
    positives.push(`${formatNumber(metrics.consistency_score)} consistency score`);
    badges.push("consistent");
  } else if (metrics.consistency_score > 0 && metrics.consistency_score <= 45) {
    cautions.push(`${formatNumber(metrics.consistency_score)} consistency score`);
  }

  if (metrics.availability_score >= 85) {
    positives.push(`${formatNumber(metrics.availability_score)} availability score`);
    badges.push("available");
  } else if (metrics.availability_score > 0 && metrics.availability_score <= 55) {
    cautions.push(`${formatNumber(metrics.availability_score)} availability score`);
  }

  if (metrics.spike_score >= 70) {
    positives.push(`${formatNumber(metrics.spike_score)} spike score`);
    badges.push("spike");
  }

  if (metrics.floor !== null) {
    if (metrics.floor >= strongFloorThreshold(position)) {
      positives.push(`${formatNumber(metrics.floor)} floor profile`);
      badges.push("floor");
    } else if (metrics.floor <= lowFloorThreshold(position)) {
      cautions.push(`${formatNumber(metrics.floor)} floor profile`);
    }
  }

  if (metrics.ceiling !== null && metrics.ceiling >= strongCeilingThreshold(position)) {
    positives.push(`${formatNumber(metrics.ceiling)} ceiling profile`);
    badges.push("ceiling");
  }

  addPositionSignals({
    position,
    totals,
    idpSummary,
    positives,
    cautions,
    badges,
  });
  addRoleUsageSignals({ profile, positives, cautions, badges });
  addHighValueUsageSignals({ profile, positives, cautions, badges });

  for (const warning of profile.warnings) {
    if (warning === "low_sample_size" && !cautions.some((signal) => signal.toLowerCase().includes("sample"))) {
      cautions.push("Profile carries a low-sample warning");
    }
    if (warning === "no_weekly_stats" && !cautions.some((signal) => signal.toLowerCase().includes("weekly stats"))) {
      cautions.push("No weekly stats available for this profile");
    }
    if (warning === "weak_identity_match" && !cautions.some((signal) => signal.toLowerCase().includes("match confidence"))) {
      cautions.push("Weak identity match warning");
      badges.push("review");
    }
  }

  let scoringBadge: PlayerProfileEvidenceBadge = "default-scored";
  if (scoringSource === "draft_room" || scoringSource === "league") {
    scoringBadge = "league-scored";
  } else if (scoringSource === "fallback") {
    cautions.push("League scoring unavailable; default profile scoring used");
    scoringBadge = "fallback-scored";
  } else {
    scoringBadge = "default-scored";
  }

  const cappedPositives = unique(positives).slice(0, maxSignals);
  const cappedCautions = unique(cautions).slice(0, maxSignals);
  const priorityBadges: PlayerProfileEvidenceBadge[] = [scoringBadge];
  if (profile.roleMetrics) priorityBadges.push("role");
  if ((profile.usageSummary?.weeklyUsageConsistency ?? 0) >= 70) priorityBadges.push("usage");
  if ((profile.highValueUsageSummary?.gamesWithHighValueUsage ?? 0) > 0) priorityBadges.push("high-value");
  if (profile.highValueUsageSummary?.modifiers.includes("goal_line_role")) priorityBadges.push("goal-line");
  if (profile.highValueUsageSummary?.modifiers.includes("red_zone_role")) priorityBadges.push("red-zone");
  const cappedBadges = unique([...priorityBadges, ...badges]).slice(0, 8);

  return {
    status: "available",
    scoringSource,
    summary: evidenceSummary({ positives: cappedPositives, cautions: cappedCautions, scoringSource }),
    positiveSignals: cappedPositives,
    cautionSignals: cappedCautions,
    badges: cappedBadges,
    note: "Historical evidence only; not yet included in Blackbird Rank.",
  };
}

function addHighValueUsageSignals(input: {
  profile: PlayerProfileReadModel;
  positives: string[];
  cautions: string[];
  badges: PlayerProfileEvidenceBadge[];
}) {
  const usage = input.profile.highValueUsageSummary;
  if (!usage) return;
  if (usage.sourceStatus !== "available") {
    input.cautions.push("High-value usage source unavailable");
    return;
  }
  if (usage.gamesWithHighValueUsage === 0) return;

  const highValueTotal = (usage.highValueTouchesPerGame ?? 0) + (usage.highValueTargetsPerGame ?? 0);
  if (highValueTotal >= 2) {
    input.positives.push(`${formatNumber(highValueTotal)} high-value touches/targets per game`);
    input.badges.push("high-value");
  } else if (usage.gamesWithHighValueUsage >= 6 && highValueTotal < 0.75) {
    input.cautions.push("Limited high-value usage profile");
  }

  if ((usage.goalLineCarriesPerGame ?? 0) >= 0.4) {
    input.positives.push(`${formatNumber(usage.goalLineCarriesPerGame ?? 0)} goal-line carries per game`);
    input.badges.push("goal-line");
  }
  if ((usage.redZoneCarriesPerGame ?? 0) + (usage.redZoneTargetsPerGame ?? 0) >= 1.5) {
    input.positives.push(`${formatNumber((usage.redZoneCarriesPerGame ?? 0) + (usage.redZoneTargetsPerGame ?? 0))} red-zone carries/targets per game`);
    input.badges.push("red-zone");
  }
  if ((usage.endZoneTargetsPerGame ?? 0) >= 0.3) {
    input.positives.push(`${formatNumber(usage.endZoneTargetsPerGame ?? 0)} end-zone targets per game`);
    input.badges.push("high-value");
  }
  if ((usage.deepTargetsPerGame ?? 0) >= 1.5) {
    input.positives.push(`${formatNumber(usage.deepTargetsPerGame ?? 0)} deep targets per game`);
    input.badges.push("big-play");
  }
  if (input.profile.header.position === "QB" && (usage.redZonePassAttemptsPerGame ?? 0) >= 4) {
    input.positives.push(`${formatNumber(usage.redZonePassAttemptsPerGame ?? 0)} red-zone pass attempts per game`);
    input.badges.push("red-zone");
  }
  if (input.profile.header.position === "QB" && ((usage.designedQbRushesPerGame ?? 0) + (usage.scramblesPerGame ?? 0)) >= 3) {
    input.positives.push(`${formatNumber((usage.designedQbRushesPerGame ?? 0) + (usage.scramblesPerGame ?? 0))} QB rushes/scrambles per game`);
    input.badges.push("rushing");
  }
  if (usage.modifiers.includes("td_dependent")) {
    input.cautions.push("High-value profile shows touchdown dependency");
    input.badges.push("fragile-role");
  }
  if (usage.modifiers.includes("high_value_usage_declining")) {
    input.cautions.push("High-value usage is declining");
    input.badges.push("fragile-role");
  }
}

function addRoleUsageSignals(input: {
  profile: PlayerProfileReadModel;
  positives: string[];
  cautions: string[];
  badges: PlayerProfileEvidenceBadge[];
}) {
  const role = input.profile.roleMetrics;
  const usage = input.profile.usageSummary;
  if (!role || !usage) return;

  if (role.roleConfidence === "medium" || role.roleConfidence === "high") {
    input.positives.push(`Role profile: ${role.roleLabel.replaceAll("_", " ")}`);
    input.badges.push("role");
  } else {
    input.cautions.push("Role profile has low confidence");
  }

  if (usage.weeklyUsageConsistency >= 70) {
    input.positives.push(`${formatNumber(usage.weeklyUsageConsistency)} usage consistency score`);
    input.badges.push("usage");
  } else if (usage.weeklyUsageConsistency > 0 && usage.weeklyUsageConsistency <= 45) {
    input.cautions.push(`${formatNumber(usage.weeklyUsageConsistency)} usage consistency score`);
    input.badges.push("fragile-role");
  }

  if ((usage.touchdownDependency ?? 0) >= 12) {
    input.cautions.push("Production profile shows touchdown dependency");
    input.badges.push("fragile-role");
  }
  if ((usage.bigPlayDependencyScore ?? 0) >= 45) {
    input.cautions.push("IDP role leans on big plays");
    input.badges.push("big-play");
  }
  if (role.roleModifiers.includes("full_time_role")) {
    input.positives.push("Stable full-time role by snap share");
    input.badges.push("snap-role");
  }
  if (role.roleModifiers.includes("snap_share_rising")) {
    input.positives.push("Snap share is rising");
    input.badges.push("snap-role");
  }
  if (["DL", "LB", "DB"].includes(input.profile.header.position) && (usage.defensiveSnapShare ?? 0) >= 0.7) {
    input.positives.push(`${formatPercent(usage.defensiveSnapShare)} average defensive snap share`);
    input.badges.push("snap-role");
  }
  if (role.roleModifiers.includes("snap_share_declining")) {
    input.cautions.push("Snap share is declining");
    input.badges.push("fragile-role");
  }
  if (role.roleModifiers.includes("production_without_full_role")) {
    input.cautions.push("Production came without a full-time snap role");
    input.badges.push("fragile-role");
  }
  if (role.roleModifiers.includes("full_role_low_production")) {
    input.cautions.push("Full snap role has not produced much usage");
    input.badges.push("fragile-role");
  }
  if ((role.roleModifiers.includes("rotational_role") || role.roleModifiers.includes("part_time_role")) && usage.gamesWithSnapData > 0) {
    input.cautions.push(`${formatPercent(usage.offensiveSnapShare ?? usage.defensiveSnapShare)} average primary snap share`);
  }
}

function addPositionSignals(input: {
  position: string;
  totals: Record<string, number>;
  idpSummary: Record<string, number>;
  positives: string[];
  cautions: string[];
  badges: PlayerProfileEvidenceBadge[];
}) {
  if (["DL", "LB", "DB"].includes(input.position)) {
    const soloTackles = input.idpSummary.solo_tkl ?? input.totals.solo_tkl ?? 0;
    const assists = input.idpSummary.ast_tkl ?? input.totals.ast_tkl ?? 0;
    const sacks = input.idpSummary.sack ?? input.totals.sack ?? 0;
    const turnovers =
      (input.idpSummary.int ?? input.totals.int ?? 0) +
      (input.idpSummary.ff ?? input.totals.ff ?? 0) +
      (input.idpSummary.fr ?? input.totals.fr ?? 0);
    const passesDefended = input.idpSummary.pd ?? input.totals.pd ?? 0;

    if (soloTackles >= 45 || soloTackles + assists >= 70) {
      input.positives.push(`${formatNumber(soloTackles)} solo tackles in profile sample`);
      input.badges.push("idp-floor");
    }
    if (sacks >= 6 || turnovers + passesDefended >= 10) {
      input.positives.push(`${formatNumber(sacks)} sacks with ${formatNumber(turnovers + passesDefended)} splash plays`);
      input.badges.push("big-play");
    }
    if (soloTackles < 25 && sacks >= 5) {
      input.cautions.push("IDP profile leans more on big plays than tackle floor");
    }
    return;
  }

  if (input.position === "QB") {
    const rushYards = input.totals.rush_yd ?? 0;
    const rushTds = input.totals.rush_td ?? 0;
    if (rushYards >= 300 || rushTds >= 4) {
      input.positives.push(`${formatNumber(rushYards)} QB rushing yards in profile sample`);
      input.badges.push("rushing");
    }
    return;
  }

  if (input.position === "RB") {
    const receptions = input.totals.rec ?? 0;
    const receivingYards = input.totals.rec_yd ?? 0;
    if (receptions >= 35 || receivingYards >= 300) {
      input.positives.push(`${formatNumber(receptions)} RB receptions in profile sample`);
      input.badges.push("receiving");
    }
    return;
  }

  if (input.position === "WR" || input.position === "TE") {
    const receptions = input.totals.rec ?? 0;
    const receivingYards = input.totals.rec_yd ?? 0;
    const targets = input.totals.targets ?? input.totals.rec_tgt ?? 0;
    if (targets >= 90 || receptions >= 60 || receivingYards >= 800) {
      input.positives.push(`${formatNumber(receptions)} catches / ${formatNumber(receivingYards)} receiving yards in profile sample`);
      input.badges.push("receiving");
    }
  }
}

function evidenceSummary(input: {
  positives: string[];
  cautions: string[];
  scoringSource: PlayerProfileEvidence["scoringSource"];
}) {
  if (input.positives.length && !input.cautions.length) {
    return `Strong historical profile under ${scoringBasis(input.scoringSource)}.`;
  }
  if (input.positives.length && input.cautions.length) {
    return `Useful historical evidence with ${input.cautions.length} caveat${input.cautions.length === 1 ? "" : "s"}.`;
  }
  if (input.cautions.length) {
    return "Historical profile has caution flags.";
  }
  return "Historical profile evidence is limited.";
}

function unavailableSummary(reason: PlayerProfileEvidenceStatus | string | null | undefined) {
  if (reason === "artifact_unavailable") return "Historical profile artifact is unavailable in this deployment.";
  if (reason === "ambiguous") return "Historical profile lookup is ambiguous.";
  if (reason === "error") return "Historical profile could not be loaded.";
  return "Historical profile not available yet.";
}

function unavailableCaution(reason: PlayerProfileEvidenceStatus | string | null | undefined) {
  if (reason === "artifact_unavailable") return "Profile evidence artifact unavailable";
  if (reason === "ambiguous") return "Profile lookup ambiguous; no evidence shown";
  if (reason === "error") return "Profile evidence request failed";
  return "No profile found for this player";
}

function scoringBasis(source: PlayerProfileEvidence["scoringSource"]) {
  if (source === "draft_room" || source === "league") return "this league's scoring";
  if (source === "fallback") return "fallback profile scoring";
  return "default profile scoring";
}

function strongPpgThreshold(position: string) {
  if (position === "QB") return 18;
  if (position === "K") return 8;
  if (["DL", "LB", "DB"].includes(position)) return 10;
  return 14;
}

function lowPpgThreshold(position: string) {
  if (position === "QB") return 10;
  if (position === "K") return 5;
  if (["DL", "LB", "DB"].includes(position)) return 5;
  return 7;
}

function strongFloorThreshold(position: string) {
  if (position === "QB") return 14;
  if (position === "K") return 6;
  if (["DL", "LB", "DB"].includes(position)) return 7;
  return 9;
}

function lowFloorThreshold(position: string) {
  if (position === "QB") return 7;
  if (position === "K") return 3;
  if (["DL", "LB", "DB"].includes(position)) return 3;
  return 4;
}

function strongCeilingThreshold(position: string) {
  if (position === "QB") return 25;
  if (position === "K") return 12;
  if (["DL", "LB", "DB"].includes(position)) return 14;
  return 20;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function formatNumber(value: number) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatPercent(value: number | null) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "n/a";
}
