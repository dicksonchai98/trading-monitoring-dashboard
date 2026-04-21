import { useState } from "react";
import { useShellNavigation } from "@/app/navigation/ShellNavigationContext";
import { NavUserTrigger, type SidebarUserIdentity } from "@/components/nav-user-trigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenu, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { SettingsModal, type SettingsSection } from "@/features/settings/components/SettingsModal";
import { useT } from "@/lib/i18n";
import { LogInIcon, Settings2Icon, SparklesIcon } from "lucide-react";

export function NavUserGuest({ user }: { user: SidebarUserIdentity }) {
  const t = useT();
  const { navigateWithTransition } = useShellNavigation();
  const { isMobile } = useSidebar();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [initialSettingsSection, setInitialSettingsSection] = useState<SettingsSection>("general");

  function openSettings(section: SettingsSection): void {
    setInitialSettingsSection(section);
    setSettingsOpen(true);
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <NavUserTrigger user={user} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-48 rounded-lg"
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
            <DropdownMenuItem onClick={() => navigateWithTransition("/subscription")}>
              <SparklesIcon />
              {t("user.upgradeToPro")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openSettings("general")}>
              <Settings2Icon />
              {t("user.settings")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigateWithTransition("/login")}>
              <LogInIcon />
              {t("nav.login")}
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
