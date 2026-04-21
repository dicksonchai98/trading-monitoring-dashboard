"use client";

import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useShellNavigation } from "@/app/navigation/ShellNavigationContext";
import { useT } from "@/lib/i18n";

export function TeamSwitcher({
  teams,
  disableDropdown = false,
}: {
  teams: {
    name: string;
    logo: React.ReactNode;
    plan: string;
  }[];
  disableDropdown?: boolean;
}) {
  const t = useT();
  const { isMobile } = useSidebar();
  const [activeTeam, setActiveTeam] = React.useState(teams[0]);
  const { navigateWithTransition } = useShellNavigation();

  if (!activeTeam) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // 阻止默认刷新行为
    navigateWithTransition("/dashboard");
  };

  const teamButton = (
    <SidebarMenuButton
      size="lg"
      className="data-[state=open]:bg-sidebar-accent pl-0 data-[state=open]:text-sidebar-accent-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
    >
      <div className="flex aspect-square size-8 items-center justify-center  rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        {activeTeam.logo}
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{activeTeam.name}</span>
        <span className="truncate text-xs">{activeTeam.plan}</span>
      </div>
      {!disableDropdown ? <ChevronsUpDownIcon className="ml-auto" /> : null}
    </SidebarMenuButton>
  );

  if (disableDropdown) {
    return (
      <SidebarMenu>
        <SidebarMenuItem onClick={handleClick}>{teamButton}</SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{teamButton}</DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t("team.teams")}
            </DropdownMenuLabel>
            {teams.map((team, index) => (
              <DropdownMenuItem
                key={team.name}
                onClick={() => setActiveTeam(team)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  {team.logo}
                </div>
                {team.name}
                <DropdownMenuShortcut>{`Ctrl+${index + 1}`}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <PlusIcon className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">
                {t("team.add")}
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
