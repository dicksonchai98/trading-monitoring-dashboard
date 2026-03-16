import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RealtimeDashboardPage } from "@/features/dashboard/pages/RealtimeDashboardPage";

describe("RealtimeDashboardPage", () => {
  it("renders page header and stacked grid section headers", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <RealtimeDashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Futures Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("/dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("page-layout")).toBeInTheDocument();
    expect(screen.getByText("MARKET OVERVIEW")).toBeInTheDocument();
    expect(screen.getByText("PARTICIPANT OVERVIEW")).toBeInTheDocument();
    expect(screen.getByText("SSE Connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show panel notes for Order Flow" })).toBeInTheDocument();
    expect(screen.getByTestId("order-flow-chart")).toBeInTheDocument();
    expect(screen.getByTestId("volume-ladder-chart")).toBeInTheDocument();
    expect(screen.getByTestId("bid-ask-pressure-chart")).toBeInTheDocument();
    expect(screen.getByTestId("program-activity-chart")).toBeInTheDocument();
    expect(screen.getByTestId("foreign-chart")).toBeInTheDocument();
    expect(screen.getByTestId("dealer-chart")).toBeInTheDocument();
    expect(screen.getByTestId("retail-chart")).toBeInTheDocument();
    expect(screen.getByTestId("sentiment-chart")).toBeInTheDocument();
    expect(screen.getAllByTestId("panel-chart")).toHaveLength(8);
    expect(screen.getAllByTestId("bento-grid")).toHaveLength(2);
  });
});
