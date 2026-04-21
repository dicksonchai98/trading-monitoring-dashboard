import { Children, cloneElement, isValidElement } from "react";
import type { ReactElement } from "react";
import { render, screen, within } from "@testing-library/react";
import { SpotMarketDistributionCard } from "@/features/dashboard/components/SpotMarketDistributionCard";
import { useSpotMarketDistributionBaseline } from "@/features/dashboard/hooks/use-spot-market-distribution";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children?: unknown }) => {
      const child = Children.only(children) as ReactElement<{
        width: number;
        height: number;
      }>;
      return isValidElement(child)
        ? cloneElement(child, { width: 400, height: 180 })
        : null;
    },
  };
});

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

  it("renders the distribution chart with bar labels", () => {
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
          { label: "0%", lower_pct: -1, upper_pct: 1, count: 5 },
          { label: "+1%", lower_pct: 1, upper_pct: 2, count: 13 },
        ],
      },
    });

    render(<SpotMarketDistributionCard />);

    expect(screen.getByText("Breadth Distribution")).toBeInTheDocument();
    const chart = screen.getByTestId("spot-market-distribution-chart");
    expect(chart).toBeInTheDocument();
    expect(within(chart).getByText("13")).toBeInTheDocument();
  });
});
