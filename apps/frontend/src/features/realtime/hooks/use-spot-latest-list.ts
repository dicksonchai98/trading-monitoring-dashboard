import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import type { SpotLatestListPayload } from "@/features/realtime/types/realtime.types";

export function useSpotLatestList(): SpotLatestListPayload | null {
  return useRealtimeStore((state) => state.spotLatestList);
}
