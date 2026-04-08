import {
  applyServingSseEvent,
  parseSseFrame,
  splitSseBuffer,
} from "@/features/realtime/services/realtime-manager";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";

describe("realtime-manager", () => {
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
      minute_ts: 1774233600000,
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

  it("writes metric_latest main_force_big_order into the TXFD6 store key", () => {
    applyServingSseEvent("kbar_current", {
      code: "TXFD6",
      trade_date: "2026-04-08",
      minute_ts: 1775600400000,
      open: 22300,
      high: 22310,
      low: 22290,
      close: 22305,
      volume: 12,
    });

    applyServingSseEvent("metric_latest", {
      main_force_big_order: 9876,
      ts: 1775600405000,
    });

    const state = useRealtimeStore.getState();
    expect(state.metricLatestByCode.TXFD6?.main_force_big_order).toBe(9876);
  });

  it("routes metric_latest without code to TXFD6 fallback key", () => {
    applyServingSseEvent("metric_latest", {
      main_force_big_order: 321,
      ts: 1775600460000,
    });

    const state = useRealtimeStore.getState();
    expect(state.metricLatestByCode.TXFD6?.main_force_big_order).toBe(321);
  });

  it("routes market_summary_latest without code to TXFD6 fallback key", () => {
    applyServingSseEvent("market_summary_latest", {
      minute_ts: 1775600460000,
      estimated_turnover: 6666,
    });

    const state = useRealtimeStore.getState();
    expect(state.marketSummaryLatestByCode.TXFD6?.estimated_turnover).toBe(6666);
  });

  it("accepts and stores live metrics source fields across three SSE events", () => {
    applyServingSseEvent("kbar_current", {
      code: "TXFD6",
      trade_date: "2026-04-08",
      minute_ts: 1775600400000,
      open: 22300,
      high: 22310,
      low: 22290,
      close: 22305,
      volume: 12,
      day_amplitude: 20,
    });
    applyServingSseEvent("metric_latest", {
      main_force_big_order_strength: 0.72,
      ts: 1775600405000,
    });
    applyServingSseEvent("market_summary_latest", {
      spread: 12.5,
      estimated_turnover: 2940000000,
      minute_ts: 1775600460000,
    });

    const state = useRealtimeStore.getState();
    expect(state.kbarCurrentByCode.TXFD6?.day_amplitude).toBe(20);
    expect(state.metricLatestByCode.TXFD6?.main_force_big_order_strength).toBe(0.72);
    expect(state.marketSummaryLatestByCode.TXFD6?.spread).toBe(12.5);
    expect(state.marketSummaryLatestByCode.TXFD6?.estimated_turnover).toBe(2940000000);
  });

  it("ignores invalid payloads without mutating store", () => {
    applyServingSseEvent("kbar_current", { code: "MTX" });
    applyServingSseEvent("heartbeat", { ts: "bad" });

    const state = useRealtimeStore.getState();
    expect(Object.keys(state.kbarCurrentByCode)).toHaveLength(0);
    expect(state.lastHeartbeatTs).toBeNull();
  });
});
