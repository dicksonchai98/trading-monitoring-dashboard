import { buildDistributionQueryKey, buildEventSamplesQueryKey, buildEventStatsQueryKey } from "@/features/analytics/lib/query-keys";

describe("analytics query keys", () => {
  it("includes all request-shaping params for event stats", () => {
    const key = buildEventStatsQueryKey({
      eventId: "day_up_gt_100",
      code: "TXF",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      version: "latest",
      flatThreshold: 10,
    });

    expect(key).toEqual([
      "analytics-event-stats",
      {
        eventId: "day_up_gt_100",
        code: "TXF",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        version: "latest",
        flatThreshold: 10,
      },
    ]);
  });

  it("includes page/pageSize/sort for event samples", () => {
    const key = buildEventSamplesQueryKey({
      eventId: "gap_up_gt_100",
      code: "MTX",
      startDate: "2026-02-01",
      endDate: "2026-02-28",
      page: 3,
      pageSize: 50,
      sort: "-trade_date",
      flatThreshold: 0,
    });

    expect(key).toEqual([
      "analytics-event-samples",
      {
        eventId: "gap_up_gt_100",
        code: "MTX",
        startDate: "2026-02-01",
        endDate: "2026-02-28",
        page: 3,
        pageSize: 50,
        sort: "-trade_date",
        flatThreshold: 0,
      },
    ]);
  });

  it("includes metric/date/version params for distribution", () => {
    const key = buildDistributionQueryKey({
      metricId: "day_return_pct",
      code: "TXF",
      startDate: "2026-03-01",
      endDate: "2026-03-20",
      version: "latest",
    });

    expect(key).toEqual([
      "analytics-distribution",
      {
        metricId: "day_return_pct",
        code: "TXF",
        startDate: "2026-03-01",
        endDate: "2026-03-20",
        version: "latest",
      },
    ]);
  });
});
