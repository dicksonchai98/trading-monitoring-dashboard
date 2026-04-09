import {
  getDailyAmplitudeHistory,
  getEstimatedVolumeBaseline,
  getOtcSummaryToday,
  getOrderFlowBaseline,
} from "@/features/dashboard/api/market-overview";

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

  it("requests TXFD6 kbar and bidask today baselines with bearer token headers", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ code: "TXFD6", minute_ts: 1 }]), {
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
      kbarToday: [{ code: "TXFD6", minute_ts: 1 }],
      metricToday: [{ ts: 2, main_force_big_order: 3 }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const expectedFromMs = Date.parse("2026-04-08T09:00:00+08:00");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(`/v1/kbar/1m/today?code=TXFD6&from_ms=${expectedFromMs}&to_ms=${FIXED_NOW_MS}`),
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
      expect.stringContaining(`/v1/metric/bidask/today?code=TXFD6&from_ms=${expectedFromMs}&to_ms=${FIXED_NOW_MS}`),
      expect.objectContaining({
        credentials: "include",
        method: "GET",
        headers: {
          Authorization: "Bearer token",
        },
      }),
    );
  });

  it("requests today and yesterday estimated volume baselines with bearer token headers", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ minute_ts: 1, estimated_turnover: 100 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ minute_ts: 2, estimated_turnover: 80 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await expect(getEstimatedVolumeBaseline("token")).resolves.toEqual({
      marketSummaryToday: [{ minute_ts: 1, estimated_turnover: 100 }],
      marketSummaryYesterday: [{ minute_ts: 2, estimated_turnover: 80 }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const expectedTodayFromMs = Date.parse("2026-04-08T09:00:00+08:00");
    const expectedYesterdayFromMs = Date.parse("2026-04-07T09:00:00+08:00");
    const elapsedMs = FIXED_NOW_MS - expectedTodayFromMs;
    const expectedYesterdayToMs = expectedYesterdayFromMs + elapsedMs;

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(`/v1/market-summary/today?code=TXFD6&from_ms=${expectedTodayFromMs}&to_ms=${FIXED_NOW_MS}`),
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
      expect.stringContaining(`/v1/market-summary/history?code=TXFD6&from_ms=${expectedYesterdayFromMs}&to_ms=${expectedYesterdayToMs}`),
      expect.objectContaining({
        credentials: "include",
        method: "GET",
        headers: {
          Authorization: "Bearer token",
        },
      }),
    );
  });

  it("caps estimated volume baseline query to 13:45 after day session close", async () => {
    const afterCloseMs = Date.parse("2026-04-08T15:12:30+08:00");
    vi.spyOn(Date, "now").mockReturnValue(afterCloseMs);

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ minute_ts: 1, estimated_turnover: 100 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ minute_ts: 2, estimated_turnover: 80 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await getEstimatedVolumeBaseline("token");

    const expectedTodayFromMs = Date.parse("2026-04-08T09:00:00+08:00");
    const expectedTodayToMs = Date.parse("2026-04-08T13:45:00+08:00");
    const expectedYesterdayFromMs = Date.parse("2026-04-07T09:00:00+08:00");
    const expectedYesterdayToMs = Date.parse("2026-04-07T13:45:00+08:00");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        `/v1/market-summary/today?code=TXFD6&from_ms=${expectedTodayFromMs}&to_ms=${expectedTodayToMs}`,
      ),
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        `/v1/market-summary/history?code=TXFD6&from_ms=${expectedYesterdayFromMs}&to_ms=${expectedYesterdayToMs}`,
      ),
      expect.anything(),
    );
  });

  it("requests daily amplitude history with code and n", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            code: "TXFD6",
            trade_date: "2026-04-08",
            open: 34810,
            high: 34980,
            low: 34780,
            close: 34920,
            day_amplitude: 200,
          },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(getDailyAmplitudeHistory("token", "TXFD6", 19)).resolves.toEqual([
      {
        code: "TXFD6",
        trade_date: "2026-04-08",
        open: 34810,
        high: 34980,
        low: 34780,
        close: 34920,
        day_amplitude: 200,
      },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/kbar/1m/daily-amplitude?code=TXFD6&n=19"),
      expect.objectContaining({
        credentials: "include",
        method: "GET",
        headers: {
          Authorization: "Bearer token",
        },
      }),
    );
  });

  it("requests otc summary today with bearer token headers", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ code: "OTC001", minute_ts: 1, index_value: 250.1 }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getOtcSummaryToday("token", "OTC001")).resolves.toEqual([
      { code: "OTC001", minute_ts: 1, index_value: 250.1 },
    ]);

    const expectedFromMs = Date.parse("2026-04-08T08:45:00+08:00");
    const expectedToMs = Date.parse("2026-04-08T13:44:00+08:00");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        `/v1/otc-summary/today?code=OTC001&from_ms=${expectedFromMs}&to_ms=${expectedToMs}`,
      ),
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
