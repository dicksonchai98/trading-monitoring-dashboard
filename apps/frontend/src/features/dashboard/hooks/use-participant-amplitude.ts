import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ORDER_FLOW_CODE,
  getDailyAmplitudeHistory,
  getOrderFlowBaseline,
} from "@/features/dashboard/api/market-overview";
import type { DailyAmplitudePoint, KbarTodayPoint } from "@/features/dashboard/api/types";
import { useKbarCurrent } from "@/features/realtime/hooks/use-kbar-current";
import { useAuthStore } from "@/lib/store/auth-store";

interface ParticipantCandlePoint {
  day: string;
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  amplitude: number;
  isRealtime: boolean;
}

interface ParticipantAmplitudeSummary {
  avg5: number;
  avg10: number;
  yesterday: number;
  max5: number;
  max10: number;
}

interface UseParticipantAmplitudeResult {
  summary: ParticipantAmplitudeSummary;
  series: ParticipantCandlePoint[];
  loading: boolean;
  error: string | null;
}

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Taipei",
  month: "2-digit",
  day: "2-digit",
});

function normalizeAmplitude(value: number): number {
  return Math.abs(value);
}

function formatDayLabel(isoDate: string): string {
  const parsed = Date.parse(`${isoDate}T00:00:00+08:00`);
  if (!Number.isFinite(parsed)) {
    return isoDate;
  }
  return dayLabelFormatter.format(new Date(parsed));
}

function resolveTodayDayLabelInTaipei(): string {
  return dayLabelFormatter.format(new Date());
}

function computeSummary(closedSeries: ParticipantCandlePoint[]): ParticipantAmplitudeSummary {
  const amplitudes = closedSeries.map((item) => item.amplitude);
  const latestFirst = [...amplitudes].reverse();
  const latest5 = latestFirst.slice(0, 5);
  const latest10 = latestFirst.slice(0, 10);
  const avg = (values: number[]) =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
  const max = (values: number[]) => (values.length === 0 ? 0 : Math.max(...values));

  return {
    avg5: avg(latest5),
    avg10: avg(latest10),
    yesterday: latestFirst[0] ?? 0,
    max5: max(latest5),
    max10: max(latest10),
  };
}

function toClosedSeries(rows: DailyAmplitudePoint[]): ParticipantCandlePoint[] {
  const ascRows = [...rows].reverse();
  return ascRows.map((row) => ({
    day: formatDayLabel(row.trade_date),
    tradeDate: row.trade_date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    amplitude: normalizeAmplitude(row.day_amplitude),
    isRealtime: false,
  }));
}

function aggregateTodayKbar(kbars: KbarTodayPoint[]): ParticipantCandlePoint | null {
  if (kbars.length === 0) {
    return null;
  }
  const asc = [...kbars].sort((left, right) => left.minute_ts - right.minute_ts);
  const first = asc[0];
  const last = asc[asc.length - 1];
  const high = Math.max(...asc.map((item) => item.high));
  const low = Math.min(...asc.map((item) => item.low));
  const tradeDate = first.trade_date;
  const amplitude =
    typeof last.day_amplitude === "number"
      ? normalizeAmplitude(last.day_amplitude)
      : normalizeAmplitude(high - low);

  return {
    day: resolveTodayDayLabelInTaipei(),
    tradeDate,
    open: first.open,
    high,
    low,
    close: last.close,
    amplitude,
    isRealtime: true,
  };
}

function patchRealtimeTodayCandle(
  current: ParticipantCandlePoint | null,
  kbarCurrent: {
    minute_ts: number;
    open: number;
    high: number;
    low: number;
    close: number;
    trade_date: string;
    day_amplitude?: number | null;
  },
): ParticipantCandlePoint {
  if (!current) {
    const amplitude =
      typeof kbarCurrent.day_amplitude === "number"
        ? normalizeAmplitude(kbarCurrent.day_amplitude)
        : normalizeAmplitude(kbarCurrent.high - kbarCurrent.low);
    return {
      day: resolveTodayDayLabelInTaipei(),
      tradeDate: kbarCurrent.trade_date,
      open: kbarCurrent.open,
      high: kbarCurrent.high,
      low: kbarCurrent.low,
      close: kbarCurrent.close,
      amplitude,
      isRealtime: true,
    };
  }

  const high = Math.max(current.high, kbarCurrent.high);
  const low = Math.min(current.low, kbarCurrent.low);
  const close = kbarCurrent.close;
  const amplitude =
    typeof kbarCurrent.day_amplitude === "number"
      ? normalizeAmplitude(kbarCurrent.day_amplitude)
      : normalizeAmplitude(high - low);

  return {
    ...current,
    high,
    low,
    close,
    amplitude,
  };
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "participant_amplitude_load_failed";
}

export function useParticipantAmplitude(
  code: string = DEFAULT_ORDER_FLOW_CODE,
): UseParticipantAmplitudeResult {
  const token = useAuthStore((state) => state.token);
  const resolved = useAuthStore((state) => state.resolved);
  const role = useAuthStore((state) => state.role);
  const kbarCurrent = useKbarCurrent(code);

  const [closedSeries, setClosedSeries] = useState<ParticipantCandlePoint[]>([]);
  const [todayRealtimeCandle, setTodayRealtimeCandle] = useState<ParticipantCandlePoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setClosedSeries([]);
    setTodayRealtimeCandle(null);

    if (!resolved) {
      setLoading(true);
      setError(null);
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    if (!token || role === "visitor") {
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    setLoading(true);
    setError(null);

    void Promise.allSettled([
      getDailyAmplitudeHistory(token, code, 19, controller.signal),
      getOrderFlowBaseline(token, code, controller.signal),
    ])
      .then((results) => {
        if (cancelled) {
          return;
        }

        const [dailyResult, baselineResult] = results;
        if (dailyResult.status !== "fulfilled") {
          throw dailyResult.reason;
        }

        setClosedSeries(toClosedSeries(dailyResult.value));
        if (baselineResult.status === "fulfilled") {
          setTodayRealtimeCandle(aggregateTodayKbar(baselineResult.value.kbarToday));
        } else {
          setTodayRealtimeCandle(null);
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(resolveErrorMessage(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [code, resolved, role, token]);

  useEffect(() => {
    if (!kbarCurrent) {
      return;
    }

    setTodayRealtimeCandle((current) => patchRealtimeTodayCandle(current, kbarCurrent));
  }, [kbarCurrent]);

  const summary = useMemo(() => computeSummary(closedSeries), [closedSeries]);

  const series = useMemo(() => {
    if (todayRealtimeCandle) {
      return [...closedSeries, todayRealtimeCandle];
    }
    return closedSeries;
  }, [closedSeries, todayRealtimeCandle]);

  return {
    summary,
    series,
    loading,
    error,
  };
}
