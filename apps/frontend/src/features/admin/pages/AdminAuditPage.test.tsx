import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminAuditPage } from "@/features/admin/pages/AdminAuditPage";

describe("AdminAuditPage", () => {
  it("uses the shared page layout header", () => {
    render(
      <MemoryRouter initialEntries={["/admin/audit"]}>
        <AdminAuditPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Admin Audit Log" })).toBeInTheDocument();
    expect(screen.getByText("/admin/audit")).toBeInTheDocument();
    expect(screen.getByText("Time | Actor | Action | Target | Result")).toBeInTheDocument();
  });
});
