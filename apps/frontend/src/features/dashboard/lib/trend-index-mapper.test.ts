import { mapSpotMarketDistributionToTrendData } from './trend-index-mapper';

test('maps series items and latest fallback', () => {
  const ts1 = Date.parse('2026-04-18T09:30:00+08:00');
  const ts2 = Date.parse('2026-04-18T09:31:00+08:00');

  const items = [
    { ts: ts1, up_count: 10, down_count: 5, total_count: 15 },
    { ts: ts2, up_count: 8, down_count: 12, total_count: 20 },
  ];

  const mapped = mapSpotMarketDistributionToTrendData(items, undefined);
  expect(mapped.length).toBe(2);
  expect(mapped[0].trendDelta).toBe(5);
  expect(mapped[1].trendDelta).toBe(-4);
});

test('fallback to latest when series empty', () => {
  const ts = Date.parse('2026-04-18T09:40:00+08:00');
  const latest = { ts, up_count: 3, down_count: 1, total_count: 4 };
  const mapped = mapSpotMarketDistributionToTrendData([], latest);
  expect(mapped.length).toBe(1);
  expect(mapped[0].trendDelta).toBe(2);
});
