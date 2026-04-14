import { render, screen, within } from "@testing-library/react";
import { UnifiedJobsTable } from "@/features/dashboard/components/UnifiedJobsTable";

describe("UnifiedJobsTable", () => {
  it("renders merged rows sorted by createdAt desc", () => {
    render(
      <UnifiedJobsTable
        jobs={[
          {
            source: "backfill",
            jobId: 11,
            workerType: "historical_backfill",
            jobType: "historical-backfill",
            status: "created",
            target: "TXFR1",
            window: "2026-03-10 ~ 2026-03-17",
            createdAt: "2026-04-07T10:00:00.000Z",
          },
          {
            source: "crawler",
            jobId: 22,
            workerType: "market_crawler",
            jobType: "crawler-backfill",
            status: "created",
            target: "taifex_institution_open_interest_daily",
            window: "2026-03-01 ~ 2026-03-07",
            createdAt: "2026-04-08T10:00:00.000Z",
          },
        ]}
      />,
    );

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("crawler")).toBeInTheDocument();
    expect(within(rows[2]).getByText("backfill")).toBeInTheDocument();
  });
});
