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

describe("SubscriptionPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    useAuthStore.setState({
      token: "token",
      role: "member",
      entitlement: "none",
      resolved: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uses the shared page layout header and bento grid content layout", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ plans: [{ id: "basic", name: "Basic", price: "mock" }] }), {
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

    expect(screen.getByRole("heading", { name: "Subscription (Mock)" })).toBeInTheDocument();
    expect(screen.getByText("/subscription")).toBeInTheDocument();
    expect(screen.getByTestId("page-layout")).toBeInTheDocument();
    expect(screen.getByText("PLAN OPTIONS")).toBeInTheDocument();
    expect(screen.getAllByTestId("bento-grid")).toHaveLength(1);
    expect(await screen.findByText("Basic")).toBeInTheDocument();
  });

  it("loads billing plans and status, then refreshes status after checkout", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ plans: [{ id: "basic", name: "Basic", price: "mock" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "active" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "checkout_started" }), {
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

    expect(await screen.findByText("Entitlement: active")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start Checkout" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(await screen.findByText("Checkout: checkout_started")).toBeInTheDocument();
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
        new Response(JSON.stringify({ plans: [{ id: "basic", name: "Basic", price: "mock" }] }), {
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

    const checkoutButton = await screen.findByRole("button", { name: "Start Checkout" });

    const layoutBody = screen.getByTestId("page-layout-body");
    const grids = screen.getAllByTestId("bento-grid");

    expect(screen.getByTestId("page-layout")).toHaveClass("flex", "min-h-[calc(100dvh-(var(--shell-padding)*2))]", "flex-col");
    expect(layoutBody).toHaveClass("flex", "flex-1", "flex-col");
    expect(grids[0]).toHaveClass("h-full", "flex-1", "auto-rows-fr");
    expect(checkoutButton.closest("section")).toHaveClass("h-full");
    expect(checkoutButton).toHaveClass("mt-auto");
  });
});
