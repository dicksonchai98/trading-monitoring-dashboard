import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardSpotMarketDistributionBaselineQueryOptions } from "@/features/dashboard/lib/dashboard-queries";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import { useAuthStore } from "@/lib/store/auth-store";

interface UseSpotMarketDistributionResult {
  loading: boolean;
  error: string | null;
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "spot_market_distribution_load_failed";
}

export function useSpotMarketDistributionBaseline(): UseSpotMarketDistributionResult {
  const token = useAuthStore((state) => state.token);
  const resolved = useAuthStore((state) => state.resolved);
  const role = useAuthStore((state) => state.role);
  const isEnabled = resolved && Boolean(token) && role !== "visitor";
  const query = useQuery({
    ...dashboardSpotMarketDistributionBaselineQueryOptions(token ?? ""),
    enabled: isEnabled,
  });

  useEffect(() => {
    if (!query.data) {
      return;
    }

    useRealtimeStore.getState().applySseBatch({
      spotMarketDistributionLatest: query.data.latest ?? undefined,
      spotMarketDistributionSeries:
        query.data.today.length > 0 ? { items: query.data.today } : undefined,
    });
  }, [query.data]);

  return {
    loading: !resolved ? true : query.isLoading,
    error:
      isEnabled && query.error ? resolveErrorMessage(query.error) : null,
  };
}
