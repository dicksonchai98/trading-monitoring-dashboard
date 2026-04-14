import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { GuardedRoute } from "@/lib/guards/GuardedRoute";
import { useAuthStore } from "@/lib/store/auth-store";

describe("GuardedRoute", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, role: "visitor", entitlement: "none", resolved: true });
  });

  it("redirects unauthenticated users to login", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <GuardedRoute requiredRole="member">
                <div>Dashboard</div>
              </GuardedRoute>
            }
          />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("redirects logged-in users without active entitlement to subscription", () => {
    useAuthStore.setState({ token: "token", role: "member", entitlement: "pending", resolved: true });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <GuardedRoute requiredRole="member" requireActiveEntitlement>
                <div>Dashboard</div>
              </GuardedRoute>
            }
          />
          <Route path="/subscription" element={<div>Subscription</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Subscription")).toBeInTheDocument();
  });

  it("allows admin even without active entitlement when entitlement is required", () => {
    useAuthStore.setState({ token: "token", role: "admin", entitlement: "pending", resolved: true });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <GuardedRoute requiredRole="member" requireActiveEntitlement>
                <div>Dashboard</div>
              </GuardedRoute>
            }
          />
          <Route path="/subscription" element={<div>Subscription</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
