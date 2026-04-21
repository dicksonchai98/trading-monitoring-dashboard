"use client";

import * as React from "react";
import { useLocation } from "react-router-dom";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUserAuthenticated } from "@/components/nav-user-authenticated";
import { NavUserGuest } from "@/components/nav-user-guest";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { decodeAccessToken } from "@/features/auth/lib/token";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  ActivityIcon,
  BarChart3Icon,
  CandlestickChartIcon,
  HistoryIcon,
  ShieldCheckIcon,
} from "lucide-react";

function readSidebarUser(
  token: string | null,
  t: ReturnType<typeof useT>,
): { name: string; email: string; avatar: string } {
  if (!token) {
    return {
      name: t("user.visitor"),
      email: t("user.visitorHint"),
      avatar: "",
    };
  }

  try {
    const payload = decodeAccessToken(token);
    const rawName =
      typeof payload.user_id === "string" ? payload.user_id : undefined;
    const rawEmail = typeof payload.sub === "string" ? payload.sub : undefined;
    return {
      name: rawName ?? t("user.member"),
      email: rawEmail ?? t("user.signedIn"),
      avatar: "",
    };
  } catch {
    return {
      name: t("user.member"),
      email: t("user.signedIn"),
      avatar: "",
    };
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useT();
  const location = useLocation();
  const { token, role } = useAuthStore();
  const teams = React.useMemo(
    () => [
      {
        name: t("app.brand"),
        logo: <CandlestickChartIcon />,
        plan: t("team.mvp"),
      },
      {
        name: "Strategy Lab",
        logo: <BarChart3Icon />,
        plan: t("team.internal"),
      },
    ],
    [t],
  );
  const navMain = React.useMemo(
    () => [
      {
        title: t("nav.realtime"),
        url: "/dashboard",
        icon: <ActivityIcon />,
        items: [
          { title: t("nav.overview"), url: "/dashboard" },
          { title: t("nav.marketThermometer"), url: "/market-thermometer" },
          {
            title: t("nav.industryContributionHeatmap"),
            url: "/industry-contribution-heatmap",
          },
        ],
      },
      {
        title: t("nav.historical"),
        url: "/historical-data-analysis",
        icon: <HistoryIcon />,
        items: [
          { title: t("nav.dataAnalysis"), url: "/historical-data-analysis" },
          ...(role === "admin"
            ? [{ title: t("nav.dataLoader"), url: "/historical-data-loader" }]
            : []),
          {
            title: t("nav.amplitudeDistribution"),
            url: "/historical-amplitude-distribution",
          },
        ],
      },
      {
        title: t("nav.comingSoon"),
        url: "/options-positioning",
        icon: <BarChart3Icon />,
        items: [
          { title: t("nav.optionsPositioning"), url: "/options-positioning" },
          { title: t("nav.optionsAddClose"), url: "/options-add-close" },
        ],
      },
    ],
    [role, t],
  );
  const navUtilities = React.useMemo(
    () =>
      role === "admin"
        ? [
            {
              name: t("nav.adminAudit"),
              url: "/admin/audit",
              icon: <ShieldCheckIcon />,
            },
        ]
        : [],
    [role, t],
  );
  const user = React.useMemo(() => readSidebarUser(token, t), [token, t]);
  const utilities = React.useMemo(
    () => (token ? navUtilities : []),
    [navUtilities, token],
  );

  return (
    <Sidebar role="complementary" collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} disableDropdown />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} pathname={location.pathname} />
        {utilities.length > 0 ? (
          <NavProjects
            label={t("nav.utilities")}
            projects={utilities}
            pathname={location.pathname}
          />
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        {token ? (
          <NavUserAuthenticated user={user} />
        ) : (
          <NavUserGuest user={user} />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
