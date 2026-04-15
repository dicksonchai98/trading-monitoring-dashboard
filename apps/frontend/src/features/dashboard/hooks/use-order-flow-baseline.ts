import { useEffect, useState } from "react";
import {
  DEFAULT_ORDER_FLOW_CODE,
  getOrderFlowBaseline,
} from "@/features/dashboard/api/market-overview";
import type {
  KbarTodayPoint,
  MetricTodayPoint,
} from "@/features/dashboard/api/types";
import { useAuthStore } from "@/lib/store/auth-store";

interface UseOrderFlowBaselineResult {
  kbarToday: KbarTodayPoint[];
  metricToday: MetricTodayPoint[];
  loading: boolean;
  error: string | null;
  baselineReady: boolean;
}

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

  const [kbarToday, setKbarToday] = useState<KbarTodayPoint[]>([]);
  const [metricToday, setMetricToday] = useState<MetricTodayPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [baselineReady, setBaselineReady] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setBaselineReady(false);

    if (!resolved) {
      setKbarToday([]);
      setMetricToday([]);
      setLoading(true);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    if (!token || role === "visitor") {
      setKbarToday([]);
      setMetricToday([]);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    setKbarToday([]);
    setMetricToday([]);
    setLoading(true);
    setError(null);

    void getOrderFlowBaseline(token, code, controller.signal)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setKbarToday(result.kbarToday);
        setMetricToday(result.metricToday);
        setBaselineReady(true);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }

        setKbarToday([]);
        setMetricToday([]);
        setError(resolveErrorMessage(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [code, resolved, role, token]);

  return {
    kbarToday,
    metricToday,
    loading,
    error,
    baselineReady,
  };
}

