import { fireEvent, render, screen } from "@testing-library/react";
import { PanelHeader } from "@/components/ui/panel-header";

describe("PanelHeader", () => {
  it("renders title and meta", () => {
    render(<PanelHeader title="Order Flow" meta="8 col / 5u" />);

    expect(screen.getByText("Order Flow")).toBeInTheDocument();
    expect(screen.getByText("8 col / 5u")).toBeInTheDocument();
  });

  it("shows note content when the info icon is hovered or focused", () => {
    render(<PanelHeader title="Order Flow" note="Monitor near-month order-flow commentary." />);

    const trigger = screen.getByRole("button", { name: "Show panel notes for Order Flow" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Monitor near-month order-flow commentary.",
    );

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Monitor near-month order-flow commentary.",
    );
  });
});
