import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  CheckoutCancelPage,
  CheckoutSuccessPage,
} from "@/features/subscription/pages/CheckoutResultPage";
import { useAuthStore } from "@/lib/store/auth-store";

function renderWithRoutes(path: string): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/subscription/checkout/success" element={<CheckoutSuccessPage />} />
          <Route path="/subscription/checkout/cancel" element={<CheckoutCancelPage />} />
          <Route path="/dashboard" element={<div>Dashboard Home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CheckoutResultPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
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

  it("uses query session_id for success page verification and syncs billing status", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session_id: "cs_test_query_success",
            payment_status: "paid",
            is_paid: true,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "active",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    renderWithRoutes("/subscription/checkout/success?session_id=cs_test_query_success");

    expect(await screen.findByRole("heading", { name: "success" })).toBeInTheDocument();
    expect(await screen.findByText("Payment status: paid")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Session: cs_test_query_success")).toBeInTheDocument(),
    );

    expect(useAuthStore.getState().checkoutSessionId).toBe("cs_test_query_success");
    expect(useAuthStore.getState().entitlement).toBe("active");

    fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));
    expect(screen.getByText("Dashboard Home")).toBeInTheDocument();
  });

  it("uses checkout session id from store on cancel page when query string is absent", async () => {
    useAuthStore.setState({
      checkoutSessionId: "cs_test_store_cancel",
      entitlement: "pending",
    });

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session_id: "cs_test_store_cancel",
            payment_status: "unpaid",
            is_paid: false,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "past_due",
            entitlement_active: false,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    renderWithRoutes("/subscription/checkout/cancel");

    expect(await screen.findByRole("heading", { name: "cancel" })).toBeInTheDocument();
    expect(await screen.findByText("Session: cs_test_store_cancel")).toBeInTheDocument();
    await waitFor(() => expect(useAuthStore.getState().entitlement).toBe("none"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/billing/checkout-session/cs_test_store_cancel"),
        expect.objectContaining({
          method: "GET",
        }),
      ),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/billing/status"),
        expect.objectContaining({
          method: "GET",
        }),
      ),
    );
  });

  it("redirects success route to dashboard when verify result is unpaid", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session_id: "cs_test_query_unpaid",
          payment_status: "unpaid",
          is_paid: false,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    renderWithRoutes("/subscription/checkout/success?session_id=cs_test_query_unpaid");

    await waitFor(() => expect(screen.getByText("Dashboard Home")).toBeInTheDocument());
  });

  it("redirects cancel route to dashboard when verify result is paid", async () => {
    useAuthStore.setState({
      checkoutSessionId: "cs_test_cancel_paid",
    });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session_id: "cs_test_cancel_paid",
          payment_status: "paid",
          is_paid: true,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    renderWithRoutes("/subscription/checkout/cancel");

    await waitFor(() => expect(screen.getByText("Dashboard Home")).toBeInTheDocument());
  });
});
