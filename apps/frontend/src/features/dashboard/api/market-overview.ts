import { getJson } from "@/lib/api/client";
import type {
  KbarTodayResponse,
  MetricTodayResponse,
  OrderFlowBaselineResponse,
} from "@/features/dashboard/api/types";

export const DEFAULT_ORDER_FLOW_CODE = "TXF";
const SESSION_OPEN_HOUR = 9;

function resolveTodayRangeMs(): { fromMs: number; toMs: number } {
  const nowMs = Date.now();
  const now = new Date(nowMs);
  const datePart = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const fromMs = Date.parse(`${datePart}T${String(SESSION_OPEN_HOUR).padStart(2, "0")}:00:00+08:00`);
  const toMs = nowMs;

  return { fromMs, toMs };
}

export async function getOrderFlowBaseline(
  token: string,
  code: string = DEFAULT_ORDER_FLOW_CODE,
): Promise<OrderFlowBaselineResponse> {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  const { fromMs, toMs } = resolveTodayRangeMs();
  const query = `code=${encodeURIComponent(code)}&from_ms=${fromMs}&to_ms=${toMs}`;

  const [kbarToday, metricToday] = await Promise.all([
    getJson<KbarTodayResponse>(`/v1/kbar/1m/today?${query}`, {
      headers,
    }),
    getJson<MetricTodayResponse>(`/v1/metric/bidask/today?${query}`, {
      headers,
    }),
  ]);

  return {
    kbarToday,
    metricToday,
  };
}
