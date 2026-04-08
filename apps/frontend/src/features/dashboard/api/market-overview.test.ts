import { getOrderFlowBaseline } from "@/features/dashboard/api/market-overview";

describe("getOrderFlowBaseline", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const FIXED_NOW_MS = Date.parse("2026-04-08T10:15:30+08:00");

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW_MS);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("requests TXF kbar and bidask today baselines with bearer token headers", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ code: "TXF", minute_ts: 1 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ ts: 2, main_force_big_order: 3 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await expect(getOrderFlowBaseline("token")).resolves.toEqual({
      kbarToday: [{ code: "TXF", minute_ts: 1 }],
      metricToday: [{ ts: 2, main_force_big_order: 3 }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const expectedFromMs = Date.parse("2026-04-08T09:00:00+08:00");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(`/v1/kbar/1m/today?code=TXF&from_ms=${expectedFromMs}&to_ms=${FIXED_NOW_MS}`),
      expect.objectContaining({
        credentials: "include",
        method: "GET",
        headers: {
          Authorization: "Bearer token",
        },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`/v1/metric/bidask/today?code=TXF&from_ms=${expectedFromMs}&to_ms=${FIXED_NOW_MS}`),
      expect.objectContaining({
        credentials: "include",
        method: "GET",
        headers: {
          Authorization: "Bearer token",
        },
      }),
    );
  });
});
