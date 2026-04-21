// timeline-helpers.ts
// Timeline helpers for dashboard series
// Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

/**
 * Binary search for insert location in ascending minuteTs.
 * Returns the index where minuteTs should be inserted to keep series sorted.
 */
export function findInsertIndex<T extends { minuteTs: number }>(series: T[], minuteTs: number): number {
  let low = 0;
  let high = series.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (series[mid].minuteTs < minuteTs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

/**
 * Upsert a point into the series using indexMap for O(1) lookup.
 * Returns new series and indexMap if changed, else same references.
 */
export function upsertPoint<T extends { minuteTs: number }>(
  series: T[],
  indexMap: Map<number, number>,
  point: T
): { nextSeries: T[]; nextIndexMap: Map<number, number>; didChange: boolean } {
  const rebuildIndexMap = (rows: T[]): Map<number, number> => {
    const nextIndexMap = new Map<number, number>();
    for (let i = 0; i < rows.length; ++i) {
      nextIndexMap.set(rows[i].minuteTs, i);
    }
    return nextIndexMap;
  };

  const isSamePoint = (a: T, b: T): boolean => {
    const keys = Object.keys(b) as (keyof T)[];
    for (const k of keys) {
      if (a[k] !== b[k]) {
        return false;
      }
    }
    return true;
  };

  const indexed = indexMap.get(point.minuteTs);
  const hasValidIndexedPoint =
    indexed !== undefined &&
    indexed >= 0 &&
    indexed < series.length &&
    series[indexed]?.minuteTs === point.minuteTs;

  if (hasValidIndexedPoint) {
    const idx = indexed as number;
    const existing = series[idx];
    if (isSamePoint(existing, point)) {
      return { nextSeries: series, nextIndexMap: indexMap, didChange: false };
    }
    const nextSeries = series.slice();
    nextSeries[idx] = point;
    return { nextSeries, nextIndexMap: indexMap, didChange: true };
  }

  // Fallback for stale indexMap: use current series ordering to upsert safely.
  const insertIdx = findInsertIndex(series, point.minuteTs);
  const hasExistingAtMinuteTs =
    insertIdx >= 0 &&
    insertIdx < series.length &&
    series[insertIdx]?.minuteTs === point.minuteTs;

  if (hasExistingAtMinuteTs) {
    if (isSamePoint(series[insertIdx], point)) {
      return { nextSeries: series, nextIndexMap: rebuildIndexMap(series), didChange: false };
    }
    const nextSeries = series.slice();
    nextSeries[insertIdx] = point;
    return { nextSeries, nextIndexMap: rebuildIndexMap(nextSeries), didChange: true };
  }

  const nextSeries = series.slice(0, insertIdx).concat([point], series.slice(insertIdx));
  return { nextSeries, nextIndexMap: rebuildIndexMap(nextSeries), didChange: true };
}
