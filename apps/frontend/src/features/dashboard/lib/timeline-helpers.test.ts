// timeline-helpers.test.ts
import { findInsertIndex, upsertPoint } from './timeline-helpers';

type Point = { minuteTs: number; value: number };

describe('findInsertIndex', () => {
  it('returns 0 for empty series', () => {
    expect(findInsertIndex([], 100)).toBe(0);
  });
  it('inserts at front', () => {
    const s = [{ minuteTs: 10, value: 1 }, { minuteTs: 20, value: 2 }];
    expect(findInsertIndex(s, 5)).toBe(0);
  });
  it('inserts at end', () => {
    const s = [{ minuteTs: 10, value: 1 }, { minuteTs: 20, value: 2 }];
    expect(findInsertIndex(s, 30)).toBe(2);
  });
  it('inserts in middle', () => {
    const s = [{ minuteTs: 10, value: 1 }, { minuteTs: 20, value: 2 }, { minuteTs: 40, value: 3 }];
    expect(findInsertIndex(s, 25)).toBe(2);
    expect(findInsertIndex(s, 40)).toBe(2);
  });
});

describe('upsertPoint', () => {
  function makeIndexMap(series: Point[]) {
    const m = new Map<number, number>();
    series.forEach((p, i) => m.set(p.minuteTs, i));
    return m;
  }

  it('appends to empty series', () => {
    const s: Point[] = [];
    const m = makeIndexMap(s);
    const p = { minuteTs: 10, value: 1 };
    const { nextSeries, nextIndexMap, didChange } = upsertPoint(s, m, p);
    expect(nextSeries).toEqual([p]);
    expect(nextIndexMap.get(10)).toBe(0);
    expect(didChange).toBe(true);
  });

  it('no-op if identical', () => {
    const s: Point[] = [{ minuteTs: 10, value: 1 }];
    const m = makeIndexMap(s);
    const p = { minuteTs: 10, value: 1 };
    const { nextSeries, nextIndexMap, didChange } = upsertPoint(s, m, p);
    expect(nextSeries).toBe(s);
    expect(nextIndexMap).toBe(m);
    expect(didChange).toBe(false);
  });

  it('replaces if different', () => {
    const s: Point[] = [{ minuteTs: 10, value: 1 }];
    const m = makeIndexMap(s);
    const p = { minuteTs: 10, value: 2 };
    const { nextSeries, nextIndexMap, didChange } = upsertPoint(s, m, p);
    expect(nextSeries).not.toBe(s);
    expect(nextSeries[0]).toEqual(p);
    expect(didChange).toBe(true);
  });

  it('inserts at front', () => {
    const s: Point[] = [{ minuteTs: 20, value: 2 }];
    const m = makeIndexMap(s);
    const p = { minuteTs: 10, value: 1 };
    const { nextSeries, nextIndexMap, didChange } = upsertPoint(s, m, p);
    expect(nextSeries[0]).toEqual(p);
    expect(nextIndexMap.get(10)).toBe(0);
    expect(didChange).toBe(true);
  });

  it('inserts in middle', () => {
    const s: Point[] = [
      { minuteTs: 10, value: 1 },
      { minuteTs: 30, value: 3 }
    ];
    const m = makeIndexMap(s);
    const p = { minuteTs: 20, value: 2 };
    const { nextSeries, nextIndexMap, didChange } = upsertPoint(s, m, p);
    expect(nextSeries[1]).toEqual(p);
    expect(nextIndexMap.get(20)).toBe(1);
    expect(didChange).toBe(true);
  });

  it('inserts at end', () => {
    const s: Point[] = [
      { minuteTs: 10, value: 1 },
      { minuteTs: 20, value: 2 }
    ];
    const m = makeIndexMap(s);
    const p = { minuteTs: 30, value: 3 };
    const { nextSeries, nextIndexMap, didChange } = upsertPoint(s, m, p);
    expect(nextSeries[2]).toEqual(p);
    expect(nextIndexMap.get(30)).toBe(2);
    expect(didChange).toBe(true);
  });
});
