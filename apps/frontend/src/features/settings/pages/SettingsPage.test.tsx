import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { useAuthStore } from "@/lib/store/auth-store";

describe("SettingsPage", () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: "token",
      role: "member",
      entitlement: "active",
      resolved: true,
    });
  });

  it("renders settings controls in a full page layout", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("heading", { name: "Settings" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Billing Portal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });
});
