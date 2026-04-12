import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HistoricalDataAnalysisPage } from "@/features/dashboard/pages/HistoricalDataAnalysisPage";

describe("HistoricalDataAnalysisPage", () => {
  it("renders the historical analysis title and historical signals grid", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/historical-data-analysis"]}>
          <HistoricalDataAnalysisPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Historical Data Analysis" })).toBeInTheDocument();
    expect(screen.getByText("/historical-data-analysis")).toBeInTheDocument();
    expect(screen.getByText("HISTORICAL SIGNALS")).toBeInTheDocument();
    expect(screen.getByText("SSE Connected")).toBeInTheDocument();
    expect(screen.getByLabelText("event_id")).toBeInTheDocument();
    expect(screen.getByLabelText("code")).toBeInTheDocument();
    expect(screen.getByLabelText("start_date")).toBeInTheDocument();
    expect(screen.getByLabelText("end_date")).toBeInTheDocument();
    expect(screen.getByLabelText("version")).toBeInTheDocument();
    expect(screen.getAllByTestId("historical-signal-panel")).toHaveLength(14);
  });
});
