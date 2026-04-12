"use client"

import * as React from "react"
import { useLocation } from "react-router-dom"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { decodeAccessToken } from "@/features/auth/lib/token"
import { useAuthStore } from "@/lib/store/auth-store"
import { ActivityIcon, BarChart3Icon, CandlestickChartIcon, HistoryIcon, LoaderCircleIcon, ShieldCheckIcon } from "lucide-react"

const teams = [
  { name: "Trading Monitor", logo: <CandlestickChartIcon />, plan: "MVP" },
  { name: "Strategy Lab", logo: <BarChart3Icon />, plan: "Internal" },
]

const navMain = [
  {
    title: "Realtime",
    url: "/dashboard",
    icon: <ActivityIcon />,
    items: [{ title: "Overview", url: "/dashboard" }],
  },
  {
    title: "Historical",
    url: "/historical-data-analysis",
    icon: <HistoryIcon />,
    items: [
      { title: "Data Analysis", url: "/historical-data-analysis" },
      { title: "Market Thermometer", url: "/market-thermometer" },
      { title: "Data Loader", url: "/historical-data-loader" },
      { title: "Amplitude Distribution", url: "/historical-amplitude-distribution" },
    ],
  },
]

const navUtilities = [
  { name: "Admin Audit", url: "/admin/audit", icon: <ShieldCheckIcon /> },
]

function readSidebarUser(token: string | null): { name: string; email: string; avatar: string } {
  if (!token) {
    return {
      name: "Visitor",
      email: "Sign in to unlock member data",
      avatar: "",
    }
  }

  try {
    const payload = decodeAccessToken(token)
    const rawName = typeof payload.user_id === "string" ? payload.user_id : undefined
    const rawEmail = typeof payload.sub === "string" ? payload.sub : undefined
    return {
      name: rawName ?? "Member",
      email: rawEmail ?? "Signed in",
      avatar: "",
    }
  } catch {
    return {
      name: "Member",
      email: "Signed in",
      avatar: "",
    }
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const { token } = useAuthStore()
  const user = React.useMemo(() => readSidebarUser(token), [token])
  const utilities = React.useMemo(() => {
    if (!token) {
      return [{ name: "Login", url: "/login", icon: <LoaderCircleIcon /> }]
    }
    return navUtilities
  }, [token])

  return (
    <Sidebar role="complementary" collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} pathname={location.pathname} />
        <NavProjects projects={utilities} pathname={location.pathname} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
