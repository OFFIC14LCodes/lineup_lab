export type IdpPositionCompatibility = {
  compatible: boolean;
  normalizedSource: string | null;
  normalizedTarget: string | null;
  reasonCodes: string[];
  rejectionReason: "IDP_POSITION_MISMATCH_REJECTED" | null;
};

const DB_POSITIONS = new Set(["DB", "S", "CB", "FS", "SS"]);
const DL_POSITIONS = new Set(["DL", "DE", "DT"]);
const LB_POSITIONS = new Set(["LB", "ILB", "OLB", "MLB"]);
const IDP_GROUPS = new Set(["DL", "LB", "DB"]);

export function normalizeIdpPositionGroup(position: string | null | undefined): string | null {
  const normalized = (position ?? "").trim().toUpperCase();
  if (!normalized) return null;
  if (DB_POSITIONS.has(normalized)) return "DB";
  if (DL_POSITIONS.has(normalized)) return "DL";
  if (LB_POSITIONS.has(normalized)) return "LB";
  return null;
}

export function getIdpPositionCompatibility(
  sourcePosition: string | null | undefined,
  targetPosition: string | null | undefined
): IdpPositionCompatibility {
  const source = normalizePosition(sourcePosition);
  const target = normalizePosition(targetPosition);
  const sourceGroup = normalizeIdpPositionGroup(source);
  const targetGroup = normalizeIdpPositionGroup(target);

  if (!source || !target) {
    return { compatible: true, normalizedSource: sourceGroup, normalizedTarget: targetGroup, reasonCodes: [], rejectionReason: null };
  }

  if (!sourceGroup && !targetGroup) {
    return { compatible: source === target, normalizedSource: null, normalizedTarget: null, reasonCodes: [], rejectionReason: source === target ? null : "IDP_POSITION_MISMATCH_REJECTED" };
  }

  if (!sourceGroup || !targetGroup) {
    return { compatible: false, normalizedSource: sourceGroup, normalizedTarget: targetGroup, reasonCodes: [], rejectionReason: "IDP_POSITION_MISMATCH_REJECTED" };
  }

  if (sourceGroup === targetGroup) {
    const reasonCodes = ["IDP_POSITION_GROUP_COMPATIBLE"];
    if (source !== sourceGroup || target !== targetGroup) reasonCodes.push("IDP_HYBRID_POSITION_NORMALIZED");
    return { compatible: true, normalizedSource: sourceGroup, normalizedTarget: targetGroup, reasonCodes, rejectionReason: null };
  }

  if (isLbDbHybrid(sourceGroup, targetGroup)) {
    return {
      compatible: true,
      normalizedSource: sourceGroup,
      normalizedTarget: targetGroup,
      reasonCodes: ["IDP_POSITION_GROUP_COMPATIBLE", "IDP_HYBRID_POSITION_NORMALIZED"],
      rejectionReason: null,
    };
  }

  return { compatible: false, normalizedSource: sourceGroup, normalizedTarget: targetGroup, reasonCodes: [], rejectionReason: "IDP_POSITION_MISMATCH_REJECTED" };
}

export function isIdpPosition(position: string | null | undefined): boolean {
  const normalized = normalizePosition(position);
  return Boolean(normalized && (IDP_GROUPS.has(normalized) || normalizeIdpPositionGroup(normalized)));
}

function normalizePosition(position: string | null | undefined): string | null {
  const normalized = (position ?? "").trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "D/ST" || normalized === "DST") return "DEF";
  return normalized;
}

function isLbDbHybrid(sourceGroup: string, targetGroup: string): boolean {
  return (sourceGroup === "LB" && targetGroup === "DB") || (sourceGroup === "DB" && targetGroup === "LB");
}
