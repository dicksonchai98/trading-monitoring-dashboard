import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchDashboardRouteData } from "@/features/dashboard/lib/dashboard-route-prefetch";
import { useAuthStore } from "@/lib/store/auth-store";

export function DashboardPrefetchBootstrap(): null {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const resolved = useAuthStore((state) => state.resolved);

  useEffect(() => {
    if (!resolved || !token || role === "visitor") {
      return;
    }

    void prefetchDashboardRouteData(queryClient, {
      resolved,
      token,
      role,
    });
  }, [queryClient, resolved, role, token]);

  return null;
}
