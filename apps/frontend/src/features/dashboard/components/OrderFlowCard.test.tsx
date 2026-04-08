import { render, screen } from "@testing-library/react";
import { OrderFlowCard } from "@/features/dashboard/components/OrderFlowCard";

describe("OrderFlowCard", () => {
  it("shows loading state while the timeline is loading", () => {
    render(
      <OrderFlowCard
        series={[]}
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
        series={[]}
        loading={false}
        error="boom"
      />,
    );

    expect(screen.getByText("Unable to load order flow data.")).toBeInTheDocument();
    expect(screen.queryByTestId("order-flow-chart")).not.toBeInTheDocument();
  });

  it("renders the chart with the supplied series when loading is complete", () => {
    render(
      <OrderFlowCard
        series={[
          {
            minuteTs: Date.parse("2026-04-08T09:00:00+08:00"),
            time: "09:00",
            indexPrice: 22305,
            chipDelta: 100,
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
