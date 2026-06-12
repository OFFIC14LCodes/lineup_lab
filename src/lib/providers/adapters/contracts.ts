import type {
  AdapterInjuryRecord,
  AdapterNormalizationResult,
  AdapterProjectionRecord,
  AdapterSeasonStatsRecord,
  AdapterWeeklyStatsRecord,
  ProviderCapabilities,
  UnsupportedCapabilityResult
} from "@/lib/providers/adapters/types";
import type { ProviderName } from "@/lib/providers/types";

export interface FootballDataAdapter {
  readonly provider: ProviderName;
  // Capabilities describe technical support only, not licensing or storage rights.
  readonly capabilities: ProviderCapabilities;
  normalizeWeeklyStats?: (input: unknown) => AdapterNormalizationResult<AdapterWeeklyStatsRecord[]> | UnsupportedCapabilityResult;
  normalizeSeasonStats?: (input: unknown) => AdapterNormalizationResult<AdapterSeasonStatsRecord[]> | UnsupportedCapabilityResult;
  normalizeProjections?: (input: unknown) => AdapterNormalizationResult<AdapterProjectionRecord[]> | UnsupportedCapabilityResult;
  normalizeInjuries?: (input: unknown) => AdapterNormalizationResult<AdapterInjuryRecord[]> | UnsupportedCapabilityResult;
}

export function unsupportedCapability(message: string): UnsupportedCapabilityResult {
  return {
    supported: false,
    code: "UNSUPPORTED_CAPABILITY",
    message
  };
}
