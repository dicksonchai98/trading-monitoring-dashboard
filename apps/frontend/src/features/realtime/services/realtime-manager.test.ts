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

  it("parses event and data from a single SSE frame", () => {
    const parsed = parseSseFrame('event: metric_latest\ndata: {"bid":1}\ndata: {"ask":2}');
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

  it("ignores invalid payloads without mutating store", () => {
    applyServingSseEvent("kbar_current", { code: "MTX" });
    applyServingSseEvent("heartbeat", { ts: "bad" });

    const state = useRealtimeStore.getState();
    expect(Object.keys(state.kbarCurrentByCode)).toHaveLength(0);
    expect(state.lastHeartbeatTs).toBeNull();
  });
});
