import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import type { MetricLatestPayload } from "@/features/realtime/types/realtime.types";

export function useMetricLatest(code: string): MetricLatestPayload | null {
  return useRealtimeStore((state) => state.metricLatestByCode[code] ?? null);
}
