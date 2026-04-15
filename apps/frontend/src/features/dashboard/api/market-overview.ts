import { ApiError, getJson } from "@/lib/api/client";
import type {
  DailyAmplitudeResponse,
  EstimatedVolumeBaselineResponse,
  KbarTodayResponse,
  MarketSummaryResponse,
  MetricTodayResponse,
  OtcSummaryResponse,
  OrderFlowBaselineResponse,
  QuoteTodayResponse,
} from "@/features/dashboard/api/types";

export const DEFAULT_ORDER_FLOW_CODE = "TXFD6";
export const DEFAULT_OTC_CODE = "OTC001";
const SESSION_OPEN_HOUR = 9;
const SESSION_CLOSE_HOUR = 13;
const SESSION_CLOSE_MINUTE = 45;
const OTC_SESSION_OPEN_HOUR = 8;
const OTC_SESSION_OPEN_MINUTE = 45;
const OTC_SESSION_CLOSE_HOUR = 13;
const OTC_SESSION_CLOSE_MINUTE = 44;

async function resolveOrFallbackOnNotFound<T>(requestPromise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await requestPromise;
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 404) {
      return fallback;
    }
    throw error;
  }
}

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
  const sessionCloseMs = Date.parse(
    `${datePart}T${String(SESSION_CLOSE_HOUR).padStart(2, "0")}:${String(SESSION_CLOSE_MINUTE).padStart(2, "0")}:00+08:00`,
  );

  return { fromMs, toMs: Math.min(tsMs, sessionCloseMs) };
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
  signal?: AbortSignal,
): Promise<EstimatedVolumeBaselineResponse> {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  const { fromMs: todayFromMs, toMs: todayToMs } = resolveTodayRangeMs();
  const { fromMs: yesterdayFromMs, toMs: yesterdayToMs } = resolveYesterdayRangeMs();
  const todayQuery = `code=${encodeURIComponent(code)}&from_ms=${todayFromMs}&to_ms=${todayToMs}`;
  const yesterdayQuery = `code=${encodeURIComponent(code)}&from_ms=${yesterdayFromMs}&to_ms=${yesterdayToMs}`;

  const [marketSummaryToday, marketSummaryYesterday] = await Promise.all([
    resolveOrFallbackOnNotFound(
      getJson<MarketSummaryResponse>(`/v1/market-summary/today?${todayQuery}`, {
        headers,
        signal,
      }),
      [],
    ),
    resolveOrFallbackOnNotFound(
      getJson<MarketSummaryResponse>(`/v1/market-summary/history?${yesterdayQuery}`, {
        headers,
        signal,
      }),
      [],
    ),
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
  signal?: AbortSignal,
): Promise<DailyAmplitudeResponse> {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  const query = `code=${encodeURIComponent(code)}&n=${n}`;
  return getJson<DailyAmplitudeResponse>(`/v1/kbar/1m/daily-amplitude?${query}`, {
    headers,
    signal,
  });
}

export async function getOrderFlowBaseline(
  token: string,
  code: string = DEFAULT_ORDER_FLOW_CODE,
  signal?: AbortSignal,
): Promise<OrderFlowBaselineResponse> {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  const { fromMs, toMs } = resolveTodayRangeMs();
  const query = `code=${encodeURIComponent(code)}&from_ms=${fromMs}&to_ms=${toMs}`;

  const [kbarToday, metricToday] = await Promise.all([
    resolveOrFallbackOnNotFound(
      getJson<KbarTodayResponse>(`/v1/kbar/1m/today?${query}`, {
        headers,
        signal,
      }),
      [],
    ),
    resolveOrFallbackOnNotFound(
      getJson<MetricTodayResponse>(`/v1/metric/bidask/today?${query}`, {
        headers,
        signal,
      }),
      [],
    ),
  ]);

  return {
    kbarToday,
    metricToday,
  };
}

export async function getQuoteToday(
  token: string,
  code: string = DEFAULT_ORDER_FLOW_CODE,
  signal?: AbortSignal,
): Promise<QuoteTodayResponse> {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  const { fromMs, toMs } = resolveTodayRangeMs();
  const query = `code=${encodeURIComponent(code)}&from_ms=${fromMs}&to_ms=${toMs}`;
  return getJson<QuoteTodayResponse>(`/v1/quote/today?${query}`, {
    headers,
    signal,
  });
}

export async function getOtcSummaryToday(
  token: string,
  code: string = DEFAULT_OTC_CODE,
  signal?: AbortSignal,
): Promise<OtcSummaryResponse> {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  const datePart = resolveDatePartInTaipei(Date.now());
  const fromMs = Date.parse(
    `${datePart}T${String(OTC_SESSION_OPEN_HOUR).padStart(2, "0")}:${String(
      OTC_SESSION_OPEN_MINUTE,
    ).padStart(2, "0")}:00+08:00`,
  );
  const toMs = Date.parse(
    `${datePart}T${String(OTC_SESSION_CLOSE_HOUR).padStart(2, "0")}:${String(
      OTC_SESSION_CLOSE_MINUTE,
    ).padStart(2, "0")}:00+08:00`,
  );
  const query = `code=${encodeURIComponent(code)}&from_ms=${fromMs}&to_ms=${toMs}`;
  return getJson<OtcSummaryResponse>(`/v1/otc-summary/today?${query}`, {
    headers,
    signal,
  });
}
