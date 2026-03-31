import { useRealtimeStore } from "@/features/realtime/store/realtime.store";

export function useRealtimeConnection(): {
  connectionStatus: ReturnType<typeof useRealtimeStore.getState>["connectionStatus"];
  errorReason: string | null;
  lastHeartbeatTs: number | null;
} {
  const connectionStatus = useRealtimeStore((state) => state.connectionStatus);
  const errorReason = useRealtimeStore((state) => state.errorReason);
  const lastHeartbeatTs = useRealtimeStore((state) => state.lastHeartbeatTs);

  return { connectionStatus, errorReason, lastHeartbeatTs };
}
