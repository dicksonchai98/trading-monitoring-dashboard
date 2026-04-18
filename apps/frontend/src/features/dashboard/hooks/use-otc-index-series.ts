import { useEffect, useState, useRef } from "react";
import {
  DEFAULT_OTC_CODE,
  getOtcSummaryToday,
} from "@/features/dashboard/api/market-overview";
import { useOtcSummaryLatest } from "@/features/realtime/hooks/use-otc-summary-latest";
import { useAuthStore } from "@/lib/store/auth-store";

export interface OtcIndexSeriesPoint {
  time: string;
  value: number;
  change: number;
  upChange: number | null;
  downChange: number | null;
  minuteTs: number;
}

interface UseOtcIndexSeriesResult {
  series: OtcIndexSeriesPoint[];
}

function formatTime(tsMs: number): string {
  const date = new Date(tsMs);
  const hh = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  }).format(date);
  const mm = new Intl.DateTimeFormat("en-GB", {
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  }).format(date);
  return `${hh}:${mm}`;
}

function resolveMinuteTs(point: { minute_ts?: number; event_ts?: number }): number | null {
  if (typeof point.minute_ts === "number" && Number.isFinite(point.minute_ts)) {
    return point.minute_ts;
  }
  if (typeof point.event_ts === "number" && Number.isFinite(point.event_ts)) {
    return point.event_ts;
  }
  return null;
}

function toSeries(points: Array<{ minute_ts?: number; event_ts?: number; index_value?: number | null }>) {
  const sorted = [...points]
    .map((point) => {
      const minuteTs = resolveMinuteTs(point);
      const value = point.index_value;
      if (minuteTs === null || typeof value !== "number" || !Number.isFinite(value)) {
        return null;
      }
      return { minuteTs, value };
    })
    .filter((row): row is { minuteTs: number; value: number } => row !== null)
    .sort((a, b) => a.minuteTs - b.minuteTs);

  const base = sorted[0]?.value;
  if (typeof base !== "number" || !Number.isFinite(base)) {
    return [] as OtcIndexSeriesPoint[];
  }
  return sorted.map((row) => {
    const change = Number((row.value - base).toFixed(2));
    return {
      time: formatTime(row.minuteTs),
      value: row.value,
      change,
      upChange: change >= 0 ? change : null,
      downChange: change < 0 ? change : null,
      minuteTs: row.minuteTs,
    };
  });
}

export function useOtcIndexSeries(): UseOtcIndexSeriesResult {
  const token = useAuthStore((state) => state.token);
  const resolved = useAuthStore((state) => state.resolved);
  const role = useAuthStore((state) => state.role);
  const otcLatest = useOtcSummaryLatest(DEFAULT_OTC_CODE);
  const [series, setSeries] = useState<OtcIndexSeriesPoint[]>([]);
  const indexRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (!resolved || !token || role === "visitor") {
      setSeries([]);
      indexRef.current = new Map();
      return () => {
        cancelled = true;
        controller.abort();
      };
    }
    void getOtcSummaryToday(token, DEFAULT_OTC_CODE, controller.signal)
      .then((rows) => {
        if (cancelled) {
          return;
        }
        const built = toSeries(rows);
        setSeries(built);
        const m = new Map<number, number>();
        for (let i = 0; i < built.length; ++i) m.set(built[i].minuteTs, i);
        indexRef.current = m;
      })
      .catch(() => {
        if (!cancelled) {
          setSeries([]);
          indexRef.current = new Map();
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [resolved, role, token]);

  useEffect(() => {    if (      !otcLatest ||      typeof otcLatest.index_value !== "number" ||      !Number.isFinite(otcLatest.index_value)    ) {      return;    }    const minuteTs = resolveMinuteTs(otcLatest);    if (minuteTs === null) {      return;    }    const latestValue = otcLatest.index_value as number;    setSeries((current) => {      if (current.length === 0) return current;      const base = current[0]?.value;      if (typeof base !== "number" || !Number.isFinite(base)) return current;      const change = Number((latestValue - base).toFixed(2));      const nextPoint: OtcIndexSeriesPoint = {        time: formatTime(minuteTs),        minuteTs,        value: latestValue,        change,        upChange: change >= 0 ? change : null,        downChange: change < 0 ? change : null,      };      const { nextSeries, nextIndexMap, didChange } = upsertPoint(current, indexRef.current, nextPoint as any);      if (!didChange) return current;      indexRef.current = nextIndexMap;      return nextSeries as OtcIndexSeriesPoint[];    });  }, [otcLatest]);  return { series };
}
