import { render, screen } from "@testing-library/react";
import { OrderFlowCard } from "@/features/dashboard/components/OrderFlowCard";

describe("OrderFlowCard", () => {
  it("shows loading state while the timeline is loading", () => {
    render(
      <OrderFlowCard
        chartData={[]}
        loading
        error={null}
      />,
    );

    expect(screen.getByText("Loading TXFD6 order flow...")).toBeInTheDocument();
    expect(screen.queryByTestId("order-flow-chart")).not.toBeInTheDocument();
  });

  it("shows error state when the timeline fails to load", () => {
    render(
      <OrderFlowCard
        chartData={[]}
        loading={false}
        error="boom"
      />,
    );

    expect(screen.getByText("Unable to load order flow data.")).toBeInTheDocument();
    expect(screen.queryByTestId("order-flow-chart")).not.toBeInTheDocument();
  });

  it("shows empty state when timeline has no points", () => {
    render(
      <OrderFlowCard
        chartData={[]}
        loading={false}
        error={null}
      />,
    );

    expect(screen.getByText("No order flow data available.")).toBeInTheDocument();
    expect(screen.queryByTestId("order-flow-chart")).not.toBeInTheDocument();
  });

  it("renders the chart with the supplied series when loading is complete", () => {
    render(
      <OrderFlowCard
        chartData={[
          {
            time: "09:00",
            indexPrice: 22305,
            chipDelta: 100,
            buyVolume: 100,
            sellVolume: 0,
          },
        ]}
        loading={false}
        error={null}
      />,
    );

    expect(screen.getByText("Order Flow")).toBeInTheDocument();
    expect(screen.getByTestId("order-flow-chart")).toBeInTheDocument();
  });
});
