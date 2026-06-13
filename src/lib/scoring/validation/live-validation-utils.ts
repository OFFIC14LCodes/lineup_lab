export async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const page = await fetchPage(offset, pageSize);
    rows.push(...page);
    if (page.length < pageSize) {
      return rows;
    }
    offset += pageSize;
  }
}

export function chooseValidationWeeks(
  availableWeeks: number[],
  options: { explicitWeek?: number | null; preferredWeeks?: number[]; maxWeeks?: number } = {}
): number[] {
  const uniqueWeeks = [...new Set(availableWeeks)].sort((a, b) => a - b);
  if (options.explicitWeek != null) {
    return uniqueWeeks.includes(options.explicitWeek) ? [options.explicitWeek] : [];
  }

  const preferredWeeks = options.preferredWeeks ?? [1, 6, 12, 18];
  const selected = preferredWeeks.filter((week) => uniqueWeeks.includes(week));
  if (selected.length > 0) {
    return selected;
  }

  const maxWeeks = options.maxWeeks ?? 4;
  if (uniqueWeeks.length <= maxWeeks) {
    return uniqueWeeks;
  }

  const indices = new Set([0, uniqueWeeks.length - 1]);
  while (indices.size < maxWeeks) {
    const nextIndex = Math.round(((indices.size - 1) / (maxWeeks - 1)) * (uniqueWeeks.length - 1));
    indices.add(nextIndex);
    if (indices.size >= maxWeeks) break;
    for (let i = 0; i < uniqueWeeks.length && indices.size < maxWeeks; i += 1) {
      indices.add(i);
    }
  }

  return [...indices].sort((a, b) => a - b).map((index) => uniqueWeeks[index]);
}

export function summarizeCounts(values: Array<string | number | null | undefined>) {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (value === null || value === undefined) continue;
    const key = String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => {
      const countOrder = b[1] - a[1];
      if (countOrder !== 0) return countOrder;
      return a[0].localeCompare(b[0]);
    })
    .map(([key, count]) => ({ key, count }));
}
