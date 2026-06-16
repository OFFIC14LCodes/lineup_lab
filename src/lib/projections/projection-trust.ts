export type ProjectionUnit = "season" | "weekly" | "game" | "fallback" | "unknown";

export type ProjectionSource =
  | "comprehensive_stat_projection"
  | "historical_projection"
  | "rookie_projection"
  | "fallback_projection"
  | "uploaded_projection"
  | "legacy_projection"
  | "unknown";

export type ProjectionTrust = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  projectionRunId: string | null;
  projectionVersion: string | null;
  projectionUnit: ProjectionUnit;
  projectionSource: ProjectionSource;
  hasStatBackedProjection: boolean;
  hasScoredFantasyProjection: boolean;
  hasProjectedComponents: boolean;
  trustScore: number;
  trustLabel: "very_low" | "low" | "medium" | "high";
  fallbackReason:
    | "no_historical_stats"
    | "rookie_missing_inputs"
    | "unresolved_identity"
    | "unsupported_position"
    | "missing_scoring_projection"
    | "missing_projected_components"
    | "inactive_or_deep_pool"
    | "unknown"
    | null;
  reasons: string[];
  dataGaps: string[];
};

export type ProjectionTrustInput = {
  playerId?: string | null;
  playerName?: string | null;
  position?: string | null;
  team?: string | null;
  projectionRunId?: string | null;
  projectionVersion?: string | null;
  projectionUnit?: string | null;
  projectionSource?: string | null;
  projectionType?: string | null;
  confidence?: string | null;
  dataGaps?: string[] | null;
  stats?: Record<string, unknown> | null;
  projectedComponents?: unknown;
  floorPoints?: number | null;
  medianPoints?: number | null;
  ceilingPoints?: number | null;
  isFallback?: boolean | null;
  matchStatus?: string | null;
  active?: boolean | null;
};

export function buildProjectionTrust(input: ProjectionTrustInput): ProjectionTrust {
  const projectionUnit = normalizeProjectionUnit(input.projectionUnit, input.isFallback);
  const projectionSource = inferProjectionSource(input);
  const dataGaps = unique(input.dataGaps ?? []);
  const hasProjectedComponents = hasComponents(input.stats) || hasComponents(input.projectedComponents);
  const hasScoredFantasyProjection = [input.floorPoints, input.medianPoints, input.ceilingPoints].some(isFiniteNumber);
  const hasStatBackedProjection =
    hasProjectedComponents &&
    hasScoredFantasyProjection &&
    projectionSource !== "fallback_projection" &&
    projectionSource !== "uploaded_projection" &&
    projectionSource !== "unknown";
  const fallbackReason = inferFallbackReason({
    ...input,
    projectionSource,
    hasProjectedComponents,
    hasScoredFantasyProjection,
    dataGaps,
  });
  const trustScore = calculateTrustScore({
    projectionUnit,
    projectionSource,
    confidence: input.confidence ?? null,
    hasProjectedComponents,
    hasScoredFantasyProjection,
    hasStatBackedProjection,
    fallbackReason,
    matchStatus: input.matchStatus ?? null,
  });

  return {
    playerId: input.playerId ?? "",
    playerName: input.playerName ?? "Unknown",
    position: normalizePosition(input.position),
    team: input.team ?? null,
    projectionRunId: input.projectionRunId ?? null,
    projectionVersion: input.projectionVersion ?? null,
    projectionUnit,
    projectionSource,
    hasStatBackedProjection,
    hasScoredFantasyProjection,
    hasProjectedComponents,
    trustScore,
    trustLabel: trustLabel(trustScore),
    fallbackReason,
    reasons: trustReasons({
      projectionUnit,
      projectionSource,
      confidence: input.confidence ?? null,
      hasProjectedComponents,
      hasScoredFantasyProjection,
      hasStatBackedProjection,
      fallbackReason,
    }),
    dataGaps: projectionUnit === "unknown" ? unique([...dataGaps, "projection unit"]) : dataGaps,
  };
}

export function projectionTrustBadgeLabel(trust: Pick<ProjectionTrust, "projectionSource" | "projectionUnit" | "trustLabel">): string {
  const source =
    trust.projectionSource === "comprehensive_stat_projection"
      ? "Stat-backed"
      : trust.projectionSource === "historical_projection"
        ? "Historical"
        : trust.projectionSource === "rookie_projection"
          ? "Rookie"
          : trust.projectionSource === "fallback_projection"
            ? "Fallback"
            : trust.projectionSource === "uploaded_projection"
              ? "Uploaded"
              : trust.projectionSource === "legacy_projection"
                ? "Legacy"
                : "Unknown";
  const unit = trust.projectionUnit === "season" ? "season" : trust.projectionUnit;
  return `${source} ${unit} projection - ${trust.trustLabel.replace("_", " ")} trust`;
}

