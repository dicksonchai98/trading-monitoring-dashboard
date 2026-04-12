import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HistoricalDataLoaderPage } from "@/features/dashboard/pages/HistoricalDataLoaderPage";

describe("HistoricalDataLoaderPage", () => {
  it("renders backfill panel, crawler panel, and unified feed", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/historical-data-loader"]}>
          <HistoricalDataLoaderPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("LOAD CONFIGURATION")).toBeInTheDocument();
    expect(screen.getByText("Backfill Jobs")).toBeInTheDocument();
    expect(screen.getByText("Crawler Jobs")).toBeInTheDocument();
    expect(screen.getByText("Unified Job Feed")).toBeInTheDocument();
    expect(screen.getByTestId("backfill-date-mode")).toBeInTheDocument();
    expect(screen.getByTestId("crawler-date-mode")).toBeInTheDocument();
    expect(screen.getByTestId("unified-jobs-empty")).toBeInTheDocument();
  });
});
