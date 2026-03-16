import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";

describe("PageHeader", () => {
  it("renders title and context line", () => {
    render(
      <MemoryRouter>
        <PageHeader title="Futures Dashboard" context="Dashboard / Overview" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Futures Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Dashboard / Overview")).toBeInTheDocument();
  });

  it("defaults context to the current pathname when not provided", () => {
    render(
      <MemoryRouter initialEntries={["/admin/audit"]}>
        <PageHeader title="Admin Audit Log" />
      </MemoryRouter>,
    );

    expect(screen.getByText("/admin/audit")).toBeInTheDocument();
  });
});
