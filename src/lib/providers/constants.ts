import {
  EXTERNAL_ENTITY_TYPES,
  MAPPING_METHODS,
  MAPPING_STATUSES,
  PROVIDER_NAMES,
  type ExternalEntityType,
  type MappingMethod,
  type MappingStatus,
  type ProviderName
} from "@/lib/providers/types";

export const PROVIDER_NAME_SET = new Set<string>(PROVIDER_NAMES);
export const EXTERNAL_ENTITY_TYPE_SET = new Set<string>(EXTERNAL_ENTITY_TYPES);
export const MAPPING_STATUS_SET = new Set<string>(MAPPING_STATUSES);
export const MAPPING_METHOD_SET = new Set<string>(MAPPING_METHODS);

export function normalizeProviderName(value: string): ProviderName {
  const normalized = value.trim().toLowerCase();
  if (!PROVIDER_NAME_SET.has(normalized)) {
    throw new Error(`Unsupported provider: ${value}`);
  }
  return normalized as ProviderName;
}

export function normalizeExternalEntityType(value?: string | null): ExternalEntityType {
  const normalized = value?.trim().toLowerCase() || "player";
  if (!EXTERNAL_ENTITY_TYPE_SET.has(normalized)) {
    throw new Error(`Unsupported external entity type: ${value}`);
  }
  return normalized as ExternalEntityType;
}

export function normalizeMappingStatus(value?: string | null): MappingStatus {
  const normalized = value?.trim().toLowerCase() || "unverified";
  if (!MAPPING_STATUS_SET.has(normalized)) {
    throw new Error(`Unsupported mapping status: ${value}`);
  }
  return normalized as MappingStatus;
}

export function normalizeMappingMethod(value?: string | null): MappingMethod | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!MAPPING_METHOD_SET.has(normalized)) {
    throw new Error(`Unsupported mapping method: ${value}`);
  }
  return normalized as MappingMethod;
}

export function normalizeExternalId(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("External ID is required.");
  }
  return normalized;
}
