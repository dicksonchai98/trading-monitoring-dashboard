import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { getAnalyticsEvents, getEventStats } from "@/features/analytics/api/analytics";
import { HistoricalDataAnalysisPage } from "@/features/dashboard/pages/HistoricalDataAnalysisPage";
import { useAuthStore } from "@/lib/store/auth-store";

vi.mock("@/features/analytics/api/analytics", () => ({
  getAnalyticsEvents: vi.fn(),
  getEventStats: vi.fn(),
}));

describe("HistoricalDataAnalysisPage", () => {
  it("renders a single selected-event panel chart", async () => {
    useAuthStore.setState({
      token: "token",
      role: "admin",
      entitlement: "active",
      resolved: true,
      checkoutSessionId: null,
    });

    vi.mocked(getAnalyticsEvents).mockResolvedValue({
      events: [{ id: "day_up_gt_100", label: "Day up > 100" }],
    });
    vi.mocked(getEventStats).mockResolvedValue({
      items: [
        {
          event_id: "day_up_gt_100",
          code: "TXFR1",
          sample_count: 42,
          up_probability: 0.6,
          down_probability: 0.3,
          flat_probability: 0.1,
          avg_next_day_return: 12.34,
          avg_next_day_range: 88.8,
          version: 1,
        },
      ],
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/historical-data-analysis"]}>
          <HistoricalDataAnalysisPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("HISTORICAL SIGNALS")).toBeInTheDocument();
    expect(screen.getByLabelText("event_id")).toBeInTheDocument();
    expect(screen.getByLabelText("code")).toBeInTheDocument();
    expect(await screen.findAllByTestId("historical-signal-panel")).toHaveLength(1);
    expect(await screen.findByTestId("dealer-chart")).toBeInTheDocument();
  });
});
