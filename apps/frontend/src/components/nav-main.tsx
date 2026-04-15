import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Link } from "react-router-dom"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronRightIcon } from "lucide-react"
import { useShellNavigation } from "@/app/navigation/ShellNavigationContext"
import { useT } from "@/lib/i18n"

export function NavMain({
  items,
  pathname,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
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
      <SidebarGroupLabel>{t("nav.monitoring")}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={true}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={item.title} isActive={pathname === item.url}>
                  {item.icon}
                  <span>{item.title}</span>
                  <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items?.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
                        <Link
                          to={subItem.url}
                          onClick={createLinkClickHandler(subItem.url, handleMobileNavClick)}
                        >
                          <span>{subItem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
