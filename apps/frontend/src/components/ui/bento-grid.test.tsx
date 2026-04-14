import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BentoGrid, BentoGridSection } from "@/components/ui/bento-grid";

describe("BentoGrid", () => {
  it("renders a 12-column grid container", () => {
    render(
      <BentoGrid>
        <div>Panel</div>
      </BentoGrid>,
    );

    expect(screen.getByTestId("bento-grid")).toHaveClass("lg:grid-cols-12");
  });
});

describe("BentoGridSection", () => {
  it("renders a section header above the grid", () => {
    render(
      <BentoGridSection title="MARKET OVERVIEW">
        <div>Panel</div>
      </BentoGridSection>,
    );

    expect(screen.getByText("MARKET OVERVIEW")).toBeInTheDocument();
    expect(screen.getByTestId("bento-grid")).toBeInTheDocument();
  });

  it("shows tooltip when hovering section title", async () => {
    render(
      <BentoGridSection title="MARKET OVERVIEW">
        <div>Panel</div>
      </BentoGridSection>,
    );

    const title = screen.getByText("MARKET OVERVIEW");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(title);
    expect(screen.getByRole("tooltip")).toHaveTextContent("MARKET OVERVIEW");

    fireEvent.mouseLeave(title);
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });
});
