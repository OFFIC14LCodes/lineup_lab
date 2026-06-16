import type { SourceAttribution } from "@/lib/data-acquisition/data-source-types";

export type PlayerContextAttributionMap = Record<string, Record<string, SourceAttribution>>;

export function addContextAttribution(map: PlayerContextAttributionMap, playerId: string, field: string, attribution: SourceAttribution) {
  map[playerId] = map[playerId] ?? {};
  map[playerId][field] = attribution;
}

export function sourceLabelsFor(map: PlayerContextAttributionMap, playerId: string): string[] {
  return Array.from(new Set(Object.values(map[playerId] ?? {}).map((entry) => entry.sourceLabel))).sort();
}
