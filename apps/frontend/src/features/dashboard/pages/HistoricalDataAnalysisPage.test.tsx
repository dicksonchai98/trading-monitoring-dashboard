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

    expect(screen.getByText("HISTORICAL SIGNALS")).toBeInTheDocument();
    expect(screen.getAllByTestId("historical-signal-panel")).toHaveLength(14);
  });
});
