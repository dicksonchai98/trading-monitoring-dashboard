import { queryOptions } from "@tanstack/react-query";
import {
  DEFAULT_ORDER_FLOW_CODE,
  getDailyAmplitudeHistory,
  getEstimatedVolumeBaseline,
  getOrderFlowBaseline,
  getSpotMarketDistributionBaseline,
  getQuoteToday,
} from "@/features/dashboard/api/market-overview";
import {
  buildDashboardDailyAmplitudeQueryKey,
  buildDashboardEstimatedVolumeBaselineQueryKey,
  buildDashboardOrderFlowBaselineQueryKey,
  buildDashboardQuoteTodayQueryKey,
  buildDashboardSpotMarketDistributionBaselineQueryKey,
} from "@/features/dashboard/lib/query-keys";

export function dashboardOrderFlowBaselineQueryOptions(
  token: string,
  code: string = DEFAULT_ORDER_FLOW_CODE,
) {
  return queryOptions({
    queryKey: buildDashboardOrderFlowBaselineQueryKey(code),
    queryFn: ({ signal }) => getOrderFlowBaseline(token, code, signal),
  });
}

export function dashboardQuoteTodayQueryOptions(
  token: string,
  code: string = DEFAULT_ORDER_FLOW_CODE,
) {
  return queryOptions({
    queryKey: buildDashboardQuoteTodayQueryKey(code),
    queryFn: ({ signal }) => getQuoteToday(token, code, signal),
  });
}

export function dashboardEstimatedVolumeBaselineQueryOptions(
  token: string,
  code: string = DEFAULT_ORDER_FLOW_CODE,
) {
  return queryOptions({
    queryKey: buildDashboardEstimatedVolumeBaselineQueryKey(code),
    queryFn: ({ signal }) => getEstimatedVolumeBaseline(token, code, signal),
  });
}

export function dashboardDailyAmplitudeQueryOptions(
  token: string,
  code: string = DEFAULT_ORDER_FLOW_CODE,
  historyLength: number = 19,
) {
  return queryOptions({
    queryKey: buildDashboardDailyAmplitudeQueryKey(code, historyLength),
    queryFn: ({ signal }) =>
      getDailyAmplitudeHistory(token, code, historyLength, signal),
  });
}

export function dashboardSpotMarketDistributionBaselineQueryOptions(token: string) {
  return queryOptions({
    queryKey: buildDashboardSpotMarketDistributionBaselineQueryKey(),
    queryFn: ({ signal }) => getSpotMarketDistributionBaseline(token, signal),
  });
}
