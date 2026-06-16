export type DataQualitySummary = {
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  ambiguousRows: number;
  conflictCount: number;
  dataGaps: Record<string, number>;
  verdict: "passed" | "needs_source_data" | "failed";
};

export function dataGapCounts(rows: Array<{ dataGaps?: string[] | null }>): Record<string, number> {
  return rows.flatMap((row) => row.dataGaps ?? []).reduce((acc, gap) => {
    acc[gap] = (acc[gap] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export function qualityVerdict(input: { totalRows: number; invalidRows?: number; conflictCount?: number; sourceRows?: number }): DataQualitySummary["verdict"] {
  if ((input.invalidRows ?? 0) > 0 || (input.conflictCount ?? 0) > 0) return "failed";
  if ((input.sourceRows ?? input.totalRows) === 0) return "needs_source_data";
  return "passed";
}
