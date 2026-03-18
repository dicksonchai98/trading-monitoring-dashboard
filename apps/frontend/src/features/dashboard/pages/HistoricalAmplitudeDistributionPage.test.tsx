import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HistoricalAmplitudeDistributionPage } from "@/features/dashboard/pages/HistoricalAmplitudeDistributionPage";

describe("HistoricalAmplitudeDistributionPage", () => {
  it("renders histogram page and controls", () => {
    render(
      <MemoryRouter initialEntries={["/historical-amplitude-distribution"]}>
        <HistoricalAmplitudeDistributionPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "歷史振幅分佈圖" }),
    ).toBeInTheDocument();
    expect(screen.getByText("/historical-amplitude-distribution")).toBeInTheDocument();
    expect(screen.getByText("HISTORICAL AMPLITUDE DISTRIBUTION")).toBeInTheDocument();
    expect(screen.getByText("Filter Controls")).toBeInTheDocument();
    expect(screen.getByText("Distribution Histogram")).toBeInTheDocument();
    expect(screen.getByText("All Trading Dates")).toBeInTheDocument();
    expect(screen.getByTestId("amplitude-histogram-chart")).toBeInTheDocument();
  });
});
