import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_ORDER_FLOW_CODE,
} from "@/features/dashboard/api/market-overview";
import type {
  KbarTodayPoint,
  MetricTodayPoint,
} from "@/features/dashboard/api/types";
import { dashboardOrderFlowBaselineQueryOptions } from "@/features/dashboard/lib/dashboard-queries";
import { useAuthStore } from "@/lib/store/auth-store";

interface UseOrderFlowBaselineResult {
  kbarToday: KbarTodayPoint[];
  metricToday: MetricTodayPoint[];
  loading: boolean;
  error: string | null;
  baselineReady: boolean;
}

const EMPTY_KBAR_TODAY: KbarTodayPoint[] = [];
const EMPTY_METRIC_TODAY: MetricTodayPoint[] = [];

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "order_flow_baseline_load_failed";
}

export function useOrderFlowBaseline(
  code: string = DEFAULT_ORDER_FLOW_CODE,
): UseOrderFlowBaselineResult {
  const token = useAuthStore((state) => state.token);
  const resolved = useAuthStore((state) => state.resolved);
  const role = useAuthStore((state) => state.role);
  const isEnabled = resolved && Boolean(token) && role !== "visitor";
  const query = useQuery({
    ...dashboardOrderFlowBaselineQueryOptions(token ?? "", code),
    enabled: isEnabled,
  });

  return {
    kbarToday:
      (query.data?.kbarToday as KbarTodayPoint[] | undefined) ??
      EMPTY_KBAR_TODAY,
    metricToday:
      (query.data?.metricToday as MetricTodayPoint[] | undefined) ??
      EMPTY_METRIC_TODAY,
    loading: !resolved ? true : query.isLoading,
    error:
      isEnabled && query.error ? resolveErrorMessage(query.error) : null,
    baselineReady: Boolean(query.data),
  };
}

