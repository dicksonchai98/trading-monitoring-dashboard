import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  getAnalyticsMetrics,
  getDistributionStats,
} from "@/features/analytics/api/analytics";
import { HistoricalAmplitudeDistributionPage } from "@/features/dashboard/pages/HistoricalAmplitudeDistributionPage";
import { useAuthStore } from "@/lib/store/auth-store";

vi.mock("@/features/analytics/api/analytics", () => ({
  getAnalyticsMetrics: vi.fn(),
  getDistributionStats: vi.fn(),
}));

describe("HistoricalAmplitudeDistributionPage", () => {
  it("renders histogram page and controls", async () => {
    useAuthStore.setState({
      token: "token",
      role: "admin",
      entitlement: "active",
      resolved: true,
      checkoutSessionId: null,
    });

    vi.mocked(getAnalyticsMetrics).mockResolvedValue({
      metrics: [{ id: "amplitude", label: "Amplitude" }],
    });
    vi.mocked(getDistributionStats).mockResolvedValue({
      metric_id: "amplitude",
      sample_count: 4,
      mean: 0,
      median: 0,
      min: -200,
      max: 180,
      p75: 50,
      p90: 90,
      p95: 120,
      histogram_json: {
        bins: ["-200~-100", "-100~0", "0~100", "100~200"],
        counts: [1, 1, 1, 1],
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/historical-amplitude-distribution"]}>
          <HistoricalAmplitudeDistributionPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Historical Amplitude Distribution",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("/historical-amplitude-distribution"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("HISTORICAL AMPLITUDE DISTRIBUTION"),
    ).toBeInTheDocument();
    expect(screen.getByText("Distribution Histogram")).toBeInTheDocument();
    expect(
      await screen.findByTestId("amplitude-histogram-chart"),
    ).toBeInTheDocument();
  });
});
