import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HistoricalDataAnalysisPage } from "@/features/dashboard/pages/HistoricalDataAnalysisPage";

describe("HistoricalDataAnalysisPage", () => {
  it("renders the historical analysis title while reusing the dashboard content layout", () => {
    render(
      <MemoryRouter initialEntries={["/historical-data-analysis"]}>
        <HistoricalDataAnalysisPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Historical Data Analysis" })).toBeInTheDocument();
    expect(screen.getByText("/historical-data-analysis")).toBeInTheDocument();
    expect(screen.getByText("MARKET OVERVIEW")).toBeInTheDocument();
    expect(screen.getByText("PARTICIPANT OVERVIEW")).toBeInTheDocument();
    expect(screen.getByText("SSE Connected")).toBeInTheDocument();
    expect(screen.getByTestId("order-flow-chart")).toBeInTheDocument();
  });
});
