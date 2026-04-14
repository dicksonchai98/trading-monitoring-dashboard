import {
  applyServingSseEvent,
  createSpotLatestListMockGenerator,
  parseSseFrame,
  splitSseBuffer,
} from "@/features/realtime/services/realtime-manager";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";

describe("realtime-manager", () => {
  const inSessionMinuteTs = Date.parse("2026-04-09T10:00:00+08:00");
  const inSessionMetricTs = Date.parse("2026-04-09T10:00:05+08:00");
  const inSessionMarketMinuteTs = Date.parse("2026-04-09T10:01:00+08:00");
  const inSessionOtcMinuteTs = Date.parse("2026-04-09T10:02:00+08:00");
  const inSessionSpotTs = Date.parse("2026-04-09T10:01:30+08:00");
  const inSessionQuoteTs = Date.parse("2026-04-09T10:01:45+08:00");

  beforeEach(() => {
    useRealtimeStore.getState().resetRealtime();
  });

  it("splits SSE buffers by frame boundary and preserves tail rest", () => {
    const input =
      'event: heartbeat\ndata: {"ts":1}\n\nevent: heartbeat\ndata: {"ts":2}\n\nevent: heartbeat\ndata: {"ts":';
    const { frames, rest } = splitSseBuffer(input);

    expect(frames).toHaveLength(2);
    expect(frames[0]).toContain('data: {"ts":1}');
    expect(frames[1]).toContain('data: {"ts":2}');
    expect(rest).toBe('event: heartbeat\ndata: {"ts":');
  });

  it("splits SSE buffers with CRLF frame boundaries", () => {
    const input =
      'event: heartbeat\r\ndata: {"ts":1}\r\n\r\nevent: heartbeat\r\ndata: {"ts":2}\r\n\r\nevent: heartbeat\r\ndata: {"ts":';
    const { frames, rest } = splitSseBuffer(input);

    expect(frames).toHaveLength(2);
    expect(frames[0]).toContain('data: {"ts":1}');
    expect(frames[1]).toContain('data: {"ts":2}');
    expect(rest).toBe('event: heartbeat\ndata: {"ts":');
  });

  it("parses event and data from a single SSE frame", () => {
    const parsed = parseSseFrame('event: metric_latest\ndata: {"bid":1}\ndata: {"ask":2}');
    expect(parsed.event).toBe("metric_latest");
    expect(parsed.data).toBe('{"bid":1}\n{"ask":2}');
  });

  it("parses event and data from CRLF SSE frame", () => {
    const parsed = parseSseFrame('event: metric_latest\r\ndata: {"bid":1}\r\ndata: {"ask":2}');
    expect(parsed.event).toBe("metric_latest");
    expect(parsed.data).toBe('{"bid":1}\n{"ask":2}');
  });

  it("writes validated kbar and heartbeat events into realtime store", () => {
    applyServingSseEvent("kbar_current", {
      code: "MTX",
      trade_date: "2026-03-23",
      minute_ts: inSessionMinuteTs,
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 20,
    });
    applyServingSseEvent("heartbeat", { ts: 1774233600999 });

    const state = useRealtimeStore.getState();
    expect(state.kbarCurrentByCode.MTX?.close).toBe(100.5);
    expect(state.lastHeartbeatTs).toBe(1774233600999);
  });

  it("writes validated index contribution events into realtime store", () => {
    applyServingSseEvent("index_contrib_ranking", {
      index_code: "TSE001",
      trade_date: "2026-04-10",
      top: [{ rank_no: 1, symbol: "2330", contribution_points: 3.19 }],
      bottom: [{ rank_no: 1, symbol: "2881", contribution_points: -0.82 }],
      ts: 1775802833106,
    });
    applyServingSseEvent("index_contrib_sector", {
      index_code: "TSE001",
      trade_date: "2026-04-10",
      sectors: [
        {
          name: "Semiconductor",
          children: [
            {
              name: "2330",
              size: 12,
              contribution_points: 4.3,
            },
          ],
        },
        {
          name: "Finance",
          children: [
            {
              name: "2881",
              size: 5,
              contribution_points: -1.2,
            },
          ],
        },
      ],
      ts: 1775802833106,
    });

    const state = useRealtimeStore.getState();
    expect(state.indexContribRanking?.top[0]?.symbol).toBe("2330");
    expect(state.indexContribSector?.sectors[0]?.name).toBe("Semiconductor");
    expect(
      state.indexContribSector?.sectors[0]?.children[0]?.contribution_points,
    ).toBe(4.3);
  });

  it("writes metric_latest main_force_big_order into the TXFD6 store key", () => {
    applyServingSseEvent("kbar_current", {
      code: "TXFD6",
      trade_date: "2026-04-08",
      minute_ts: inSessionMinuteTs,
      open: 22300,
      high: 22310,
      low: 22290,
      close: 22305,
      volume: 12,
    });

    applyServingSseEvent("metric_latest", {
      main_force_big_order: 9876,
      ts: inSessionMetricTs,
    });

    const state = useRealtimeStore.getState();
    expect(state.metricLatestByCode.TXFD6?.main_force_big_order).toBe(9876);
  });

  it("routes metric_latest without code to TXFD6 fallback key", () => {
    applyServingSseEvent("metric_latest", {
      main_force_big_order: 321,
      ts: inSessionMetricTs,
    });

    const state = useRealtimeStore.getState();
    expect(state.metricLatestByCode.TXFD6?.main_force_big_order).toBe(321);
  });

  it("routes market_summary_latest without code to TXFD6 fallback key", () => {
    applyServingSseEvent("market_summary_latest", {
      minute_ts: inSessionMarketMinuteTs,
      estimated_turnover: 6666,
    });

    const state = useRealtimeStore.getState();
    expect(state.marketSummaryLatestByCode.TXFD6?.estimated_turnover).toBe(6666);
  });

  it("prefers code over market_code for market_summary_latest routing", () => {
    applyServingSseEvent("market_summary_latest", {
      code: "TXFD6",
      market_code: "TSE001",
      minute_ts: inSessionMarketMinuteTs,
      estimated_turnover: 7777,
      spread: 9.5,
    });

    const state = useRealtimeStore.getState();
    expect(state.marketSummaryLatestByCode.TXFD6?.estimated_turnover).toBe(7777);
    expect(state.marketSummaryLatestByCode.TXFD6?.spread).toBe(9.5);
    expect(state.marketSummaryLatestByCode.TSE001).toBeUndefined();
  });

  it("routes otc_summary_latest without code to OTC001 fallback key", () => {
    applyServingSseEvent("otc_summary_latest", {
      minute_ts: inSessionOtcMinuteTs,
      index_value: 252.34,
    });

    const state = useRealtimeStore.getState();
    expect(state.otcSummaryLatestByCode.OTC001?.index_value).toBe(252.34);
  });

  it("accepts and stores live metrics source fields across three SSE events", () => {
    applyServingSseEvent("kbar_current", {
      code: "TXFD6",
      trade_date: "2026-04-08",
      minute_ts: inSessionMinuteTs,
      open: 22300,
      high: 22310,
      low: 22290,
      close: 22305,
      volume: 12,
      day_amplitude: 20,
    });
    applyServingSseEvent("metric_latest", {
      main_force_big_order_strength: 0.72,
      ts: inSessionMetricTs,
    });
    applyServingSseEvent("market_summary_latest", {
      spread: 12.5,
      estimated_turnover: 2940000000,
      minute_ts: inSessionMarketMinuteTs,
    });

    const state = useRealtimeStore.getState();
    expect(state.kbarCurrentByCode.TXFD6?.day_amplitude).toBe(20);
    expect(state.metricLatestByCode.TXFD6?.main_force_big_order_strength).toBe(0.72);
    expect(state.marketSummaryLatestByCode.TXFD6?.spread).toBe(12.5);
    expect(state.marketSummaryLatestByCode.TXFD6?.estimated_turnover).toBe(2940000000);
  });

  it("writes spot_latest_list into realtime store", () => {
    applyServingSseEvent("spot_latest_list", {
      ts: inSessionSpotTs,
      market_strength_score: 0.5,
      market_strength_pct: 25,
      market_strength_count: 1,
      sector_strength: {
        weighted: 65,
        financial: null,
        tech: null,
      },
      market_strength_breakdown: {
        new_high: 1,
        strong_up: 0,
        flat: 0,
        strong_down: 0,
        new_low: 0,
      },
      items: [
        {
          symbol: "2330",
          last_price: 950,
          price_chg: 5,
          pct_chg: 0.53,
          is_new_high: true,
          is_new_low: false,
          strength_state: "new_high",
          strength_score: 2,
          strength_pct: 100,
          session_high: 955,
          session_low: 940,
          updated_at: inSessionSpotTs,
        },
      ],
    });

    const state = useRealtimeStore.getState();
    expect(state.spotLatestList?.items).toHaveLength(1);
    expect(state.spotLatestList?.items[0]?.symbol).toBe("2330");
    expect(state.spotLatestList?.items[0]?.last_price).toBe(950);
    expect(state.spotLatestList?.items[0]?.price_chg).toBe(5);
    expect(state.spotLatestList?.items[0]?.pct_chg).toBe(0.53);
    expect(state.spotLatestList?.items[0]?.is_new_high).toBe(true);
    expect(state.spotLatestList?.items[0]?.is_new_low).toBe(false);
    expect(state.spotLatestList?.items[0]?.strength_state).toBe("new_high");
    expect(state.spotLatestList?.items[0]?.strength_score).toBe(2);
    expect(state.spotLatestList?.items[0]?.strength_pct).toBe(100);
    expect(state.spotLatestList?.market_strength_score).toBe(0.5);
    expect(state.spotLatestList?.market_strength_pct).toBe(25);
    expect(state.spotLatestList?.market_strength_count).toBe(1);
    expect(state.spotLatestList?.sector_strength?.weighted).toBe(65);
  });

  it("spot latest list mock generator emits six gap symbols every second", () => {
    const startTs = Date.parse("2026-04-09T10:00:00+08:00");
    const generator = createSpotLatestListMockGenerator(startTs);

    const first = generator.next().value;
    const second = generator.next().value;

    expect(first?.items).toHaveLength(6);
    expect(first?.items.map((item) => item.symbol)).toEqual([
      "2330",
      "2317",
      "2454",
      "2308",
      "2881",
      "6505",
    ]);
    expect(first?.ts).toBe(startTs);
    expect(typeof first?.market_strength_score).toBe("number");
    expect(typeof first?.market_strength_pct).toBe("number");
    expect(first?.market_strength_count).toBe(6);
    expect(first?.sector_strength).toBeDefined();
    expect(typeof first?.items[0]?.strength_pct).toBe("number");
    expect(first?.items.some((item) => typeof item.strength_pct !== "number")).toBe(false);
    expect(first?.market_strength_breakdown).toBeDefined();
    expect(second?.ts).toBe(startTs + 1000);
    expect(second?.items[0]?.last_price).not.toBe(first?.items[0]?.last_price);
  });

  it("routes quote_latest without code to TXFD6 fallback key", () => {
    applyServingSseEvent("quote_latest", {
      event_ts: "2026-04-09T10:01:45+08:00",
      main_chip: 120,
      long_short_force: -16,
      main_chip_strength: 0.61,
      long_short_force_strength: 0.47,
    });

    const state = useRealtimeStore.getState();
    expect(state.quoteLatestByCode.TXFD6?.main_chip).toBe(120);
    expect(state.quoteLatestByCode.TXFD6?.long_short_force).toBe(-16);
    expect(state.quoteLatestByCode.TXFD6?.main_chip_strength).toBe(0.61);
    expect(state.quoteLatestByCode.TXFD6?.long_short_force_strength).toBe(0.47);
  });

  it("ignores invalid payloads without mutating store", () => {
    applyServingSseEvent("kbar_current", { code: "MTX" });
    applyServingSseEvent("heartbeat", { ts: "bad" });
    applyServingSseEvent("index_contrib_ranking", {
      index_code: "TSE001",
      trade_date: "2026-04-10",
      top: [],
      bottom: [],
      ts: "bad",
    });
    applyServingSseEvent("index_contrib_sector", {
      index_code: "TSE001",
      trade_date: "2026-04-10",
      sectors: {
        Semiconductor: "bad",
      },
      ts: 1775802833106,
    });

    const state = useRealtimeStore.getState();
    expect(Object.keys(state.kbarCurrentByCode)).toHaveLength(0);
    expect(state.lastHeartbeatTs).toBeNull();
    expect(state.indexContribRanking).toBeNull();
    expect(state.indexContribSector).toBeNull();
  });

  it("ignores dashboard SSE payloads outside 09:00-13:45 session window", () => {
    applyServingSseEvent("kbar_current", {
      code: "TXFD6",
      trade_date: "2026-04-09",
      minute_ts: Date.parse("2026-04-09T14:00:00+08:00"),
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1,
    });
    applyServingSseEvent("metric_latest", {
      ts: Date.parse("2026-04-09T14:00:01+08:00"),
      main_force_big_order: 123,
    });
    applyServingSseEvent("market_summary_latest", {
      minute_ts: Date.parse("2026-04-09T14:00:02+08:00"),
      estimated_turnover: 9999,
    });
    applyServingSseEvent("otc_summary_latest", {
      minute_ts: Date.parse("2026-04-09T14:00:02+08:00"),
      index_value: 300,
    });
    applyServingSseEvent("heartbeat", { ts: 1775714400000 });
    applyServingSseEvent("spot_latest_list", {
      ts: Date.parse("2026-04-09T14:00:03+08:00"),
      items: [{ symbol: "2330", last_price: 999 }],
    });
    applyServingSseEvent("quote_latest", {
      event_ts: Date.parse("2026-04-09T14:00:04+08:00"),
      main_chip: 20,
    });

    const state = useRealtimeStore.getState();
    expect(state.kbarCurrentByCode.TXFD6).toBeUndefined();
    expect(state.metricLatestByCode.TXFD6).toBeUndefined();
    expect(state.marketSummaryLatestByCode.TXFD6).toBeUndefined();
    expect(state.otcSummaryLatestByCode.OTC001).toBeUndefined();
    expect(state.quoteLatestByCode.TXFD6).toBeUndefined();
    expect(state.spotLatestList).toBeNull();
    expect(state.lastHeartbeatTs).toBe(1775714400000);
  });
});
