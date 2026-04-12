import { useEffect, useMemo, useState } from "react";
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
  const [baseline, setBaseline] = useState<OtcIndexSeriesPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!resolved || !token || role === "visitor") {
      setBaseline([]);
      return () => {
        cancelled = true;
      };
    }
    void getOtcSummaryToday(token, DEFAULT_OTC_CODE)
      .then((rows) => {
        if (cancelled) {
          return;
        }
        setBaseline(toSeries(rows));
      })
      .catch(() => {
        if (!cancelled) {
          setBaseline([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [resolved, role, token]);

  const series = useMemo(() => {
    if (
      !otcLatest ||
      typeof otcLatest.index_value !== "number" ||
      !Number.isFinite(otcLatest.index_value)
    ) {
      return baseline;
    }
    const minuteTs = resolveMinuteTs(otcLatest);
    if (minuteTs === null) {
      return baseline;
    }

    const existing = baseline.findIndex((point) => point.minuteTs === minuteTs);
    const merged =
      existing >= 0
        ? baseline.map((point, index) =>
            index === existing ? { ...point, value: otcLatest.index_value as number } : point,
          )
        : [
            ...baseline,
            {
              time: formatTime(minuteTs),
              minuteTs,
              value: otcLatest.index_value as number,
              change: 0,
              upChange: null,
              downChange: null,
            },
          ];

    return toSeries(
      merged.map((row) => ({
        minute_ts: row.minuteTs,
        index_value: row.value,
      })),
    );
  }, [baseline, otcLatest]);

  return { series };
}
