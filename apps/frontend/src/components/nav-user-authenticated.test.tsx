import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import { NavUserAuthenticated } from "@/components/nav-user-authenticated";
import { SidebarProvider } from "@/components/ui/sidebar";
import { createPortalSession } from "@/features/subscription/api/billing";
import { I18nProvider } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth-store";

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
    <button type="button" role="menuitem" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/features/subscription/api/billing", () => ({
  createPortalSession: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("NavUserAuthenticated", () => {
  const createPortalSessionMock = vi.mocked(createPortalSession);
  const toastSuccessMock = vi.mocked(toast.success);
  const toastErrorMock = vi.mocked(toast.error);

  beforeEach(() => {
    createPortalSessionMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
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
      token: "token-123",
      role: "member",
      entitlement: "none",
      resolved: true,
      checkoutSessionId: null,
    });
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderComponent(): void {
    render(
      <I18nProvider>
        <MemoryRouter>
          <SidebarProvider>
            <NavUserAuthenticated
              user={{
                name: "Test User",
                email: "test@example.com",
                avatar: "",
              }}
            />
          </SidebarProvider>
        </MemoryRouter>
      </I18nProvider>,
    );
  }

  function openUserMenu(): void {
    const trigger = screen.getByRole("button", { name: /test user/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  }

  it("aborts the previous portal request and does not toast an abort error", async () => {
    let firstSignal: AbortSignal | undefined;

    createPortalSessionMock
      .mockImplementationOnce(
        (_token, signal) =>
          new Promise((_, reject) => {
            firstSignal = signal;
            signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }),
      )
      .mockResolvedValueOnce({
        portal_url: "https://billing.example.com/portal",
      });

    renderComponent();

    openUserMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /billing portal/i }));

    await waitFor(() => expect(createPortalSessionMock).toHaveBeenCalledTimes(1));

    openUserMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /billing portal/i }));

    await waitFor(() => expect(createPortalSessionMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(window.open).toHaveBeenCalledWith(
        "https://billing.example.com/portal",
        "_blank",
        "noopener,noreferrer",
      ),
    );

    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal?.aborted).toBe(true);
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledTimes(1);
  });
});
