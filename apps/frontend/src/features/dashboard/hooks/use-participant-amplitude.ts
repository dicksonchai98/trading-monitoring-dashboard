import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_ORDER_FLOW_CODE,
} from "@/features/dashboard/api/market-overview";
import type { DailyAmplitudePoint, KbarTodayPoint } from "@/features/dashboard/api/types";
import {
  dashboardDailyAmplitudeQueryOptions,
  dashboardOrderFlowBaselineQueryOptions,
} from "@/features/dashboard/lib/dashboard-queries";
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
  const isEnabled = resolved && Boolean(token) && role !== "visitor";
  const dailyAmplitudeQuery = useQuery({
    ...dashboardDailyAmplitudeQueryOptions(token ?? "", code, 19),
    enabled: isEnabled,
  });
  const baselineQuery = useQuery({
    ...dashboardOrderFlowBaselineQueryOptions(token ?? "", code),
    enabled: isEnabled,
  });

  const closedSeries = useMemo(
    () => toClosedSeries(dailyAmplitudeQuery.data ?? []),
    [dailyAmplitudeQuery.data],
  );
  const todayRealtimeCandle = useMemo(() => {
    const aggregatedTodayCandle = aggregateTodayKbar(
      baselineQuery.data?.kbarToday ?? [],
    );

    // Validate that the aggregated today candle and realtime kbar belong to the same Taipei trade date.
    const todayTradeDateIso = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const validAggregated =
      aggregatedTodayCandle && aggregatedTodayCandle.tradeDate === todayTradeDateIso
        ? aggregatedTodayCandle
        : null;

    const validKbarCurrent =
      kbarCurrent && kbarCurrent.trade_date === todayTradeDateIso
        ? kbarCurrent
        : null;

    // If there's no valid realtime kbar for today, return the validated aggregated candle (might be null).
    if (!validKbarCurrent) {
      return validAggregated;
    }

    return patchRealtimeTodayCandle(validAggregated, validKbarCurrent);
  }, [baselineQuery.data?.kbarToday, kbarCurrent]);

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
    loading:
      !resolved ? true : dailyAmplitudeQuery.isLoading || baselineQuery.isLoading,
    error:
      isEnabled && dailyAmplitudeQuery.error
        ? resolveErrorMessage(dailyAmplitudeQuery.error)
        : null,
  };
}
