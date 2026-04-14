import {
  DistributionStatsResponseSchema,
  EventSamplesResponseSchema,
  EventStatsResponseSchema,
} from "@/features/analytics/api/schemas";

describe("analytics response schemas", () => {
  it("parses event stats payload", () => {
    const parsed = EventStatsResponseSchema.safeParse({
      event_id: "day_up_gt_100",
      code: "TXFR1",
      start_date: "2026-01-07",
      end_date: "2026-04-07",
      sample_count: 10,
      up_count: 5,
      down_count: 4,
      flat_count: 1,
      up_probability: 0.5,
      down_probability: 0.4,
      flat_probability: 0.1,
      avg_next_day_return: 12,
      median_next_day_return: 8,
      avg_next_day_range: 88,
      avg_next_day_gap: 6,
      version: 3,
      histogram: { bins: ["-20~0", "0~20"], counts: [3, 7] },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid event samples payload", () => {
    const parsed = EventSamplesResponseSchema.safeParse({
      items: [{ trade_date: "2026-01-01", next_day_return: "invalid", next_day_category: "up" }],
      page: 1,
      page_size: 100,
      total: 1,
    });

    expect(parsed.success).toBe(false);
  });

  it("parses distribution histogram payload", () => {
    const parsed = DistributionStatsResponseSchema.safeParse({
      metric_id: "day_return",
      sample_count: 15,
      mean: 1.2,
      median: 0.8,
      min: -5,
      max: 7,
      p75: 2,
      p90: 4,
      p95: 5,
      histogram_json: {
        bins: ["-5~0", "0~5"],
        counts: [5, 10],
        min: -5,
        max: 5,
        bucket_size: 5,
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("parses distribution histogram payload with numeric bin edges", () => {
    const parsed = DistributionStatsResponseSchema.safeParse({
      metric_id: "day_return",
      sample_count: 15,
      mean: 1.2,
      median: 0.8,
      min: -5,
      max: 7,
      p75: 2,
      p90: 4,
      p95: 5,
      histogram_json: {
        bins: [-5, 0, 5],
        counts: [5, 10],
        min: -5,
        max: 5,
        bucket_size: 5,
      },
      version: 2,
    });

    expect(parsed.success).toBe(true);
  });
});
