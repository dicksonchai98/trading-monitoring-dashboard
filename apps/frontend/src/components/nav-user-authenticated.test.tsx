import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { NavUserAuthenticated } from "@/components/nav-user-authenticated";
import { SidebarProvider } from "@/components/ui/sidebar";
import { logout } from "@/features/auth/api/auth";
import { createPortalSession } from "@/features/subscription/api/billing";
import { useAuthStore } from "@/lib/store/auth-store";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/features/subscription/api/billing", () => ({
  createPortalSession: vi.fn(),
}));

vi.mock("@/features/auth/api/auth", () => ({
  logout: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("NavUserAuthenticated", () => {
  const originalWindowOpen = window.open;

  beforeEach(() => {
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

    useAuthStore.setState({
      token: "token",
      role: "member",
      entitlement: "active",
      resolved: true,
      checkoutSessionId: null,
    });
  });

  afterEach(() => {
    window.open = originalWindowOpen;
    navigateMock.mockReset();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("does not open a new tab when opening the billing portal", async () => {
    let resolvePortal: ((value: { portal_url: string }) => void) | undefined;
    vi.mocked(createPortalSession).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePortal = resolve;
        }),
    );
    const openSpy = vi.fn();
    window.open = openSpy;

    render(
      <MemoryRouter>
        <SidebarProvider>
          <NavUserAuthenticated
            user={{ name: "User", email: "user@example.com", avatar: "" }}
          />
        </SidebarProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("Billing Portal"));

    await waitFor(() => {
      expect(createPortalSession).toHaveBeenCalledWith("token");
    });
    expect(openSpy).not.toHaveBeenCalled();

    resolvePortal?.({ portal_url: "https://billing.example.com/session" });

    await waitFor(() => {
      expect(createPortalSession).toHaveBeenCalledTimes(1);
    });
  });

  it("clears session and navigates to login before logout request resolves", async () => {
    let resolveLogout: (() => void) | undefined;
    vi.mocked(logout).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLogout = () => resolve({});
        }),
    );

    render(
      <MemoryRouter>
        <SidebarProvider>
          <NavUserAuthenticated
            user={{ name: "User", email: "user@example.com", avatar: "" }}
          />
        </SidebarProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("Log out"));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().role).toBe("visitor");
    expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });

    resolveLogout?.();
  });
});
