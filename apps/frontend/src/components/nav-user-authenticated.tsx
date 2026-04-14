import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
  const navigate = useNavigate();
  const { token, clearSession } = useAuthStore();
  const [portalLoading, setPortalLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [initialSettingsSection, setInitialSettingsSection] = useState<SettingsSection>("general");

  function openSettings(section: SettingsSection): void {
    setInitialSettingsSection(section);
    setSettingsOpen(true);
  }

  async function handleOpenPortal(): Promise<void> {
    if (!token || portalLoading) {
      return;
    }
    setPortalLoading(true);
    try {
      const result = await createPortalSession(token);
      toast.success(t("user.portalOpened"));
      if (typeof window !== "undefined" && result.portal_url) {
        window.open(result.portal_url, "_blank", "noopener,noreferrer");
      }
    } catch {
      toast.error(t("user.portalOpenFailed"));
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleLogout(): Promise<void> {
    try {
      await logout();
      toast.success(t("user.loggedOut"));
    } catch {
      toast.error(t("user.logoutFailed"));
    }
    clearSession();
    navigate("/login", { replace: true });
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
              <DropdownMenuItem onClick={() => navigate("/subscription")}>
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
              <DropdownMenuItem onClick={() => void handleOpenPortal()} disabled={!token || portalLoading}>
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
