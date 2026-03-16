import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageLayout } from "@/components/ui/page-layout";

describe("PageLayout", () => {
  it("renders a shared page header and body container", () => {
    render(
      <MemoryRouter initialEntries={["/subscription"]}>
        <PageLayout title="Subscription (Mock)">
          <div>Body</div>
        </PageLayout>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Subscription (Mock)" })).toBeInTheDocument();
    expect(screen.getByText("/subscription")).toBeInTheDocument();
    expect(screen.getByTestId("page-layout")).toHaveClass("space-y-[var(--section-gap)]");
    expect(screen.getByTestId("page-layout-body")).toContainElement(screen.getByText("Body"));
  });
});
