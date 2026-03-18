import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "@/app/layout/AppShell";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    Outlet: () => <div data-testid="outlet-content">Outlet Content</div>,
  };
});

describe("AppShell", () => {
  it("renders sidebar and main canvas regions", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppShell />
      </MemoryRouter>,
    );

    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(screen.getByRole("complementary")).toHaveClass("w-[var(--sidebar-w-expanded)]");
    expect(screen.getByRole("complementary")).toHaveClass("fixed", "inset-y-0", "left-0", "h-screen");
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("min-h-screen", "p-[var(--shell-padding)]");
    expect(screen.getByRole("main")).toHaveStyle({ marginLeft: "var(--sidebar-w-expanded)" });
    expect(screen.getByTestId("outlet-content")).toBeInTheDocument();
  });

  it("toggles the sidebar collapsed state", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppShell />
      </MemoryRouter>,
    );

    const collapseButton = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByLabelText("Trading Monitor brand")).toBeInTheDocument();
    expect(screen.getByText("Trading Monitor")).toBeInTheDocument();

    fireEvent.click(collapseButton);

    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Trading Monitor brand")).toBeInTheDocument();
    expect(screen.queryByText("Trading Monitor")).not.toBeInTheDocument();
    expect(screen.getByRole("complementary")).toHaveClass("w-[var(--sidebar-w-collapsed)]");
    expect(screen.getByRole("main")).toHaveStyle({ marginLeft: "var(--sidebar-w-collapsed)" });
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Trading Monitor")).toBeInTheDocument();
  });
});
