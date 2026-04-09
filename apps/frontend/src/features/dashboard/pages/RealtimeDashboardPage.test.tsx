import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RealtimeDashboardPage } from "@/features/dashboard/pages/RealtimeDashboardPage";

describe("RealtimeDashboardPage", () => {
  it("renders the dashboard sections without the deprecated SSE mock block", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <RealtimeDashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Futures Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("/dashboard")).toBeInTheDocument();
    expect(screen.getByText("LIVE METRICS")).toBeInTheDocument();
    expect(screen.getByText("MARKET OVERVIEW")).toBeInTheDocument();
    expect(screen.getByText("PARTICIPANT OVERVIEW")).toBeInTheDocument();

    expect(screen.queryByText("SSE LIVE STREAM")).not.toBeInTheDocument();
  });
});
