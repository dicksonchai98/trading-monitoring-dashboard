import { render, screen } from "@testing-library/react";
import { SpotMarketDistributionCard } from "@/features/dashboard/components/SpotMarketDistributionCard";
import { useSpotMarketDistributionBaseline } from "@/features/dashboard/hooks/use-spot-market-distribution";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";

vi.mock("@/features/dashboard/hooks/use-spot-market-distribution", () => ({
  useSpotMarketDistributionBaseline: vi.fn(() => ({
    loading: false,
    error: null,
  })),
}));

describe("SpotMarketDistributionCard", () => {
  const useSpotMarketDistributionBaselineMock = vi.mocked(
    useSpotMarketDistributionBaseline,
  );

  beforeEach(() => {
    useRealtimeStore.getState().resetRealtime();
    useSpotMarketDistributionBaselineMock.mockReturnValue({
      loading: false,
      error: null,
    });
  });

  it("renders an empty state when no market distribution data exists", () => {
    render(<SpotMarketDistributionCard />);

    expect(screen.getByTestId("spot-market-distribution-card")).toBeInTheDocument();
    expect(screen.getByText("No market distribution data available.")).toBeInTheDocument();
  });

  it("renders a loading state while the REST baseline is resolving", () => {
    useSpotMarketDistributionBaselineMock.mockReturnValueOnce({
      loading: true,
      error: null,
    });

    render(<SpotMarketDistributionCard />);

    expect(screen.getByText("Loading market distribution...")).toBeInTheDocument();
  });

  it("renders the distribution chart with a trend reference line", () => {
    useRealtimeStore.setState({
      spotMarketDistributionLatest: {
        ts: 1775796000000,
        up_count: 7,
        down_count: 3,
        flat_count: 2,
        total_count: 12,
        trend_index: 0.3333333333,
        bucket_width_pct: 1,
        distribution_buckets: [
          { label: "< -1%", lower_pct: -100, upper_pct: -1, count: 3 },
          { label: "0%", lower_pct: -1, upper_pct: 1, count: 2 },
          { label: "+1%", lower_pct: 1, upper_pct: 2, count: 4 },
        ],
      },
      spotMarketDistributionSeries: {
        items: [
          {
            ts: 1775796000000,
            up_count: 6,
            down_count: 4,
            flat_count: 2,
            total_count: 12,
            trend_index: 0.25,
          },
        ],
      },
    });

    render(<SpotMarketDistributionCard />);

    expect(screen.getByText("Breadth Distribution")).toBeInTheDocument();
    expect(screen.getByTestId("spot-market-distribution-chart")).toBeInTheDocument();
  });
});
