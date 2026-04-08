import { getJson } from "@/lib/api/client";
import type {
  KbarTodayResponse,
  MetricTodayResponse,
  OrderFlowBaselineResponse,
} from "@/features/dashboard/api/types";

export const DEFAULT_ORDER_FLOW_CODE = "TXF";

export async function getOrderFlowBaseline(
  token: string,
  code: string = DEFAULT_ORDER_FLOW_CODE,
): Promise<OrderFlowBaselineResponse> {
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const [kbarToday, metricToday] = await Promise.all([
    getJson<KbarTodayResponse>(`/v1/kbar/1m/today?code=${encodeURIComponent(code)}`, {
      headers,
    }),
    getJson<MetricTodayResponse>(`/v1/metric/bidask/today?code=${encodeURIComponent(code)}`, {
      headers,
    }),
  ]);

  return {
    kbarToday,
    metricToday,
  };
}
