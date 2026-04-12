import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EventAnalyticsPage } from "@/features/analytics/pages/EventAnalyticsPage";
import { useAuthStore } from "@/lib/store/auth-store";

function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/analytics/events"]}>
        <EventAnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("EventAnalyticsPage error states", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    useAuthStore.setState({
      token: "token",
      role: "member",
      entitlement: "active",
      resolved: true,
      checkoutSessionId: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows deterministic not-found error state for 404", async () => {
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
        return new Response(JSON.stringify({ detail: "unknown_event_id" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ detail: "unmatched_mock" }), { status: 500 });
    });

    renderPage();

    expect(await screen.findByText("Unknown event/metric ID or no analytics data published.")).toBeInTheDocument();
  });
});
