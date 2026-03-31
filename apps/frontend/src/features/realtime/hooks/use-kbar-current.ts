import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import type { KbarCurrentPayload } from "@/features/realtime/types/realtime.types";

export function useKbarCurrent(code: string): KbarCurrentPayload | null {
  return useRealtimeStore((state) => state.kbarCurrentByCode[code] ?? null);
}
