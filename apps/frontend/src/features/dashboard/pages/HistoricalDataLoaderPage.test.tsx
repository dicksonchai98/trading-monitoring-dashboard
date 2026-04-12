import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HistoricalDataLoaderPage } from "@/features/dashboard/pages/HistoricalDataLoaderPage";

describe("HistoricalDataLoaderPage", () => {
  it("renders load controls and status panel", () => {
    render(
      <MemoryRouter initialEntries={["/historical-data-loader"]}>
        <HistoricalDataLoaderPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("LOAD CONFIGURATION")).toBeInTheDocument();
    expect(screen.getByText("Query Controls")).toBeInTheDocument();
    expect(screen.getByText("Load Status")).toBeInTheDocument();
    expect(screen.getByTestId("loader-mode-single")).toBeChecked();
    expect(screen.getByTestId("loader-mode-range")).not.toBeChecked();
    expect(screen.getByTestId("history-load-button")).toBeInTheDocument();
    expect(screen.getByTestId("history-load-status")).toBeInTheDocument();
  });
});
