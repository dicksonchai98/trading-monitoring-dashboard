import { useRealtimeStore } from "@/features/realtime/store/realtime.store";

export function useRealtimeConnection(): {
  connectionStatus: ReturnType<typeof useRealtimeStore.getState>["connectionStatus"];
  errorReason: string | null;
  lastHeartbeatTs: number | null;
} {
  const connectionStatus = useRealtimeStore((state) => state.connectionStatus);
  const errorReason = useRealtimeStore((state) => state.errorReason);
  // Avoid subscribing high-level UI to heartbeat ticks unless explicitly needed.
  const lastHeartbeatTs = useRealtimeStore.getState().lastHeartbeatTs;

  return { connectionStatus, errorReason, lastHeartbeatTs };
}
