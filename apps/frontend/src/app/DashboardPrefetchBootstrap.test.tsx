import type { ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardPrefetchBootstrap } from "@/app/DashboardPrefetchBootstrap";
import { prefetchDashboardRouteData } from "@/features/dashboard/lib/dashboard-route-prefetch";
import { useAuthStore } from "@/lib/store/auth-store";

vi.mock("@/features/dashboard/lib/dashboard-route-prefetch", () => ({
  prefetchDashboardRouteData: vi.fn(),
}));

describe("DashboardPrefetchBootstrap", () => {
  function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: null,
      role: "visitor",
      entitlement: "none",
      resolved: false,
      checkoutSessionId: null,
    });
  });

  it("warms dashboard data after auth resolves for a member session", async () => {
    const queryClient = new QueryClient();
    const prefetchMock = vi.mocked(prefetchDashboardRouteData);

    useAuthStore.setState({
      token: "token",
      role: "member",
      entitlement: "active",
      resolved: true,
      checkoutSessionId: null,
    });

    render(<DashboardPrefetchBootstrap />, {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() =>
      expect(prefetchMock).toHaveBeenCalledWith(
        queryClient,
        expect.objectContaining({
          resolved: true,
          token: "token",
          role: "member",
        }),
      ),
    );
  });

  it("does not warm dashboard data for a visitor session", async () => {
    const queryClient = new QueryClient();
    const prefetchMock = vi.mocked(prefetchDashboardRouteData);

    useAuthStore.setState({
      token: null,
      role: "visitor",
      entitlement: "none",
      resolved: true,
      checkoutSessionId: null,
    });

    render(<DashboardPrefetchBootstrap />, {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(prefetchMock).not.toHaveBeenCalled();
    });
  });
});
