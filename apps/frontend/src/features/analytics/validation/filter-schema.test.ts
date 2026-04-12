import { analyticsFilterSchema, resetPageOnFilterChange } from "@/features/analytics/validation/filter-schema";

describe("analytics filter schema", () => {
  it("accepts valid filter payload", () => {
    const parsed = analyticsFilterSchema.safeParse({
      code: "TXF",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      flatThreshold: 0,
      page: 1,
      pageSize: 100,
      sort: "-trade_date",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid date range", () => {
    const parsed = analyticsFilterSchema.safeParse({
      code: "TXF",
      startDate: "2026-02-01",
      endDate: "2026-01-01",
      flatThreshold: 0,
      page: 1,
      pageSize: 100,
      sort: "-trade_date",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("resetPageOnFilterChange", () => {
  it("resets to page 1 when request-shaping filters change", () => {
    expect(
      resetPageOnFilterChange(
        { code: "TXF", eventId: "day_up_gt_100", startDate: "2026-01-01", endDate: "2026-01-31", flatThreshold: 0 },
        { code: "TXF", eventId: "day_up_gt_100", startDate: "2026-01-01", endDate: "2026-02-15", flatThreshold: 0 },
        4,
      ),
    ).toBe(1);
  });

  it("keeps current page when filters are unchanged", () => {
    expect(
      resetPageOnFilterChange(
        { code: "TXF", eventId: "day_up_gt_100", startDate: "2026-01-01", endDate: "2026-01-31", flatThreshold: 0 },
        { code: "TXF", eventId: "day_up_gt_100", startDate: "2026-01-01", endDate: "2026-01-31", flatThreshold: 0 },
        4,
      ),
    ).toBe(4);
  });
});
