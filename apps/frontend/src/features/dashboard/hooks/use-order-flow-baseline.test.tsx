import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { useOrderFlowBaseline } from "@/features/dashboard/hooks/use-order-flow-baseline";
import { useAuthStore } from "@/lib/store/auth-store";

describe("useOrderFlowBaseline", () => {
  function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    };
  }

  beforeEach(() => {
    act(() => {
      useAuthStore.setState({
        token: null,
        role: "visitor",
        entitlement: "none",
        resolved: true,
        checkoutSessionId: null,
      });
    });
  });

  afterEach(() => {
    act(() => {
      useAuthStore.setState({
        token: null,
        role: "visitor",
        entitlement: "none",
        resolved: false,
        checkoutSessionId: null,
      });
    });
  });

  it("keeps empty baseline arrays stable across rerenders when queries are disabled", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result, rerender } = renderHook(() => useOrderFlowBaseline(), {
      wrapper: createWrapper(queryClient),
    });

    const firstKbarToday = result.current.kbarToday;
    const firstMetricToday = result.current.metricToday;

    rerender();

    expect(result.current.kbarToday).toBe(firstKbarToday);
    expect(result.current.metricToday).toBe(firstMetricToday);
  });
});
