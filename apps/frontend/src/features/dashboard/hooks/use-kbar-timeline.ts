import { useEffect, useState } from "react";
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
  const [indexPriceByMinuteTs, setIndexPriceByMinuteTs] = useState<
    Record<number, number>
  >({});

  useEffect(() => {
    const nextMap: Record<number, number> = {};
    for (const row of baseline.kbarToday) {
      nextMap[minuteKeyFromEpochMs(row.minute_ts)] = row.close;
    }
    setIndexPriceByMinuteTs(nextMap);
  }, [baseline.kbarToday]);

  useEffect(() => {
    if (!baseline.baselineReady || !kbarCurrent) {
      return;
    }
    const realtimeMinuteTs = minuteKeyFromEpochMs(kbarCurrent.minute_ts);
    setIndexPriceByMinuteTs((current) => {
      if (current[realtimeMinuteTs] === kbarCurrent.close) {
        return current;
      }
      return {
        ...current,
        [realtimeMinuteTs]: kbarCurrent.close,
      };
    });
  }, [baseline.baselineReady, kbarCurrent]);

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
