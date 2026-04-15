import { QueryClient } from "@tanstack/react-query";
import { prefetchDashboardRouteData } from "@/features/dashboard/lib/dashboard-route-prefetch";

describe("prefetchDashboardRouteData", () => {
  it("prefetches all dashboard baseline queries for a resolved member session", async () => {
    const queryClient = new QueryClient();
    const prefetchQuery = vi
      .spyOn(queryClient, "prefetchQuery")
      .mockResolvedValue(undefined);

    await prefetchDashboardRouteData(queryClient, {
      resolved: true,
      token: "token",
      role: "member",
      code: "TXFD6",
    });

    expect(prefetchQuery).toHaveBeenCalledTimes(4);
  });

  it("skips dashboard baseline prefetch for visitor sessions", async () => {
    const queryClient = new QueryClient();
    const prefetchQuery = vi
      .spyOn(queryClient, "prefetchQuery")
      .mockResolvedValue(undefined);

    await prefetchDashboardRouteData(queryClient, {
      resolved: true,
      token: null,
      role: "visitor",
      code: "TXFD6",
    });

    expect(prefetchQuery).not.toHaveBeenCalled();
  });
});
