import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RealtimeDashboardPage } from "@/features/dashboard/pages/RealtimeDashboardPage";
import { useAuthStore } from "@/lib/store/auth-store";
import { useDashboardUiStore } from "@/lib/store/dashboard-ui-store";

describe("RealtimeDashboardPage", () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: "token",
      role: "member",
      entitlement: "none",
      resolved: true,
    });
    useDashboardUiStore.getState().resetStickyBanner();
  });

  it("shows skeleton while auth bootstrap is unresolved", () => {
    useAuthStore.setState({
      token: null,
      role: "visitor",
      entitlement: "none",
      resolved: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <RealtimeDashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
  });

  it("renders existing dashboard sections and the new SSE chart section at the bottom", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <RealtimeDashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("LIVE METRICS")).toBeInTheDocument();
    expect(screen.getByText("MARKET OVERVIEW")).toBeInTheDocument();
    expect(screen.getByText("PARTICIPANT OVERVIEW")).toBeInTheDocument();

    expect(screen.getByTestId("sse-close-trend-panel")).toBeInTheDocument();
    expect(screen.getByTestId("sse-spread-panel")).toBeInTheDocument();
    expect(screen.getByTestId("sse-depth-panel")).toBeInTheDocument();
    expect(screen.getAllByTestId("sse-panel-skeleton").length).toBeGreaterThan(
      0,
    );
  });

  it("does not render sticky banner for active entitlement users", () => {
    useAuthStore.setState({
      token: "token",
      role: "member",
      entitlement: "active",
      resolved: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <RealtimeDashboardPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByText("Unlock Pro insights now - subscribe to Pro."),
    ).not.toBeInTheDocument();
  });

  it("keeps sticky banner dismissed across remounts", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <RealtimeDashboardPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Unlock Pro insights now - subscribe to Pro."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Close sticky banner"));

    expect(
      screen.queryByText("Unlock Pro insights now - subscribe to Pro."),
    ).not.toBeInTheDocument();

    unmount();

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <RealtimeDashboardPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByText("Unlock Pro insights now - subscribe to Pro."),
    ).not.toBeInTheDocument();
  });
});
