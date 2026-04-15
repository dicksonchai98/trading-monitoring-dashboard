import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { logout } from "@/features/auth/api/auth"
import { SettingsModal, type SettingsSection } from "@/features/settings/components/SettingsModal"
import { createPortalSession } from "@/features/subscription/api/billing"
import { useT } from "@/lib/i18n"
import { useAuthStore } from "@/lib/store/auth-store"
import { ChevronsUpDownIcon, SparklesIcon, BadgeCheckIcon, CreditCardIcon, BellIcon, LogOutIcon, Settings2Icon } from "lucide-react"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const t = useT();
  const { isMobile } = useSidebar()
  const navigate = useNavigate()
  const { token, clearSession } = useAuthStore()
  const [portalLoading, setPortalLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [initialSettingsSection, setInitialSettingsSection] = useState<SettingsSection>("general")

  function openSettings(section: SettingsSection): void {
    setInitialSettingsSection(section)
    setSettingsOpen(true)
  }

  async function handleOpenPortal(): Promise<void> {
    if (!token || portalLoading) {
      return
    }
    setPortalLoading(true)
    try {
      const result = await createPortalSession(token)
      toast.success(t("user.portalOpened"))
      const isJsdom =
        typeof window !== "undefined" &&
        typeof window.navigator !== "undefined" &&
        /jsdom/i.test(window.navigator.userAgent)
      if (!isJsdom && typeof window !== "undefined" && result.portal_url) {
        window.location.assign(result.portal_url)
      }
    } catch {
      toast.error(t("user.portalOpenFailed"))
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleLogout(): Promise<void> {
    clearSession()
    navigate("/login", { replace: true })
    void logout()
      .then(() => {
        toast.success(t("user.loggedOut"))
      })
      .catch(() => {
        toast.error(t("user.logoutFailed"))
      })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">{t("user.avatarFallback")}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
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
                <SparklesIcon
                />
                {t("user.upgradeToPro")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => openSettings("account")}>
                <BadgeCheckIcon
                />
                {t("user.account")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openSettings("general")}>
                <Settings2Icon
                />
                {t("user.settings")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleOpenPortal()} disabled={!token || portalLoading}>
                <CreditCardIcon
                />
                {portalLoading ? t("user.openingBillingPortal") : t("user.billingPortal")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openSettings("notifications")}>
                <BellIcon
                />
                {t("user.notifications")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void handleLogout()} disabled={!token}>
              <LogOutIcon
              />
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
  )
}