function calculateTrustScore(input: {
  projectionUnit: ProjectionUnit;
  projectionSource: ProjectionSource;
  confidence: string | null;
  hasProjectedComponents: boolean;
  hasScoredFantasyProjection: boolean;
  hasStatBackedProjection: boolean;
  fallbackReason: ProjectionTrust["fallbackReason"];
  matchStatus: string | null;
}): number {
  let score = 10;
  if (input.hasScoredFantasyProjection) score += 25;
  if (input.hasProjectedComponents) score += 25;
  if (input.hasStatBackedProjection) score += 10;
  if (input.projectionUnit === "season") score += 8;
  if (input.projectionUnit === "unknown") score -= 12;
  if (input.projectionSource === "comprehensive_stat_projection") score += 14;
  if (input.projectionSource === "historical_projection") score += 10;
  if (input.projectionSource === "rookie_projection") score += 2;
  if (input.projectionSource === "uploaded_projection") score -= 8;
  if (input.projectionSource === "legacy_projection") score -= 5;
  if (input.projectionSource === "fallback_projection") score -= 25;
  if (input.fallbackReason) score -= 10;

  const confidence = (input.confidence ?? "").toLowerCase();
  if (confidence.includes("high")) score += 8;
  else if (confidence.includes("medium")) score += 2;
  else if (confidence.includes("very")) score -= 16;
  else if (confidence.includes("low")) score -= 8;

  const matchStatus = (input.matchStatus ?? "").toLowerCase();
  if (matchStatus === "ambiguous" || matchStatus === "unmatched") score -= 14;

  const rookieMissingInputsCap = input.fallbackReason === "rookie_missing_inputs" ? 44 : score;
  const veryLowSourceCap = (input.confidence ?? "").toLowerCase().includes("very") ? Math.min(rookieMissingInputsCap, 44) : rookieMissingInputsCap;
  const capped = input.projectionSource === "fallback_projection" ? Math.min(veryLowSourceCap, 24) : veryLowSourceCap;
  return Math.max(0, Math.min(100, Math.round(capped)));
}

function inferProjectionSource(input: ProjectionTrustInput): ProjectionSource {
  const explicit = (input.projectionSource ?? "").toLowerCase();
  const version = (input.projectionVersion ?? "").toLowerCase();
  const type = (input.projectionType ?? "").toLowerCase();
  if (input.isFallback || type === "fallback" || explicit.includes("fallback")) return "fallback_projection";
  if (version.includes("comprehensive") || explicit.includes("comprehensive")) return "comprehensive_stat_projection";
  if (type === "veteran" || type === "historical" || explicit.includes("historical")) return "historical_projection";
  if (type === "rookie" || explicit.includes("rookie")) return "rookie_projection";
  if (explicit.includes("uploaded") || explicit.includes("ranking")) return "uploaded_projection";
  if (explicit.includes("h10") || explicit.includes("legacy")) return "legacy_projection";
  return "unknown";
}

function inferFallbackReason(input: ProjectionTrustInput & {
  projectionSource: ProjectionSource;
  hasProjectedComponents: boolean;
  hasScoredFantasyProjection: boolean;
  dataGaps: string[];
}): ProjectionTrust["fallbackReason"] {
  const gaps = input.dataGaps.join(" ").toLowerCase();
  const match = (input.matchStatus ?? "").toLowerCase();
  if (match === "unmatched" || match === "ambiguous" || gaps.includes("resolved player identity")) return "unresolved_identity";
  if (gaps.includes("unsupported position")) return "unsupported_position";
  if (input.active === false) return "inactive_or_deep_pool";
  if (!input.hasScoredFantasyProjection) return "missing_scoring_projection";
  if (!input.hasProjectedComponents && input.projectionSource !== "uploaded_projection") return "missing_projected_components";
  if (gaps.includes("missing historical stats") || gaps.includes("no weekly stats")) return "no_historical_stats";
  if (gaps.includes("rookie") || gaps.includes("draft capital") || gaps.includes("college")) return "rookie_missing_inputs";
  if (input.projectionSource === "fallback_projection") return "unknown";
  return null;
}

function trustReasons(input: {
  projectionUnit: ProjectionUnit;
  projectionSource: ProjectionSource;
  confidence: string | null;
  hasProjectedComponents: boolean;
  hasScoredFantasyProjection: boolean;
  hasStatBackedProjection: boolean;
  fallbackReason: ProjectionTrust["fallbackReason"];
}): string[] {
  return [
    input.hasStatBackedProjection ? "Projection has stat components and scored fantasy points." : null,
    !input.hasScoredFantasyProjection ? "Missing scored fantasy projection; not treated as zero." : null,
    !input.hasProjectedComponents ? "Projected stat components are missing." : null,
    input.projectionUnit === "unknown" ? "Projection unit is unknown." : null,
    input.projectionSource === "rookie_projection" ? "Rookie projection confidence depends on draft capital, college production, and role data." : null,
    input.projectionSource === "uploaded_projection" ? "Uploaded projection is labeled separately from Blackbird stat projection." : null,
    input.projectionSource === "legacy_projection" ? "Legacy projection source is labeled separately from comprehensive projection output." : null,
    input.projectionSource === "fallback_projection" ? "Fallback projection has explicit trust penalty." : null,
    input.fallbackReason ? `Fallback/root-cause reason: ${input.fallbackReason}.` : null,
    input.confidence ? `Source confidence: ${input.confidence}.` : null,
  ].filter((reason): reason is string => Boolean(reason));
}

function trustLabel(score: number): ProjectionTrust["trustLabel"] {
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  if (score >= 30) return "low";
  return "very_low";
}

function normalizeProjectionUnit(value: string | null | undefined, fallback?: boolean | null): ProjectionUnit {
  if (fallback) return "fallback";
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "season" || normalized === "weekly" || normalized === "game" || normalized === "fallback") return normalized;
  return "unknown";
}

function normalizePosition(value: string | null | undefined): string {
  const normalized = (value ?? "UNK").trim().toUpperCase();
  return normalized === "DST" || normalized === "D/ST" ? "DEF" : normalized;
}

function hasComponents(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value as Record<string, unknown>).length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}
