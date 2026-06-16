import type { AcquisitionMethod, SourceAttribution, SourceConfidence } from "./data-source-types";

export type FieldAttributionMap = Record<string, Record<string, SourceAttribution>>;

export function attribution(
  input: {
    source: string;
    sourceLabel: string;
    acquisitionMethod: AcquisitionMethod;
    sourceConfidence?: SourceConfidence | null;
    importedAt?: string | null;
  }
): SourceAttribution {
  return {
    source: input.source,
    sourceLabel: input.sourceLabel,
    acquisitionMethod: input.acquisitionMethod,
    sourceConfidence: input.sourceConfidence ?? "medium",
    importedAt: input.importedAt ?? new Date().toISOString(),
  };
}

export function addFieldAttribution(map: FieldAttributionMap, playerId: string, field: string, value: SourceAttribution) {
  map[playerId] = { ...(map[playerId] ?? {}), [field]: value };
}
