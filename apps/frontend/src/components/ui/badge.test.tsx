import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("supports semantic status variants", () => {
    render(<Badge variant="success">SSE Connected</Badge>);

    const badge = screen.getByText("SSE Connected");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-success/15");
  });
});
