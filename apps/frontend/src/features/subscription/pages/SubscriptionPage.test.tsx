import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SubscriptionPage } from "@/features/subscription/pages/SubscriptionPage";
import { useAuthStore } from "@/lib/store/auth-store";

function renderSubscriptionPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/subscription"]}>
        <SubscriptionPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function plansFixture(): { plans: Array<{ id: string; name: string; price: string }> } {
  return {
    plans: [
      { id: "free", name: "Free", price: "free" },
      { id: "basic", name: "Basic", price: "mock" },
    ],
  };
}

describe("SubscriptionPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    useAuthStore.setState({
      token: "token",
      role: "member",
      entitlement: "none",
      resolved: true,
      checkoutSessionId: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows skeleton while bootstrap/query is loading", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));

    renderSubscriptionPage();

    expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
  });

  it("uses the shared page layout header and bento grid content layout", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(plansFixture()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "none" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    renderSubscriptionPage();

    expect(await screen.findByRole("heading", { name: "Subscription" })).toBeInTheDocument();
    expect(screen.getByText("/subscription")).toBeInTheDocument();
    expect(screen.getByTestId("page-layout")).toBeInTheDocument();
    expect(screen.getByText("PLAN OPTIONS")).toBeInTheDocument();
    expect(screen.getAllByTestId("bento-grid")).toHaveLength(1);
    expect(await screen.findByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Checkout" })).toBeInTheDocument();
  });

  it("loads billing plans and status, then refreshes status after checkout", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(plansFixture()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "none" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            checkout_url: "https://example.com/checkout/session-123",
            session_id: "session-123",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "active" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    renderSubscriptionPage();

    expect(await screen.findAllByText("Entitlement: none")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Start Checkout" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(useAuthStore.getState().checkoutSessionId).toBe("session-123");
    expect(useAuthStore.getState().entitlement).toBe("active");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/billing/plans"),
      expect.objectContaining({
        credentials: "include",
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/billing/status"),
      expect.objectContaining({
        credentials: "include",
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("/billing/checkout"),
      expect.objectContaining({
        credentials: "include",
        method: "POST",
      }),
    );
  });

  it("stretches the plan cards to fill the visible content area without relying on oversized fixed heights", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(plansFixture()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "none" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    renderSubscriptionPage();

    const checkoutButton = await screen.findByRole("button", { name: "Start Checkout" });

    const layoutBody = screen.getByTestId("page-layout-body");
    const grids = screen.getAllByTestId("bento-grid");

    expect(screen.getByTestId("page-layout")).toHaveClass(
      "flex",
      "min-h-[calc(100dvh-(var(--shell-padding)*2))]",
      "flex-col",
    );
    expect(layoutBody).toHaveClass("flex", "flex-1", "flex-col");
    expect(grids[0]).toHaveClass("h-full", "flex-1", "auto-rows-fr");
    expect(checkoutButton.closest("section")).toHaveClass("h-full");
    expect(checkoutButton).toHaveClass("mt-auto");
  });

  it("disables paid checkout and labels current plan when user already has active subscription", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(plansFixture()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "active" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    renderSubscriptionPage();

    const currentPlanButtons = await screen.findAllByRole("button", { name: "Current plan" });
    expect(currentPlanButtons[0]).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Start Checkout" })).not.toBeInTheDocument();
  });
});
