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

describe("EventAnalyticsPage", () => {
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

  it("loads registries then queries stats and samples with canonical params", async () => {
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
        return new Response(
          JSON.stringify({
            items: [
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

    expect(await screen.findByText("Filters")).toBeInTheDocument();

    await waitFor(() => {
      const calledUrls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(
        calledUrls.some((url) =>
          url.includes("/analytics/events/day_up_gt_100/stats?code=TXF&start_date=2026-01-01&end_date=2026-01-31&version=latest&flat_threshold=0"),
        ),
      ).toBe(true);
      expect(
        calledUrls.some((url) =>
          url.includes("/analytics/events/day_up_gt_100/samples?code=TXF&start_date=2026-01-01&end_date=2026-01-31&page=1&page_size=100&sort=-trade_date&flat_threshold=0"),
        ),
      ).toBe(true);
    });

    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).includes("/analytics/events/day_up_gt_100/stats") && init?.signal instanceof AbortSignal,
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).includes("/analytics/events/day_up_gt_100/samples") && init?.signal instanceof AbortSignal,
      ),
    ).toBe(true);
  });

  it("resets sample page to 1 when filters change", async () => {
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
            sample_count: 100,
            up_probability: 0,
            down_probability: 0,
            flat_probability: 0,
            avg_next_day_return: 0,
            avg_next_day_range: 0,
            histogram: { bins: [], counts: [] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/analytics/events/day_up_gt_100/samples")) {
        return new Response(
          JSON.stringify({
            items: [{ trade_date: "2026-01-03", next_day_return: 1, next_day_category: "up" }],
            page: 1,
            page_size: 100,
            total: 200,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ detail: "unmatched_mock" }), { status: 500 });
    });

    renderPage();

    await screen.findByLabelText("Sort");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "MTX" } });

    await waitFor(() => {
      const sampleCalls = fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.includes("/analytics/events/day_up_gt_100/samples"));
      expect(sampleCalls.some((url) => url.includes("page=2"))).toBe(true);
      expect(sampleCalls.some((url) => url.includes("code=MTX") && url.includes("page=1"))).toBe(true);
    });
  });
});
