import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { SignupEmailVerificationPage } from "@/features/auth/pages/SignupEmailVerificationPage";
import { SignupPage } from "@/features/auth/pages/SignupPage";
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

function renderAuthPages(initialPath: string, initialState?: unknown): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: initialPath, state: initialState }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/signup/verify-email" element={<SignupEmailVerificationPage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
          <Route path="/subscription" element={<div>Subscription</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Auth pages", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    useAuthStore.setState({ token: null, role: "visitor", entitlement: "none", resolved: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows login page with signup link", async () => {
    renderAuthPages("/login");
    expect(screen.getByRole("heading", { name: /login to your account/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute("href", "/signup");
  });

  it("toggles password visibility on login form", async () => {
    renderAuthPages("/login");

    const loginPassword = screen.getByLabelText(/^password$/i);
    expect(loginPassword).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(loginPassword).toHaveAttribute("type", "text");
  });

  it("toggles password visibility on signup form", async () => {
    renderAuthPages("/signup");

    const signupPassword = screen.getByLabelText(/^password$/i);
    const signupConfirmPassword = screen.getByLabelText(/^confirm password$/i);
    expect(signupPassword).toHaveAttribute("type", "password");
    expect(signupConfirmPassword).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: /show password/i }));
    fireEvent.click(screen.getByRole("button", { name: /show confirm password/i }));
    expect(signupPassword).toHaveAttribute("type", "text");
    expect(signupConfirmPassword).toHaveAttribute("type", "text");
  });

  it("shows backend error messages when login fails", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "invalid_credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderAuthPages("/login");
    fireEvent.change(screen.getByLabelText(/user id/i), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "wrong-pass" } });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
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

    renderAuthPages("/login", { from: "/subscription" });
    fireEvent.change(screen.getByLabelText(/user id/i), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "alice-pass" } });
    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByText("Subscription")).toBeInTheDocument();
    await waitFor(() =>
      expect(useAuthStore.getState()).toMatchObject({
        token: expect.any(String),
        role: "member",
        entitlement: "none",
      }),
    );
  });

  it("navigates from signup to verification after sending otp", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "accepted" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderAuthPages("/signup");
    fireEvent.change(screen.getByLabelText(/user id/i), { target: { value: "admin1" } });
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "admin1@example.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "AdminPass1" } });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), { target: { value: "AdminPass1" } });
    fireEvent.click(screen.getByRole("button", { name: /continue to email verification/i }));

    expect(await screen.findByRole("heading", { level: 1, name: "Verify your email" })).toBeInTheDocument();
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
  });

  it("redirects verification page to signup when state is missing", async () => {
    renderAuthPages("/signup/verify-email");
    expect(await screen.findByRole("heading", { name: /create your account/i })).toBeInTheDocument();
  });

  it("locks resend with cooldown after sending otp", async () => {
    renderAuthPages("/signup/verify-email", {
      registration: {
        user_id: "member1",
        email: "member1@example.com",
        password: "MemberPass1",
        confirmPassword: "MemberPass1",
      },
    });

    expect(screen.getByRole("button", { name: /resend code in 60s/i })).toBeDisabled();
  });

  it("verifies otp, registers account, stores session, and redirects", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ verification_token: "verify-token-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
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

    renderAuthPages("/signup/verify-email", {
      registration: {
        user_id: "admin1",
        email: "admin1@example.com",
        password: "AdminPass1",
        confirmPassword: "AdminPass1",
      },
    });

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /verify and create account/i }));

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(useAuthStore.getState().role).toBe("admin");
    expect(useAuthStore.getState().entitlement).toBe("active");
  });
});
