import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "@/components/ui/sidebar";
import { useAuthStore } from "@/lib/store/auth-store";

function b64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function makeToken(role: "user" | "admin" = "user", sub = "alice"): string {
  return [
    b64url(JSON.stringify({ alg: "none", typ: "JWT" })),
    b64url(JSON.stringify({ sub, role, exp: 9_999_999_999, type: "access" })),
    "signature",
  ].join(".");
}

describe("Sidebar", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, role: "visitor", entitlement: "none", resolved: true });
  });

  it("pins user info to the bottom section and keeps the toggle button near the header", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("sidebar-footer")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-user-info")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveClass(
      "top-[var(--shell-padding)]",
    );
  });

  it("shows a login/register button when the user is not authenticated", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "登入 / 註冊" })).toHaveAttribute("href", "/login");
    expect(screen.queryByText("Account")).not.toBeInTheDocument();
  });

  it("shows account and role from the current auth session when authenticated", () => {
    useAuthStore.setState({
      token: makeToken("admin", "trader01"),
      role: "admin",
      entitlement: "active",
      resolved: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("trader01")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "登入 / 註冊" })).not.toBeInTheDocument();
  });
});
