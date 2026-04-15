import {
  buildDashboardDailyAmplitudeQueryKey,
  buildDashboardEstimatedVolumeBaselineQueryKey,
  buildDashboardOrderFlowBaselineQueryKey,
  buildDashboardQuoteTodayQueryKey,
} from "@/features/dashboard/lib/query-keys";

describe("dashboard query keys", () => {
  it("builds stable order-flow and quote baseline keys from code", () => {
    expect(buildDashboardOrderFlowBaselineQueryKey("TXFD6")).toEqual([
      "dashboard-order-flow-baseline",
      { code: "TXFD6" },
    ]);
    expect(buildDashboardQuoteTodayQueryKey("TXFD6")).toEqual([
      "dashboard-quote-today",
      { code: "TXFD6" },
    ]);
  });

  it("builds stable estimated-volume and amplitude-history keys", () => {
    expect(buildDashboardEstimatedVolumeBaselineQueryKey("TXFD6")).toEqual([
      "dashboard-estimated-volume-baseline",
      { code: "TXFD6" },
    ]);
    expect(buildDashboardDailyAmplitudeQueryKey("TXFD6", 19)).toEqual([
      "dashboard-daily-amplitude-history",
      { code: "TXFD6", historyLength: 19 },
    ]);
  });
});
