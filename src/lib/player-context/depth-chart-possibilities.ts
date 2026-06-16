import type { CeilingRole, ContextConfidence, CurrentRole, FloorRole, PlayerContextProfile } from "./player-context-types";

export type DepthChartPossibility = {
  playerId: string;
  currentRole: string;
  floorRole: string;
  ceilingRole: string;
  pathToFloor: string[];
  pathToCeiling: string[];
  confidence: ContextConfidence;
  reasons: string[];
  dataGaps: string[];
};

export function buildDepthChartPossibility(profile: PlayerContextProfile): DepthChartPossibility {
  const currentRole = profile.roleProfile.currentRole;
  const floorRole = profile.roleProfile.floorRole;
  const ceilingRole = profile.roleProfile.ceilingRole;
  const sourced = currentRole !== "unknown" || profile.depthChartProfile.depthChartPosition !== null;
  return {
    playerId: profile.playerId,
    currentRole,
    floorRole,
    ceilingRole,
    pathToFloor: profile.depthChartProfile.pathToFloor,
    pathToCeiling: profile.depthChartProfile.pathToCeiling,
    confidence: sourced ? minConfidence(profile.roleProfile.roleConfidence, profile.depthChartProfile.depthChartConfidence) : "very_low",
    reasons: sourced ? ["Scenario is source-backed by role or depth chart context."] : ["No sourced depth chart or role context; scenario remains unknown."],
    dataGaps: sourced ? [] : ["depth chart role", "floor role", "ceiling role"],
  };
}

export function defaultRolesForPosition(position: string): { currentRole: CurrentRole; floorRole: FloorRole; ceilingRole: CeilingRole } {
  const normalized = position.toUpperCase();
  if (normalized === "QB") return { currentRole: "unknown", floorRole: "unknown", ceilingRole: "unknown" };
  return { currentRole: "unknown", floorRole: "unknown", ceilingRole: "unknown" };
}

function minConfidence(a: ContextConfidence, b: ContextConfidence): ContextConfidence {
  const order: ContextConfidence[] = ["very_low", "low", "medium", "high"];
  return order[Math.min(order.indexOf(a), order.indexOf(b))] ?? "very_low";
}
