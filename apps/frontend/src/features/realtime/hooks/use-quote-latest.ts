import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import type { QuoteLatestPayload } from "@/features/realtime/types/realtime.types";

export function useQuoteLatest(code: string): QuoteLatestPayload | null {
  return useRealtimeStore((state) => state.quoteLatestByCode[code] ?? null);
}
