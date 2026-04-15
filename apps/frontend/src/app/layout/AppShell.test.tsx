import type { JSX } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@/app/layout/AppShell";
import { I18nProvider } from "@/lib/i18n";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    Outlet: () => <div data-testid="outlet-content">Outlet Content</div>,
  };
});

describe("AppShell", () => {
  function NavigationHarness(): JSX.Element {
    const location = useLocation();
    const navigate = useNavigate();

    return (
      <>
        <button type="button" onClick={() => navigate("/market-thermometer")}>
          Go to market thermometer
        </button>
        <div data-testid="current-path">{location.pathname}</div>
      </>
    );
  }

  function renderShell(): void {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <AppShell />
        </MemoryRouter>
      </I18nProvider>,
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-color-mode");
    document.documentElement.removeAttribute("lang");
    document.documentElement.classList.remove("dark");
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
    renderShell();
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
    renderShell();
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText("Monitoring")).toBeInTheDocument();
    expect(screen.getByText("Realtime")).toBeInTheDocument();
  });

  it("keeps route content visible during client-side navigation", () => {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <NavigationHarness />
          <AppShell />
        </MemoryRouter>
      </I18nProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId("current-path")).toHaveTextContent("/dashboard");
    expect(screen.getByTestId("outlet-content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go to market thermometer" }));

    expect(screen.getByTestId("current-path")).toHaveTextContent("/market-thermometer");
    expect(screen.getByTestId("outlet-content")).toBeInTheDocument();
    expect(screen.queryByTestId("page-skeleton")).not.toBeInTheDocument();
  });

  it("shows a mobile trigger button and opens sidebar sheet", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 640 });

    renderShell();
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByRole("button", { name: "Open sidebar" })).toBeInTheDocument();
    expect(screen.queryByText("Monitoring")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open sidebar" }));
    expect(screen.getByText("Monitoring")).toBeInTheDocument();
  });

  it("toggles color mode and language from icon buttons", () => {
    renderShell();
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const themeToggle = screen.getAllByRole("button", { name: "Switch to light theme" })[0];
    fireEvent.click(themeToggle);
    expect(document.documentElement.getAttribute("data-color-mode")).toBe("light");
    expect(window.localStorage.getItem("ui.color.mode")).toBe("light");
    expect(screen.getAllByRole("button", { name: "Switch to dark theme" }).length).toBeGreaterThan(0);

    const languageToggle = screen.getAllByRole("button", { name: "Switch to Chinese" })[0];
    fireEvent.click(languageToggle);
    expect(document.documentElement.getAttribute("lang")).toBe("zh-TW");
    expect(window.localStorage.getItem("ui.language.preset")).toBe("zh-TW");
    expect(screen.getAllByRole("button", { name: "Switch to English" }).length).toBeGreaterThan(0);
  });
});

