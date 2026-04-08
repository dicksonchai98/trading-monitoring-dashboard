import { getJson } from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import type { ZodType } from "zod";
import {
  AnalyticsEventsRegistryResponseSchema,
  AnalyticsMetricsRegistryResponseSchema,
  DistributionStatsResponseSchema,
  EventSamplesResponseSchema,
  EventStatsResponseSchema,
} from "@/features/analytics/api/schemas";
import type {
  AnalyticsEventsRegistryResponse,
  AnalyticsMetricsRegistryResponse,
  DistributionStatsResponse,
  EventSamplesResponse,
  EventStatsResponse,
} from "@/features/analytics/api/types";

interface BaseWindowParams {
  code: string;
  startDate: string;
  endDate: string;
  version?: string;
}

interface EventStatsParams extends BaseWindowParams {
  eventId: string;
  flatThreshold: number;
}

interface EventSamplesParams extends EventStatsParams {
  page: number;
  pageSize: number;
  sort: string;
}

interface DistributionParams extends BaseWindowParams {
  metricId: string;
}

function authHeaders(token: string | null): HeadersInit {
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    query.set(key, String(value));
  });
  return query.toString();
}

function parseOrThrow<T>(schema: ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError("analytics_invalid_response", 500);
  }
  return parsed.data;
}

function normalizeRegistryPayload(payload: unknown, key: "events" | "metrics"): unknown {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  if (Array.isArray(record[key])) {
    return payload;
  }
  if (Array.isArray(record.items)) {
    return { [key]: record.items };
  }
  return payload;
}

function normalizeAnalyticsError(error: unknown): never {
  if (error instanceof ApiError) {
    throw error;
  }
  throw new ApiError("analytics_request_failed", 500);
}

export function getAnalyticsEvents(token: string | null): Promise<AnalyticsEventsRegistryResponse> {
  return getJson<unknown>("/analytics/events", { headers: authHeaders(token) })
    .then((payload) =>
      parseOrThrow(AnalyticsEventsRegistryResponseSchema, normalizeRegistryPayload(payload, "events")),
    )
    .catch(normalizeAnalyticsError);
}

export function getAnalyticsMetrics(token: string | null): Promise<AnalyticsMetricsRegistryResponse> {
  return getJson<unknown>("/analytics/metrics", { headers: authHeaders(token) })
    .then((payload) =>
      parseOrThrow(AnalyticsMetricsRegistryResponseSchema, normalizeRegistryPayload(payload, "metrics")),
    )
    .catch(normalizeAnalyticsError);
}

export function getEventStats(
  token: string | null,
  { eventId, code, startDate, endDate, version = "latest", flatThreshold }: EventStatsParams,
): Promise<EventStatsResponse> {
  const query = buildQuery({
    code,
    start_date: startDate,
    end_date: endDate,
    version,
    flat_threshold: flatThreshold,
  });

  return getJson<unknown>(`/analytics/events/${encodeURIComponent(eventId)}/stats?${query}`, {
    headers: authHeaders(token),
  })
    .then((payload) => parseOrThrow(EventStatsResponseSchema, payload))
    .catch(normalizeAnalyticsError);
}

export function getEventSamples(
  token: string | null,
  { eventId, code, startDate, endDate, page, pageSize, sort, flatThreshold }: EventSamplesParams,
): Promise<EventSamplesResponse> {
  const query = buildQuery({
    code,
    start_date: startDate,
    end_date: endDate,
    page,
    page_size: pageSize,
    sort,
    flat_threshold: flatThreshold,
  });

  return getJson<unknown>(
    `/analytics/events/${encodeURIComponent(eventId)}/samples?${query}`,
    {
      headers: authHeaders(token),
    },
  )
    .then((payload) => parseOrThrow(EventSamplesResponseSchema, payload))
    .catch(normalizeAnalyticsError);
}

export function getDistributionStats(
  token: string | null,
  { metricId, code, startDate, endDate, version = "latest" }: DistributionParams,
): Promise<DistributionStatsResponse> {
  const query = buildQuery({
    code,
    start_date: startDate,
    end_date: endDate,
    version,
  });

  return getJson<unknown>(`/analytics/distributions/${encodeURIComponent(metricId)}?${query}`, {
    headers: authHeaders(token),
  })
    .then((payload) => parseOrThrow(DistributionStatsResponseSchema, payload))
    .catch(normalizeAnalyticsError);
}
