import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EventAnalyticsPage } from "@/features/analytics/pages/EventAnalyticsPage";
import { useAuthStore } from "@/lib/store/auth-store";

function renderPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/analytics/events"]}>
        <EventAnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("EventAnalyticsPage sort and pagination", () => {
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

  it("requests event samples using selected sort parameter", async () => {
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
      if (url.includes("/analytics/events/day_up_gt_100/stats")) {
        return new Response(
          JSON.stringify({
            event_id: "day_up_gt_100",
            sample_count: 2,
            up_probability: 0.5,
            down_probability: 0.5,
            flat_probability: 0,
            avg_next_day_return: 12,
            avg_next_day_range: 88,
            histogram: { bins: ["-20~0", "0~20"], counts: [1, 1] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/analytics/events/day_up_gt_100/samples")) {
        const asc = url.includes("sort=trade_date");
        return new Response(
          JSON.stringify({
            items: asc
              ? [
                  { trade_date: "2026-01-04", next_day_return: -2, next_day_category: "down" },
                  { trade_date: "2026-01-03", next_day_return: 10, next_day_category: "up" },
                ]
              : [
                  { trade_date: "2026-01-03", next_day_return: 10, next_day_category: "up" },
                  { trade_date: "2026-01-04", next_day_return: -2, next_day_category: "down" },
                ],
            page: 1,
            page_size: 100,
            total: 2,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ detail: "unmatched_mock" }), { status: 500 });
    });

    renderPage();

    await screen.findByLabelText("Sort");
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "trade_date" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining("sort=trade_date"),
        expect.anything(),
      );
    });
  });
});
