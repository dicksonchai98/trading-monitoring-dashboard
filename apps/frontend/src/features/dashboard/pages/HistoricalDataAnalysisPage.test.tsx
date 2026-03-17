import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HistoricalDataAnalysisPage } from "@/features/dashboard/pages/HistoricalDataAnalysisPage";

describe("HistoricalDataAnalysisPage", () => {
  it("renders the historical analysis title and historical signals grid", () => {
    render(
      <MemoryRouter initialEntries={["/historical-data-analysis"]}>
        <HistoricalDataAnalysisPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Historical Data Analysis" })).toBeInTheDocument();
    expect(screen.getByText("/historical-data-analysis")).toBeInTheDocument();
    expect(screen.getByText("HISTORICAL SIGNALS")).toBeInTheDocument();
    expect(screen.getByText("SSE Connected")).toBeInTheDocument();
    expect(screen.getAllByTestId("historical-signal-panel")).toHaveLength(14);
  });
});
