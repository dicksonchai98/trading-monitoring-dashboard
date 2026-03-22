import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { useAuthStore } from "@/lib/store/auth-store";

function b64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function makeToken(role: "user" | "admin" = "user"): string {
  return [
    b64url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    b64url(JSON.stringify({ sub: "alice", role, exp: 9_999_999_999, type: "access" })),
    "signature",
  ].join(".");
}

function renderLoginPage(initialState?: unknown): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: "/login", state: initialState }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
          <Route path="/subscription" element={<div>Subscription</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function submitButton(label: RegExp): HTMLElement {
  const matches = screen.getAllByRole("button", { name: label });
  const submit = matches.find((button) => button.getAttribute("type") === "submit");
  return (submit ?? matches[0]) as HTMLElement;
}

describe("LoginPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    useAuthStore.setState({ token: null, role: "visitor", entitlement: "none", resolved: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders login mode by default and switches to register mode", async () => {
    renderLoginPage();

    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(submitButton(/sign in/i)).toHaveAttribute("type", "submit");

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("heading", { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /register/i })).toHaveAttribute("type", "submit");
  });

  it("submits login, stores session, and redirects to dashboard", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: makeToken("user"), token_type: "bearer" }), {
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

    renderLoginPage({ from: "/subscription" });

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "alice-pass" } });
    fireEvent.click(submitButton(/sign in/i));

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();

    await waitFor(() =>
      expect(useAuthStore.getState()).toMatchObject({
        token: expect.any(String),
        role: "member",
        entitlement: "none",
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });

  it("submits register and redirects to dashboard by default", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: makeToken("admin"), token_type: "bearer" }), {
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

    renderLoginPage();

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "admin1" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "admin-pass" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "admin-pass" } });
    fireEvent.click(submitButton(/register/i));

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(useAuthStore.getState().role).toBe("admin");
    expect(useAuthStore.getState().entitlement).toBe("active");
  });

  it("shows backend error messages when auth fails", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "invalid_credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
    fireEvent.click(submitButton(/sign in/i));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
