import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EventAnalyticsPage } from "@/features/analytics/pages/EventAnalyticsPage";
import { GuardedRoute } from "@/lib/guards/GuardedRoute";
import { useAuthStore } from "@/lib/store/auth-store";

function renderWithRoutes(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/analytics/events"]}>
        <Routes>
          <Route
            path="/analytics/events"
            element={
              <GuardedRoute requiredRole="member">
                <EventAnalyticsPage />
              </GuardedRoute>
            }
          />
          <Route path="/login" element={<div>Login</div>} />
          <Route path="/forbidden" element={<div>Forbidden</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("EventAnalyticsPage auth and guard redirects", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("redirects visitor to login via route guard", async () => {
    useAuthStore.setState({
      token: null,
      role: "visitor",
      entitlement: "none",
      resolved: true,
      checkoutSessionId: null,
    });

    renderWithRoutes();

    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("redirects to login when api returns 401", async () => {
    useAuthStore.setState({
      token: "token",
      role: "member",
      entitlement: "active",
      resolved: true,
      checkoutSessionId: null,
    });
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/analytics/events") && !url.includes("/analytics/events/")) {
        return new Response(JSON.stringify({ events: [{ id: "day_up_gt_100", label: "Day Up > 100" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/analytics/metrics")) {
        return new Response(JSON.stringify({ metrics: [{ id: "day_return", label: "Day Return" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/analytics/events/day_up_gt_100/stats") || url.includes("/analytics/events/day_up_gt_100/samples")) {
        return new Response(JSON.stringify({ detail: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ detail: "unmatched_mock" }), { status: 500 });
    });

    renderWithRoutes();

    expect(await screen.findByText("Login")).toBeInTheDocument();
  });

  it("redirects to forbidden page when api returns 403", async () => {
    useAuthStore.setState({
      token: "token",
      role: "member",
      entitlement: "active",
      resolved: true,
      checkoutSessionId: null,
    });
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/analytics/events") && !url.includes("/analytics/events/")) {
        return new Response(JSON.stringify({ events: [{ id: "day_up_gt_100", label: "Day Up > 100" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/analytics/metrics")) {
        return new Response(JSON.stringify({ metrics: [{ id: "day_return", label: "Day Return" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/analytics/events/day_up_gt_100/stats") || url.includes("/analytics/events/day_up_gt_100/samples")) {
        return new Response(JSON.stringify({ detail: "forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ detail: "unmatched_mock" }), { status: 500 });
    });

    renderWithRoutes();

    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
  });
});
