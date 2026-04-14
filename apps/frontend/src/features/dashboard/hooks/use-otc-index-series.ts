import { useEffect, useState } from "react";
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

  useEffect(() => {
    let cancelled = false;
    if (!resolved || !token || role === "visitor") {
      setSeries([]);
      return () => {
        cancelled = true;
      };
    }
    void getOtcSummaryToday(token, DEFAULT_OTC_CODE)
      .then((rows) => {
        if (cancelled) {
          return;
        }
        setSeries(toSeries(rows));
      })
      .catch(() => {
        if (!cancelled) {
          setSeries([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [resolved, role, token]);

  useEffect(() => {
    if (
      !otcLatest ||
      typeof otcLatest.index_value !== "number" ||
      !Number.isFinite(otcLatest.index_value)
    ) {
      return;
    }
    const minuteTs = resolveMinuteTs(otcLatest);
    if (minuteTs === null) {
      return;
    }
    const latestValue = otcLatest.index_value as number;
    setSeries((current) => {
      if (current.length === 0) {
        return current;
      }
      const base = current[0]?.value;
      if (typeof base !== "number" || !Number.isFinite(base)) {
        return current;
      }
      const change = Number((latestValue - base).toFixed(2));
      const nextPoint: OtcIndexSeriesPoint = {
        time: formatTime(minuteTs),
        minuteTs,
        value: latestValue,
        change,
        upChange: change >= 0 ? change : null,
        downChange: change < 0 ? change : null,
      };
      const existingIndex = current.findIndex(
        (point) => point.minuteTs === minuteTs,
      );
      if (existingIndex >= 0) {
        const existingPoint = current[existingIndex];
        if (existingPoint && existingPoint.value === latestValue) {
          return current;
        }
        const next = [...current];
        next[existingIndex] = nextPoint;
        return next;
      }
      const tail = current[current.length - 1];
      if (tail && minuteTs > tail.minuteTs) {
        return [...current, nextPoint];
      }
      const insertIndex = current.findIndex((point) => point.minuteTs > minuteTs);
      if (insertIndex === -1) {
        return [...current, nextPoint];
      }
      return [
        ...current.slice(0, insertIndex),
        nextPoint,
        ...current.slice(insertIndex),
      ];
    });
  }, [otcLatest]);

  return { series };
}
