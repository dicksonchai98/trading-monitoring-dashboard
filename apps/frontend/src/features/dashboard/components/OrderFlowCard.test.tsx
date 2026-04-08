import { render, screen } from "@testing-library/react";
import { OrderFlowCard } from "@/features/dashboard/components/OrderFlowCard";
import { useMarketOverviewTimeline } from "@/features/dashboard/hooks/use-market-overview-timeline";

vi.mock("@/features/dashboard/hooks/use-market-overview-timeline", () => ({
  useMarketOverviewTimeline: vi.fn(),
}));

describe("OrderFlowCard", () => {
  const useMarketOverviewTimelineMock = vi.mocked(useMarketOverviewTimeline);

  beforeEach(() => {
    useMarketOverviewTimelineMock.mockReset();
  });

  it("shows loading state while the timeline is loading", () => {
    useMarketOverviewTimelineMock.mockReturnValue({
      series: [],
      loading: true,
      error: null,
    });

    render(<OrderFlowCard />);

    expect(screen.getByText("Loading TXF order flow...")).toBeInTheDocument();
    expect(screen.queryByTestId("order-flow-chart")).not.toBeInTheDocument();
  });

  it("shows error state when the timeline fails to load", () => {
    useMarketOverviewTimelineMock.mockReturnValue({
      series: [],
      loading: false,
      error: "boom",
    });

    render(<OrderFlowCard />);

    expect(screen.getByText("Unable to load order flow data.")).toBeInTheDocument();
    expect(screen.queryByTestId("order-flow-chart")).not.toBeInTheDocument();
  });

  it("renders the chart with the supplied series when loading is complete", () => {
    useMarketOverviewTimelineMock.mockReturnValue({
      series: [
        {
          minuteTs: Date.parse("2026-04-08T09:00:00+08:00"),
          time: "09:00",
          indexPrice: 22305,
          chipDelta: 100,
        },
      ],
      loading: false,
      error: null,
    });

    render(<OrderFlowCard />);

    expect(screen.getByText("Order Flow")).toBeInTheDocument();
    expect(screen.getByTestId("order-flow-chart")).toBeInTheDocument();
  });
});
