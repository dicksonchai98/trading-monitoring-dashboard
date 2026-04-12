import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BackfillPanel } from "@/features/dashboard/components/BackfillPanel";
import { triggerHistoricalBackfillJob } from "@/features/dashboard/api/historical-backfill";

vi.mock("@/features/dashboard/api/historical-backfill", () => ({
  triggerHistoricalBackfillJob: vi.fn(),
}));

describe("BackfillPanel", () => {
  it("maps single date to start_date and end_date when triggering backfill", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const onJobsCreated = vi.fn();

    vi.mocked(triggerHistoricalBackfillJob).mockResolvedValue({
      job_id: 501,
      worker_type: "historical_backfill",
      job_type: "historical-backfill",
      status: "created",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BackfillPanel token="token" onJobsCreated={onJobsCreated} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId("backfill-load-button"));

    await waitFor(() => {
      expect(triggerHistoricalBackfillJob).toHaveBeenCalledWith("token", {
        code: "TXFR1",
        start_date: "2026-03-17",
        end_date: "2026-03-17",
        overwrite_mode: "closed_only",
      });
    });

    await waitFor(() => {
      expect(onJobsCreated).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            source: "backfill",
            jobId: 501,
            target: "TXFR1",
          }),
        ]),
      );
    });
  });
});
