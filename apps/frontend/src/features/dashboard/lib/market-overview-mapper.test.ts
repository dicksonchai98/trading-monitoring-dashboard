import {
  applyRealtimePatch,
  buildOrderFlowSeries,
  minuteKeyFromEpochMs,
  type OrderFlowSeriesPoint,
} from "@/features/dashboard/lib/market-overview-mapper";

describe("market-overview-mapper", () => {
  const minute0 = Date.parse("2026-04-08T09:00:00+08:00");
  const minute1 = Date.parse("2026-04-08T09:01:00+08:00");

  it("rounds timestamps down to the minute key", () => {
    expect(minuteKeyFromEpochMs(minute0 + 123)).toBe(minute0);
    expect(minuteKeyFromEpochMs(minute0 + 59_999)).toBe(minute0);
  });

  it("uses the latest metric sample in the same minute and defaults missing metric values to zero", () => {
    const series = buildOrderFlowSeries(
      [
        {
          code: "TXFD6",
          trade_date: "2026-04-08",
          minute_ts: minute0,
          open: 22300,
          high: 22310,
          low: 22290,
          close: 22305,
          volume: 12,
        },
        {
          code: "TXFD6",
          trade_date: "2026-04-08",
          minute_ts: minute1,
          open: 22305,
          high: 22315,
          low: 22300,
          close: 22312,
          volume: 15,
        },
      ],
      [
        { main_force_big_order: 100, ts: minute0 + 1000 },
        { main_force_big_order: 240, ts: minute0 + 4000 },
      ],
    );

    expect(series).toEqual([
      {
        minuteTs: minute0,
        time: "09:00",
        indexPrice: 22305,
        chipDelta: 240,
      },
      {
        minuteTs: minute1,
        time: "09:01",
        indexPrice: 22312,
        chipDelta: 0,
      },
    ]);
  });

  it("uses event_ts as the metric timestamp when ts is absent", () => {
    const series = buildOrderFlowSeries(
      [
        {
          code: "TXFD6",
          trade_date: "2026-04-08",
          minute_ts: minute0,
          open: 22300,
          high: 22310,
          low: 22290,
          close: 22305,
          volume: 12,
        },
      ],
      [
        { main_force_big_order: 321, event_ts: "2026-04-08T09:00:45+08:00" },
      ],
    );

    expect(series).toEqual([
      {
        minuteTs: minute0,
        time: "09:00",
        indexPrice: 22305,
        chipDelta: 321,
      },
    ]);
  });

  it("updates only the targeted minute when patching existing series and preserves order", () => {
    const initial: OrderFlowSeriesPoint[] = [
      {
        minuteTs: minute0,
        time: "09:00",
        indexPrice: 22305,
        chipDelta: 240,
      },
      {
        minuteTs: minute1,
        time: "09:01",
        indexPrice: 22312,
        chipDelta: 0,
      },
    ];

    const next = applyRealtimePatch(initial, {
      minuteTs: Date.parse("2026-04-08T09:01:45+08:00"),
      chipDelta: 888,
    });

    expect(next).toEqual([
      {
        minuteTs: minute0,
        time: "09:00",
        indexPrice: 22305,
        chipDelta: 240,
      },
      {
        minuteTs: minute1,
        time: "09:01",
        indexPrice: 22312,
        chipDelta: 888,
      },
    ]);
  });

  it("does not append a missing minute for chipDelta-only patches", () => {
    const initial: OrderFlowSeriesPoint[] = [
      {
        minuteTs: minute0,
        time: "09:00",
        indexPrice: 22305,
        chipDelta: 240,
      },
    ];

    const next = applyRealtimePatch(initial, {
      minuteTs: minute1,
      chipDelta: 555,
    });

    expect(next).toEqual([
      {
        minuteTs: minute0,
        time: "09:00",
        indexPrice: 22305,
        chipDelta: 240,
      },
    ]);
  });

  it("appends a new point when patching a missing minute with indexPrice", () => {
    const initial: OrderFlowSeriesPoint[] = [
      {
        minuteTs: minute0,
        time: "09:00",
        indexPrice: 22305,
        chipDelta: 240,
      },
    ];

    const next = applyRealtimePatch(initial, {
      minuteTs: minute1,
      indexPrice: 22318,
    });

    expect(next).toEqual([
      {
        minuteTs: minute0,
        time: "09:00",
        indexPrice: 22305,
        chipDelta: 240,
      },
      {
        minuteTs: minute1,
        time: "09:01",
        indexPrice: 22318,
        chipDelta: 0,
      },
    ]);
  });
});
