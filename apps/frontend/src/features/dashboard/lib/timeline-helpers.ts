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
  const idx = indexMap.get(point.minuteTs);
  if (idx !== undefined) {
    const existing = series[idx];
    // Shallow compare all fields
    const keys = Object.keys(point) as (keyof T)[];
    let identical = true;
    for (const k of keys) {
      if (existing[k] !== point[k]) {
        identical = false;
        break;
      }
    }
    if (identical) {
      return { nextSeries: series, nextIndexMap: indexMap, didChange: false };
    }
    // Replace only the changed point
    const nextSeries = series.slice();
    nextSeries[idx] = point;
    return { nextSeries, nextIndexMap: indexMap, didChange: true };
  } else {
    // Insert new point
    const insertIdx = findInsertIndex(series, point.minuteTs);
    const nextSeries = series.slice(0, insertIdx).concat([point], series.slice(insertIdx));
    // Rebuild indexMap
    const nextIndexMap = new Map<number, number>();
    for (let i = 0; i < nextSeries.length; ++i) {
      nextIndexMap.set(nextSeries[i].minuteTs, i);
    }
    return { nextSeries, nextIndexMap, didChange: true };
  }
}
