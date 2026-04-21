import { Children, cloneElement, isValidElement } from "react";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { TrendIndexCard } from "@/features/dashboard/components/TrendIndexCard";
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

describe("TrendIndexCard", () => {
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

  it("renders the intraday trend chart", () => {
    useRealtimeStore.setState({
      spotMarketDistributionLatest: {
        ts: Date.parse("2026-04-16T01:00:00Z"),
        up_count: 7,
        down_count: 3,
        flat_count: 2,
        total_count: 12,
        trend_index: 0.24,
        bucket_width_pct: 1,
        distribution_buckets: [],
      },
      spotMarketDistributionSeries: {
        items: [
          {
            ts: Date.parse("2026-04-16T01:00:00Z"),
            up_count: 7,
            down_count: 3,
            flat_count: 2,
            total_count: 12,
            trend_index: 0.24,
          },
          {
            ts: Date.parse("2026-04-16T01:05:00Z"),
            up_count: 2,
            down_count: 8,
            flat_count: 2,
            total_count: 12,
            trend_index: -0.5,
          },
        ],
      },
    });

    const { container } = render(<TrendIndexCard />);

    expect(screen.getByText("Trend Index")).toBeInTheDocument();
    expect(screen.getByText("09:00 - 13:30")).toBeInTheDocument();
    expect(screen.getByText("09:00")).toBeInTheDocument();
    expect(screen.getByTestId("trend-index-chart")).toBeInTheDocument();
    expect(container.querySelector(".recharts-line-curve")).toBeInTheDocument();
  });
});
