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
});
