import { act, fireEvent, render, screen } from "@testing-library/react";
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
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("max-width") ? window.innerWidth <= 767 : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1024 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders sidebar and main canvas regions", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppShell />
      </MemoryRouter>,
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const mainRegion = screen.getByRole("main");
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(mainRegion).toBeInTheDocument();
    expect(mainRegion).toHaveClass("min-h-screen", "bg-background");
    expect(mainRegion.querySelector("div.p-\\[var\\(--shell-padding\\)\\]")).not.toBeNull();
    expect(screen.getByTestId("outlet-content")).toBeInTheDocument();
  });

  it("renders sidebar nav entries from the shadcn sidebar kit", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppShell />
      </MemoryRouter>,
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText("Monitoring")).toBeInTheDocument();
    expect(screen.getByText("Realtime")).toBeInTheDocument();
    expect(screen.getByText("Utilities")).toBeInTheDocument();
  });

  it("shows a mobile trigger button and opens sidebar sheet", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 640 });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppShell />
      </MemoryRouter>,
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByRole("button", { name: "Open sidebar" })).toBeInTheDocument();
    expect(screen.queryByText("Monitoring")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open sidebar" }));
    expect(screen.getByText("Monitoring")).toBeInTheDocument();
  });
});
