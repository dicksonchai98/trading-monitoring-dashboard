import { getJson } from "@/lib/api/client";
import type {
  DailyAmplitudeResponse,
  EstimatedVolumeBaselineResponse,
  KbarTodayResponse,
  MarketSummaryResponse,
  MetricTodayResponse,
  OrderFlowBaselineResponse,
} from "@/features/dashboard/api/types";

export const DEFAULT_ORDER_FLOW_CODE = "TXFD6";
const SESSION_OPEN_HOUR = 9;

function resolveDatePartInTaipei(tsMs: number): string {
  const now = new Date(tsMs);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function resolveSessionRangeMs(tsMs: number): { fromMs: number; toMs: number } {
  const datePart = resolveDatePartInTaipei(tsMs);
  const fromMs = Date.parse(
    `${datePart}T${String(SESSION_OPEN_HOUR).padStart(2, "0")}:00:00+08:00`,
  );

  return { fromMs, toMs: tsMs };
}

function resolveTodayRangeMs(): { fromMs: number; toMs: number } {
  return resolveSessionRangeMs(Date.now());
}

function resolveYesterdayRangeMs(): { fromMs: number; toMs: number } {
  const nowMs = Date.now();
  const yesterdayMs = nowMs - 24 * 60 * 60 * 1000;
  const todayRange = resolveSessionRangeMs(nowMs);
  const yesterdayRange = resolveSessionRangeMs(yesterdayMs);
  const elapsedMs = Math.max(0, todayRange.toMs - todayRange.fromMs);
  const yesterdayToMs = Math.min(yesterdayRange.fromMs + elapsedMs, yesterdayRange.toMs);

  return {
    fromMs: yesterdayRange.fromMs,
    toMs: yesterdayToMs,
  };
}

export async function getEstimatedVolumeBaseline(
  token: string,
  code: string = DEFAULT_ORDER_FLOW_CODE,
): Promise<EstimatedVolumeBaselineResponse> {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  const { fromMs: todayFromMs, toMs: todayToMs } = resolveTodayRangeMs();
  const { fromMs: yesterdayFromMs, toMs: yesterdayToMs } = resolveYesterdayRangeMs();
  const todayQuery = `code=${encodeURIComponent(code)}&from_ms=${todayFromMs}&to_ms=${todayToMs}`;
  const yesterdayQuery = `code=${encodeURIComponent(code)}&from_ms=${yesterdayFromMs}&to_ms=${yesterdayToMs}`;

  const [marketSummaryToday, marketSummaryYesterday] = await Promise.all([
    getJson<MarketSummaryResponse>(`/v1/market-summary/today?${todayQuery}`, {
      headers,
    }),
    getJson<MarketSummaryResponse>(`/v1/market-summary/history?${yesterdayQuery}`, {
      headers,
    }),
  ]);

  return {
    marketSummaryToday,
    marketSummaryYesterday,
  };
}

export async function getDailyAmplitudeHistory(
  token: string,
  code: string = DEFAULT_ORDER_FLOW_CODE,
  n: number = 19,
): Promise<DailyAmplitudeResponse> {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  const query = `code=${encodeURIComponent(code)}&n=${n}`;
  return getJson<DailyAmplitudeResponse>(`/v1/kbar/1m/daily-amplitude?${query}`, {
    headers,
  });
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
