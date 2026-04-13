import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CrawlerPanel } from "@/features/dashboard/components/CrawlerPanel";
import { triggerCrawlerJob } from "@/features/dashboard/api/crawler-jobs";

vi.mock("@/features/dashboard/api/crawler-jobs", () => ({
  triggerCrawlerJob: vi.fn(),
}));

describe("CrawlerPanel", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("uses target_date in single mode", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const onJobsCreated = vi.fn();
    vi.mocked(triggerCrawlerJob).mockResolvedValue({
      job_id: 701,
      worker_type: "market_crawler",
      job_type: "crawler-single-date",
      status: "created",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CrawlerPanel token="token" onJobsCreated={onJobsCreated} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId("crawler-load-button"));

    await waitFor(() => {
      expect(triggerCrawlerJob).toHaveBeenCalledWith("token", {
        dataset_code: "taifex_institution_open_interest_daily",
        target_date: "2026-03-17",
        trigger_type: "manual",
      });
    });
  });

  it("uses start_date and end_date in range mode", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const onJobsCreated = vi.fn();
    vi.mocked(triggerCrawlerJob).mockResolvedValue({
      job_id: 702,
      worker_type: "market_crawler",
      job_type: "crawler-backfill",
      status: "created",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CrawlerPanel token="token" onJobsCreated={onJobsCreated} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId("crawler-date-mode"));
    fireEvent.click(screen.getByText("Date Range"));
    fireEvent.click(screen.getByTestId("crawler-load-button"));

    await waitFor(() => {
      expect(triggerCrawlerJob).toHaveBeenCalledWith("token", {
        dataset_code: "taifex_institution_open_interest_daily",
        start_date: "2026-03-10",
        end_date: "2026-03-17",
        trigger_type: "manual",
      });
    });
  });
});
