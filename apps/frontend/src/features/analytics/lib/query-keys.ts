interface EventStatsKeyParams {
  eventId: string;
  code: string;
  startDate: string;
  endDate: string;
  version: string;
  flatThreshold: number;
}

interface EventSamplesKeyParams {
  eventId: string;
  code: string;
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
  sort: string;
  flatThreshold: number;
}

interface DistributionKeyParams {
  metricId: string;
  code: string;
  startDate: string;
  endDate: string;
  version: string;
}

export const analyticsEventsRegistryQueryKey = ["analytics-events-registry"] as const;
export const analyticsMetricsRegistryQueryKey = ["analytics-metrics-registry"] as const;

export function buildEventStatsQueryKey(params: EventStatsKeyParams): readonly [string, EventStatsKeyParams] {
  return ["analytics-event-stats", params] as const;
}

export function buildEventSamplesQueryKey(
  params: EventSamplesKeyParams,
): readonly [string, EventSamplesKeyParams] {
  return ["analytics-event-samples", params] as const;
}

export function buildDistributionQueryKey(
  params: DistributionKeyParams,
): readonly [string, DistributionKeyParams] {
  return ["analytics-distribution", params] as const;
}
