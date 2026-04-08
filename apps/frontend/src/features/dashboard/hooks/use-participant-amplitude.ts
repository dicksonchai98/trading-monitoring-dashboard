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
  wickColor: string;
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

const dayLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Taipei",
  month: "2-digit",
  day: "2-digit",
});

function formatDayLabel(isoDate: string): string {
  const parsed = Date.parse(`${isoDate}T00:00:00+08:00`);
  if (!Number.isFinite(parsed)) {
    return isoDate;
  }
  return dayLabelFormatter.format(new Date(parsed));
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
    amplitude: row.day_amplitude,
    isRealtime: false,
    wickColor: row.close >= row.open ? "#ef4444" : "#22c55e",
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

  return {
    day: formatDayLabel(tradeDate),
    tradeDate,
    open: first.open,
    high,
    low,
    close: last.close,
    amplitude: high - low,
    isRealtime: true,
    wickColor: last.close >= first.open ? "#ef4444" : "#22c55e",
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
        ? kbarCurrent.day_amplitude
        : kbarCurrent.high - kbarCurrent.low;
    return {
      day: formatDayLabel(kbarCurrent.trade_date),
      tradeDate: kbarCurrent.trade_date,
      open: kbarCurrent.open,
      high: kbarCurrent.high,
      low: kbarCurrent.low,
      close: kbarCurrent.close,
      amplitude,
      isRealtime: true,
      wickColor: kbarCurrent.close >= kbarCurrent.open ? "#ef4444" : "#22c55e",
    };
  }

  const high = Math.max(current.high, kbarCurrent.high);
  const low = Math.min(current.low, kbarCurrent.low);
  const close = kbarCurrent.close;
  const amplitude =
    typeof kbarCurrent.day_amplitude === "number"
      ? kbarCurrent.day_amplitude
      : high - low;

  return {
    ...current,
    high,
    low,
    close,
    amplitude,
    wickColor: close >= current.open ? "#ef4444" : "#22c55e",
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
    setClosedSeries([]);
    setTodayRealtimeCandle(null);

    if (!resolved) {
      setLoading(true);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    if (!token || role === "visitor") {
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    void Promise.all([
      getDailyAmplitudeHistory(token, code, 19),
      getOrderFlowBaseline(token, code),
    ])
      .then(([dailyRows, baseline]) => {
        if (cancelled) {
          return;
        }
        setClosedSeries(toClosedSeries(dailyRows));
        setTodayRealtimeCandle(aggregateTodayKbar(baseline.kbarToday));
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
