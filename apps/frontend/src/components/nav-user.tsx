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
      toast.success("Billing portal opened.")
      if (typeof window !== "undefined" && result.portal_url) {
        window.open(result.portal_url, "_blank", "noopener,noreferrer")
      }
    } catch {
      toast.error("Unable to open billing portal right now.")
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleLogout(): Promise<void> {
    try {
      await logout()
      toast.success("Logged out successfully.")
    } catch {
      toast.error("Logout request failed.")
    }
    clearSession()
    navigate("/login", { replace: true })
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
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
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
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback>
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
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => openSettings("account")}>
                <BadgeCheckIcon
                />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openSettings("general")}>
                <Settings2Icon
                />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleOpenPortal()} disabled={!token || portalLoading}>
                <CreditCardIcon
                />
                {portalLoading ? "Opening Billing Portal..." : "Billing Portal"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openSettings("notifications")}>
                <BellIcon
                />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void handleLogout()} disabled={!token}>
              <LogOutIcon
              />
              Log out
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


