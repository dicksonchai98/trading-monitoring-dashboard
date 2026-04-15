import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Link } from "react-router-dom"
import { useShellNavigation } from "@/app/navigation/ShellNavigationContext"
import { useT } from "@/lib/i18n"

export function NavProjects({
  projects,
  pathname,
}: {
  projects: {
    name: string
    url: string
    icon: React.ReactNode
  }[]
  pathname: string
}) {
  const t = useT();
  const { isMobile, setOpenMobile } = useSidebar();
  const { createLinkClickHandler } = useShellNavigation();

  function handleMobileNavClick(): void {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("nav.utilities")}</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild isActive={pathname === item.url}>
              <Link
                to={item.url}
                onClick={createLinkClickHandler(item.url, handleMobileNavClick)}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
