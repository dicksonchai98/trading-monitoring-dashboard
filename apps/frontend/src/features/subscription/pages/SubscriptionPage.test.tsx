import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
        <Routes>
          <Route path="/subscription" element={<SubscriptionPage />} />
          <Route path="/login" element={<h1>Login Page</h1>} />
        </Routes>
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

  it("shows the standalone pricing page content", async () => {
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

    expect(await screen.findByRole("heading", { name: "Pricing" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Use for free with your whole team. Upgrade to enable unlimited issues, enhanced security controls, and additional features.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Pro Plan")).toBeInTheDocument();
    expect(screen.getAllByText("Free").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Get started" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Contact sales" })).not.toBeInTheDocument();
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

    const actionButtons = await screen.findAllByRole("button", { name: "Get started" });
    fireEvent.click(actionButtons[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(useAuthStore.getState().checkoutSessionId).toBe("session-123");
    expect(useAuthStore.getState().entitlement).toBe("active");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/billing/plans"),
      expect.objectContaining({
        credentials: "include",
        method: "GET",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/billing/status"),
      expect.objectContaining({
        credentials: "include",
        method: "GET",
        signal: expect.any(AbortSignal),
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

  it("renders pricing cards in a simple shadcn layout", async () => {
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

    const checkoutButton = await screen.findAllByRole("button", { name: "Get started" });
    expect(screen.getByRole("main")).toHaveClass("min-h-screen");
    expect(checkoutButton[0]).toHaveClass("mt-auto", "w-fit");
    expect(screen.getByTestId("pricing-page")).toBeInTheDocument();
  });

  it("redirects unauthenticated users to login when clicking get started", async () => {
    useAuthStore.setState({
      token: null,
      role: undefined,
      entitlement: "none",
      resolved: true,
      checkoutSessionId: null,
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(plansFixture()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderSubscriptionPage();

    const button = await screen.findByRole("button", { name: "Get started" });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    expect(await screen.findByRole("heading", { name: "Login Page" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
  });
});
