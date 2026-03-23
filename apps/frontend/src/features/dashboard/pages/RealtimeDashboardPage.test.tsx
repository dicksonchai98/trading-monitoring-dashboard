import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RealtimeDashboardPage } from "@/features/dashboard/pages/RealtimeDashboardPage";

describe("RealtimeDashboardPage", () => {
  it("renders existing dashboard sections and the new SSE chart section at the bottom", () => {
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

    expect(screen.getByText("SSE LIVE STREAM")).toBeInTheDocument();
    expect(screen.getByTestId("sse-close-trend-panel")).toBeInTheDocument();
    expect(screen.getByTestId("sse-spread-panel")).toBeInTheDocument();
    expect(screen.getByTestId("sse-depth-panel")).toBeInTheDocument();
    expect(screen.getByText("Waiting for SSE data...")).toBeInTheDocument();
  });
});
