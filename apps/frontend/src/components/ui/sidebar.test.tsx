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
    useAuthStore.setState({
      token: null,
      role: "visitor",
      entitlement: "none",
      resolved: true,
    });
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

  it("renders setting nav item at the end and keeps user info in a separate footer section", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    const nav = screen.getByTestId("sidebar-nav");
    const navButtons = nav.querySelectorAll("a,button");
    const lastNavItem = navButtons[navButtons.length - 1];
    expect(lastNavItem).toHaveAttribute("data-testid", "sidebar-settings-nav");
    expect(screen.getByTestId("sidebar-footer")).toContainElement(screen.getByTestId("sidebar-user-info"));
  });

  it("shows a login link when the user is not authenticated", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    const loginLink = screen
      .getAllByRole("link")
      .find((element) => element.getAttribute("href") === "/login");
    expect(loginLink).toBeDefined();
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
    expect(screen.getByTestId("sidebar-user-info-display")).toBeInTheDocument();
  });

  it("renders settings as a navigation link instead of modal trigger", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    const settingsLink = screen.getByTestId("sidebar-settings-nav");
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });

  it("does not show clickable settings trigger in user info block", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("sidebar-user-info-trigger")).not.toBeInTheDocument();
  });
});
