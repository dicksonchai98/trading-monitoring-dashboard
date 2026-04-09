import { render, screen } from "@testing-library/react";
import { DashboardMetricPanels } from "@/features/dashboard/components/DashboardMetricPanels";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";

describe("DashboardMetricPanels main force needle", () => {
  beforeEach(() => {
    useRealtimeStore.getState().resetRealtime();
  });

  it("shows realtime main_force_big_order_strength percentage on main-force card", () => {
    useRealtimeStore.getState().upsertMetricLatest("TXFD6", {
      main_force_big_order_strength: 0.631,
      ts: 1775600405000,
    });

    render(<DashboardMetricPanels />);

    expect(screen.getByTestId("live-metrics-main-force-gauge")).toBeInTheDocument();
    expect(screen.getByTestId("live-metrics-main-force-strength")).toHaveTextContent("63.1%");
    expect(screen.queryByText(/WEAK|BALANCED|STRONG/i)).not.toBeInTheDocument();
  });

  it("shows day amplitude and estimated turnover in yi unit on core metric cards", () => {
    useRealtimeStore.getState().upsertKbarCurrent({
      code: "TXFD6",
      trade_date: "2026-04-09",
      minute_ts: 1775700000000,
      open: 20000,
      high: 20120,
      low: 19920,
      close: 20080,
      volume: 100,
      day_amplitude: 200,
    });
    useRealtimeStore.getState().upsertMarketSummaryLatest("TXFD6", {
      estimated_turnover: 2_940_000_000,
      spread: 12.5,
      minute_ts: 1775700000000,
    });

    render(<DashboardMetricPanels />);

    expect(screen.getByText("200.00")).toBeInTheDocument();
    expect(screen.getByText("29.40億")).toBeInTheDocument();
  });
});
