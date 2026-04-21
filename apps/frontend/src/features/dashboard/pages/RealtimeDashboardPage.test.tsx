import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { RealtimeDashboardPage } from "@/features/dashboard/pages/RealtimeDashboardPage";
import { useSpotMarketDistributionBaseline } from "@/features/dashboard/hooks/use-spot-market-distribution";
import { useAuthStore } from "@/lib/store/auth-store";
import { useDashboardUiStore } from "@/lib/store/dashboard-ui-store";

vi.mock("@/features/dashboard/hooks/use-spot-market-distribution", () => ({
  useSpotMarketDistributionBaseline: vi.fn(() => ({
    loading: false,
    error: null,
  })),
}));

describe("RealtimeDashboardPage", () => {
  const useSpotMarketDistributionBaselineMock = vi.mocked(
    useSpotMarketDistributionBaseline,
  );

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <RealtimeDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    useAuthStore.setState({
      token: "token",
      role: "member",
      entitlement: "none",
      resolved: true,
    });
    useDashboardUiStore.getState().resetStickyBanner();
    useSpotMarketDistributionBaselineMock.mockReturnValue({
      loading: false,
      error: null,
    });
  });

  it("shows skeleton while auth bootstrap is unresolved", () => {
    useAuthStore.setState({
      token: null,
      role: "visitor",
      entitlement: "none",
      resolved: false,
    });

    renderPage();

    expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
  });

  it("renders existing dashboard sections and the new SSE chart section at the bottom", () => {
    renderPage();

    expect(screen.getByText("LIVE METRICS")).toBeInTheDocument();
    expect(screen.getByText("MARKET OVERVIEW")).toBeInTheDocument();
    expect(screen.getByText("PARTICIPANT OVERVIEW")).toBeInTheDocument();

    expect(screen.getByTestId("spot-market-distribution-card")).toBeInTheDocument();
    expect(screen.getByTestId("participant-amplitude-chart")).toBeInTheDocument();
    expect(screen.getAllByTestId("panel-chart").length).toBeGreaterThan(0);
  });

  it("does not render sticky banner for active entitlement users", () => {
    useAuthStore.setState({
      token: "token",
      role: "member",
      entitlement: "active",
      resolved: true,
    });

    renderPage();

    expect(
      screen.queryByText("Unlock Pro insights now - subscribe to Pro."),
    ).not.toBeInTheDocument();
  });

  it("keeps sticky banner dismissed across remounts", () => {
    const { unmount } = renderPage();

    expect(
      screen.getByText("Unlock Pro insights now - subscribe to Pro."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Close sticky banner"));

    expect(
      screen.queryByText("Unlock Pro insights now - subscribe to Pro."),
    ).not.toBeInTheDocument();

    unmount();

    renderPage();

    expect(
      screen.queryByText("Unlock Pro insights now - subscribe to Pro."),
    ).not.toBeInTheDocument();
  });
});
