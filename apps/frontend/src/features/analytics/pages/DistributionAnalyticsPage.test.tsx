import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DistributionAnalyticsPage } from "@/features/analytics/pages/DistributionAnalyticsPage";
import { useAuthStore } from "@/lib/store/auth-store";

function renderPage(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/analytics/distributions"]}>
        <DistributionAnalyticsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DistributionAnalyticsPage", () => {
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

  it("loads metrics registry and queries distribution endpoint with canonical params", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ metrics: [{ id: "day_return", label: "Day Return", formula: "close-open" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            metric_id: "day_return",
            sample_count: 3,
            mean: 1.2,
            median: 0.9,
            min: -3,
            max: 5,
            p75: 2,
            p90: 4,
            p95: 4.5,
            histogram_json: { bins: ["-5~0", "0~5"], counts: [1, 2] },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    renderPage();

    expect(await screen.findByText("Filters")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/analytics/distributions/day_return?code=TXF&start_date=2026-01-01&end_date=2026-01-31&version=latest"),
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );

    expect(screen.getByText("Sample Count: 3")).toBeInTheDocument();
    expect(screen.getByText("-5~0: 1")).toBeInTheDocument();
    expect(screen.getByText("Formula: close-open")).toBeInTheDocument();
  });
});
