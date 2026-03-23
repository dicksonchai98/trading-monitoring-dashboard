import { useEffect } from "react";
import { realtimeManager } from "@/features/realtime/services/realtime-manager";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import { useAuthStore } from "@/lib/store/auth-store";

export function RealtimeBootstrap(): null {
  const token = useAuthStore((state) => state.token);
  const resolved = useAuthStore((state) => state.resolved);
  const role = useAuthStore((state) => state.role);
  const resetRealtime = useRealtimeStore((state) => state.resetRealtime);

  useEffect(() => {
    if (!resolved) {
      return;
    }

    const shouldConnect = Boolean(token) && role !== "visitor";
    if (!shouldConnect || !token) {
      realtimeManager.disconnect();
      resetRealtime();
      return;
    }

    realtimeManager.connect(token);

    return () => {
      realtimeManager.disconnect();
    };
  }, [resolved, resetRealtime, role, token]);

  return null;
}
