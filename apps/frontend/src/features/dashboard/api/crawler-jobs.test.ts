import { triggerCrawlerJob } from "@/features/dashboard/api/crawler-jobs";

describe("triggerCrawlerJob", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("posts a single-date crawler payload with auth header", async () => {
    const payload = {
      dataset_code: "txf_oi",
      target_date: "2026-04-08",
      trigger_type: "manual",
    } as const;

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ job_id: 101, worker_type: "market_crawler", job_type: "crawler-single-date", status: "queued" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(triggerCrawlerJob("token", payload)).resolves.toEqual({
      job_id: 101,
      worker_type: "market_crawler",
      job_type: "crawler-single-date",
      status: "queued",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/batch/crawler/jobs", {
      credentials: "include",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
      body: JSON.stringify(payload),
    });
  });

  it("posts a range crawler payload with auth header", async () => {
    const payload = {
      dataset_code: "txf_oi",
      start_date: "2026-04-01",
      end_date: "2026-04-08",
      trigger_type: "manual",
    } as const;

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ job_id: 102, worker_type: "market_crawler", job_type: "crawler-backfill", status: "queued" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(triggerCrawlerJob("token", payload)).resolves.toEqual({
      job_id: 102,
      worker_type: "market_crawler",
      job_type: "crawler-backfill",
      status: "queued",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/batch/crawler/jobs", {
      credentials: "include",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
      body: JSON.stringify(payload),
    });
  });
});
