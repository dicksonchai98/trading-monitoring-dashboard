import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import type { MarketSummaryLatestPayload } from "@/features/realtime/types/realtime.types";

export function useMarketSummaryLatest(code: string): MarketSummaryLatestPayload | null {
  return useRealtimeStore((state) => state.marketSummaryLatestByCode[code] ?? null);
}
