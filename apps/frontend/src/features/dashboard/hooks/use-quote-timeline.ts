import { useMemo, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_ORDER_FLOW_CODE } from "@/features/dashboard/api/market-overview";
import { dashboardQuoteTodayQueryOptions } from "@/features/dashboard/lib/dashboard-queries";
import { minuteKeyFromEpochMs } from "@/features/dashboard/lib/market-overview-mapper";
import { useQuoteLatest } from "@/features/realtime/hooks/use-quote-latest";
import { useAuthStore } from "@/lib/store/auth-store";
import { upsertPoint } from "@/features/dashboard/lib/timeline-helpers";

interface QuoteMinuteMaps {
  mainChipByMinute: Record<number, number>;
  longShortForceByMinute: Record<number, number>;
}

interface UseQuoteTimelineResult extends QuoteMinuteMaps {
  loading: boolean;
  error: string | null;
}

interface MinutePoint { minuteTs: number; value: number }

function resolvePointTs(point: {
  ts?: number | string;
  event_ts?: number | string;
}): number | null {
  if (typeof point.ts === "number" && Number.isFinite(point.ts)) {
    return point.ts;
  }
  if (typeof point.ts === "string") {
    const parsed = Date.parse(point.ts);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (typeof point.event_ts === "number" && Number.isFinite(point.event_ts)) {
    return point.event_ts;
  }
  if (typeof point.event_ts === "string") {
    const parsed = Date.parse(point.event_ts);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "quote_today_load_failed";
}

export function useQuoteTimeline(
  code: string = DEFAULT_ORDER_FLOW_CODE,
): UseQuoteTimelineResult {
  const token = useAuthStore((state) => state.token);
  const resolved = useAuthStore((state) => state.resolved);
  const role = useAuthStore((state) => state.role);
  const quoteLatest = useQuoteLatest(code);
  const isEnabled = resolved && Boolean(token) && role !== "visitor";
  const baselineQuery = useQuery({
    ...dashboardQuoteTodayQueryOptions(token ?? "", code),
    enabled: isEnabled,
  });

  const baseMaps = useMemo(() => {
    const mainChipByMinute: Record<number, number> = {};
    const longShortForceByMinute: Record<number, number> = {};

    for (const row of baselineQuery.data ?? []) {
      const ts = resolvePointTs(row);
      if (ts === null) {
        continue;
      }
      const minuteTs = minuteKeyFromEpochMs(ts);
      if (typeof row.main_chip === "number" && Number.isFinite(row.main_chip)) {
        mainChipByMinute[minuteTs] = row.main_chip;
      }
      if (
        typeof row.long_short_force === "number" &&
        Number.isFinite(row.long_short_force)
      ) {
        longShortForceByMinute[minuteTs] = row.long_short_force;
      }
    }

    return { mainChipByMinute, longShortForceByMinute };
  }, [baselineQuery.data]);

  // Build baseline series for internal incremental updates (kept internal for now)
  const baselineMainSeries = useMemo<MinutePoint[]>(() => {
    const entries = Object.keys(baseMaps.mainChipByMinute).map((k) => Number(k));
    entries.sort((a, b) => a - b);
    return entries.map((minute) => ({ minuteTs: minute, value: baseMaps.mainChipByMinute[minute] }));
  }, [baseMaps.mainChipByMinute]);

  const baselineLongSeries = useMemo<MinutePoint[]>(() => {
    const entries = Object.keys(baseMaps.longShortForceByMinute).map((k) => Number(k));
    entries.sort((a, b) => a - b);
    return entries.map((minute) => ({ minuteTs: minute, value: baseMaps.longShortForceByMinute[minute] }));
  }, [baseMaps.longShortForceByMinute]);

  const [mainSeries, setMainSeries] = useState<MinutePoint[]>(baselineMainSeries);
  const [longSeries, setLongSeries] = useState<MinutePoint[]>(baselineLongSeries);
  const mainIndexRef = useRef<Map<number, number>>(new Map());
  const longIndexRef = useRef<Map<number, number>>(new Map());

  // reset baseline when base maps change (e.g., new baseline from server)
  useEffect(() => {
    const m = new Map<number, number>();
    for (let i = 0; i < baselineMainSeries.length; ++i) m.set(baselineMainSeries[i].minuteTs, i);
    mainIndexRef.current = m;
    setMainSeries(baselineMainSeries);

    const l = new Map<number, number>();
    for (let i = 0; i < baselineLongSeries.length; ++i) l.set(baselineLongSeries[i].minuteTs, i);
    longIndexRef.current = l;
    setLongSeries(baselineLongSeries);
  }, [baselineMainSeries, baselineLongSeries]);

  // Apply realtime quoteLatest patches incrementally to internal series
  useEffect(() => {
    const latestTs = resolvePointTs(quoteLatest ?? {});
    if (latestTs === null) return;
    const minuteTs = minuteKeyFromEpochMs(latestTs);

    if (typeof quoteLatest?.main_chip === "number" && Number.isFinite(quoteLatest.main_chip)) {
      const point: MinutePoint = { minuteTs, value: quoteLatest.main_chip };
      const { nextSeries, nextIndexMap, didChange } = upsertPoint(mainSeries, mainIndexRef.current, point as any);
      if (didChange) {
        mainIndexRef.current = nextIndexMap;
        setMainSeries(nextSeries as MinutePoint[]);
      }
    }

    if (typeof quoteLatest?.long_short_force === "number" && Number.isFinite(quoteLatest.long_short_force)) {
      const point: MinutePoint = { minuteTs, value: quoteLatest.long_short_force };
      const { nextSeries, nextIndexMap, didChange } = upsertPoint(longSeries, longIndexRef.current, point as any);
      if (didChange) {
        longIndexRef.current = nextIndexMap;
        setLongSeries(nextSeries as MinutePoint[]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteLatest]);

  // Keep returning the same map-shaped API for compatibility; mergedMaps already avoids unnecessary copies.
  const mergedMaps = useMemo(() => {
    const latestTs = resolvePointTs(quoteLatest ?? {});
    if (latestTs === null) return baseMaps;

    const minuteTs = minuteKeyFromEpochMs(latestTs);
    let changed = false;
    let nextMain = baseMaps.mainChipByMinute;
    let nextLongShort = baseMaps.longShortForceByMinute;

    if (
      typeof quoteLatest?.main_chip === "number" &&
      Number.isFinite(quoteLatest.main_chip)
    ) {
      if (baseMaps.mainChipByMinute[minuteTs] !== quoteLatest.main_chip) {
        nextMain = { ...baseMaps.mainChipByMinute, [minuteTs]: quoteLatest.main_chip };
        changed = true;
      }
    }

    if (
      typeof quoteLatest?.long_short_force === "number" &&
      Number.isFinite(quoteLatest.long_short_force)
    ) {
      if (baseMaps.longShortForceByMinute[minuteTs] !== quoteLatest.long_short_force) {
        nextLongShort = { ...baseMaps.longShortForceByMinute, [minuteTs]: quoteLatest.long_short_force };
        changed = true;
      }
    }

    return changed
      ? { mainChipByMinute: nextMain, longShortForceByMinute: nextLongShort }
      : baseMaps;
  }, [baseMaps.mainChipByMinute, baseMaps.longShortForceByMinute, quoteLatest]);

  return {
    ...mergedMaps,
    loading: !resolved ? true : baselineQuery.isLoading,
    error:
      isEnabled && baselineQuery.error
        ? resolveErrorMessage(baselineQuery.error)
        : null,
  };
}
