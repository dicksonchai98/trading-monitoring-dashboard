import { render, screen } from "@testing-library/react";
import { PanelCard } from "@/components/ui/panel-card";

describe("PanelCard", () => {
  it("renders a panel card with title, optional note trigger, and grid span classes", () => {
    render(
      <PanelCard title="Order Flow" note="Panel note" span={8}>
        <div>Body</div>
      </PanelCard>,
    );

    expect(screen.getByTestId("panel-card")).toHaveClass("lg:col-span-8");
    expect(screen.getByText("Order Flow")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show panel notes for Order Flow" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("supports a units prop to set height from the grid unit token", () => {
    render(<PanelCard title="Volume Ladder" span={4} units={7} />);

    expect(screen.getByTestId("panel-card")).toHaveStyle({
      minHeight: "calc(var(--grid-unit-h) * 7)",
    });
  });
});
