import { render, screen } from "@testing-library/react";
import { Typography } from "@/components/ui/typography";

describe("Typography", () => {
  it("renders h1 variant with semantic class", () => {
    render(
      <Typography as="h1" variant="h1">
        Dashboard
      </Typography>,
    );

    const heading = screen.getByRole("heading", { name: "Dashboard" });
    expect(heading).toHaveClass("typo-h1");
  });

  it("defaults to body variant", () => {
    render(<Typography>Body text</Typography>);
    expect(screen.getByText("Body text")).toHaveClass("typo-body");
  });
});

