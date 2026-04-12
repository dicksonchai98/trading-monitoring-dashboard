import { useMemo } from "react";
import { DEFAULT_ORDER_FLOW_CODE } from "@/features/dashboard/api/market-overview";
import type { KbarTodayPoint } from "@/features/dashboard/api/types";
import { minuteKeyFromEpochMs } from "@/features/dashboard/lib/market-overview-mapper";
import { useOrderFlowBaseline } from "@/features/dashboard/hooks/use-order-flow-baseline";
import { useKbarCurrent } from "@/features/realtime/hooks/use-kbar-current";

interface UseKbarTimelineResult {
  indexPriceByMinuteTs: Record<number, number>;
  loading: boolean;
  error: string | null;
}

interface KbarTimelineBaselineInput {
  kbarToday: KbarTodayPoint[];
  loading: boolean;
  error: string | null;
  baselineReady: boolean;
}

export function useKbarTimelineFromBaseline(
  baseline: KbarTimelineBaselineInput,
  code: string = DEFAULT_ORDER_FLOW_CODE,
): UseKbarTimelineResult {
  const kbarCurrent = useKbarCurrent(code);

  const indexPriceByMinuteTs = useMemo(() => {
    const nextMap: Record<number, number> = {};

    for (const row of baseline.kbarToday) {
      const minuteTs = minuteKeyFromEpochMs(row.minute_ts);
      nextMap[minuteTs] = row.close;
    }

    if (baseline.baselineReady && kbarCurrent) {
      const realtimeMinuteTs = minuteKeyFromEpochMs(kbarCurrent.minute_ts);
      nextMap[realtimeMinuteTs] = kbarCurrent.close;
    }

    return nextMap;
  }, [baseline.baselineReady, baseline.kbarToday, kbarCurrent]);

  return {
    indexPriceByMinuteTs,
    loading: baseline.loading,
    error: baseline.error,
  };
}

export function useKbarTimeline(
  code: string = DEFAULT_ORDER_FLOW_CODE,
): UseKbarTimelineResult {
  const baseline = useOrderFlowBaseline(code);
  return useKbarTimelineFromBaseline(baseline, code);
}
