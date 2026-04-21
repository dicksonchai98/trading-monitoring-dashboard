import type { QueryClient } from "@tanstack/react-query";
import { DEFAULT_ORDER_FLOW_CODE } from "@/features/dashboard/api/market-overview";
import {
  dashboardDailyAmplitudeQueryOptions,
  dashboardEstimatedVolumeBaselineQueryOptions,
  dashboardOrderFlowBaselineQueryOptions,
  dashboardSpotMarketDistributionBaselineQueryOptions,
  dashboardQuoteTodayQueryOptions,
} from "@/features/dashboard/lib/dashboard-queries";
import type { UserRole } from "@/lib/types/auth";

interface DashboardPrefetchInput {
  resolved: boolean;
  token: string | null;
  role: UserRole;
  code?: string;
}

export async function prefetchDashboardRouteData(
  queryClient: QueryClient,
  input: DashboardPrefetchInput,
): Promise<void> {
  if (!input.resolved || !input.token || input.role === "visitor") {
    return;
  }

  const code = input.code ?? DEFAULT_ORDER_FLOW_CODE;

  await Promise.allSettled([
    queryClient.prefetchQuery(
      dashboardOrderFlowBaselineQueryOptions(input.token, code),
    ),
    queryClient.prefetchQuery(dashboardQuoteTodayQueryOptions(input.token, code)),
    queryClient.prefetchQuery(
      dashboardEstimatedVolumeBaselineQueryOptions(input.token, code),
    ),
    queryClient.prefetchQuery(
      dashboardDailyAmplitudeQueryOptions(input.token, code, 19),
    ),
    queryClient.prefetchQuery(
      dashboardSpotMarketDistributionBaselineQueryOptions(input.token),
    ),
  ]);
}
