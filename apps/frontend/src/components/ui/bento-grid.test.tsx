import { render, screen } from "@testing-library/react";
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
});
