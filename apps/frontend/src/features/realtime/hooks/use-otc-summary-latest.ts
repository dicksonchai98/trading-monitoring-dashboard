import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import type { OtcSummaryLatestPayload } from "@/features/realtime/types/realtime.types";

export function useOtcSummaryLatest(code: string): OtcSummaryLatestPayload | null {
  return useRealtimeStore((state) => state.otcSummaryLatestByCode[code] ?? null);
}
