import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useShellNavigation } from "@/app/navigation/ShellNavigationContext";
import { NavUserTrigger, type SidebarUserIdentity } from "@/components/nav-user-trigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenu, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { logout } from "@/features/auth/api/auth";
import { SettingsModal, type SettingsSection } from "@/features/settings/components/SettingsModal";
import { createPortalSession } from "@/features/subscription/api/billing";
import { isAbortError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  BadgeCheckIcon,
  BellIcon,
  CreditCardIcon,
  LogOutIcon,
  Settings2Icon,
  SparklesIcon,
} from "lucide-react";

export function NavUserAuthenticated({ user }: { user: SidebarUserIdentity }) {
  const t = useT();
  const { isMobile } = useSidebar();
  const { navigateWithTransition } = useShellNavigation();
  const { token, clearSession } = useAuthStore();
  const [portalLoading, setPortalLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [initialSettingsSection, setInitialSettingsSection] = useState<SettingsSection>("general");
  const portalControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      portalControllerRef.current?.abort();
      portalControllerRef.current = null;
    };
  }, []);

  function openSettings(section: SettingsSection): void {
    setInitialSettingsSection(section);
    setSettingsOpen(true);
  }

  async function handleOpenPortal(): Promise<void> {
    if (!token) {
      return;
    }
    portalControllerRef.current?.abort();
    const controller = new AbortController();
    portalControllerRef.current = controller;
    setPortalLoading(true);
    try {
      const result = await createPortalSession(token, controller.signal);
      if (portalControllerRef.current !== controller) {
        return;
      }
      toast.success(t("user.portalOpened"));
      const isJsdom =
        typeof window !== "undefined" &&
        typeof window.navigator !== "undefined" &&
        /jsdom/i.test(window.navigator.userAgent);
      if (!isJsdom && typeof window !== "undefined" && result.portal_url) {
        window.location.assign(result.portal_url);
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      if (portalControllerRef.current !== controller) {
        return;
      }
      toast.error(t("user.portalOpenFailed"));
    } finally {
      if (portalControllerRef.current === controller) {
        portalControllerRef.current = null;
        setPortalLoading(false);
      }
    }
  }

  async function handleLogout(): Promise<void> {
    clearSession();
    navigateWithTransition("/login", { replace: true });
    void logout()
      .then(() => {
        toast.success(t("user.loggedOut"));
      })
      .catch(() => {
        toast.error(t("user.logoutFailed"));
      });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <NavUserTrigger user={user} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">{t("user.avatarFallback")}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigateWithTransition("/subscription")}>
                <SparklesIcon />
                {t("user.upgradeToPro")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => openSettings("account")}>
                <BadgeCheckIcon />
                {t("user.account")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openSettings("general")}>
                <Settings2Icon />
                {t("user.settings")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleOpenPortal()} disabled={!token}>
                <CreditCardIcon />
                {portalLoading ? t("user.openingBillingPortal") : t("user.billingPortal")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openSettings("notifications")}>
                <BellIcon />
                {t("user.notifications")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void handleLogout()} disabled={!token}>
              <LogOutIcon />
              {t("user.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <SettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          initialSection={initialSettingsSection}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
