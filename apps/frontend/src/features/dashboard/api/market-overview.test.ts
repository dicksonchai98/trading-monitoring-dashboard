import { getOrderFlowBaseline } from "@/features/dashboard/api/market-overview";

describe("getOrderFlowBaseline", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/v1/kbar/1m/today?code=TXF"),
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
      expect.stringContaining("/v1/metric/bidask/today?code=TXF"),
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
