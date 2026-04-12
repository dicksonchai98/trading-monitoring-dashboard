import type { JSX } from "react";
import { Fragment, useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { SidebarInset, SidebarProvider, SidebarSeparator, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useT, type TranslationKey } from "@/lib/i18n";

const BREADCRUMB_LABEL_KEYS: Record<string, TranslationKey> = {
  dashboard: "shell.breadcrumb.dashboard",
  "historical-data-analysis": "shell.breadcrumb.historicalDataAnalysis",
  "market-thermometer": "shell.breadcrumb.marketThermometer",
  "historical-data-loader": "shell.breadcrumb.historicalDataLoader",
  "historical-amplitude-distribution": "shell.breadcrumb.amplitudeDistribution",
  subscription: "shell.breadcrumb.subscription",
  admin: "shell.breadcrumb.admin",
  audit: "shell.breadcrumb.auditLog",
  settings: "shell.breadcrumb.settings",
};

export function AppShell(): JSX.Element {
  const t = useT();
  const location = useLocation();
  const [routeLoading, setRouteLoading] = useState(true);
  const segments = location.pathname.split("/").filter(Boolean);

  useEffect(() => {
    setRouteLoading(true);
    const timerId = window.setTimeout(() => setRouteLoading(false), 260);
    return () => window.clearTimeout(timerId);
  }, [location.pathname]);

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar />
        <SidebarInset className="min-h-screen bg-background">
          <header className="sticky top-0 z-20 hidden h-14 items-center gap-2 border-b border-border bg-shell/95 px-4 backdrop-blur md:flex">
            <SidebarTrigger aria-label={t("shell.toggleSidebar")} className="h-8 w-8 rounded-sm border border-border bg-shell text-muted-foreground hover:bg-panel-hover hover:text-foreground" />
            <SidebarSeparator orientation="vertical" className="mr-1 h-5" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard">{t("app.brand")}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {segments.map((segment, index) => {
                  const href = `/${segments.slice(0, index + 1).join("/")}`;
                  const label = BREADCRUMB_LABEL_KEYS[segment] ? t(BREADCRUMB_LABEL_KEYS[segment]) : segment;
                  const isLast = index === segments.length - 1;
                  return (
                    <Fragment key={href}>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage>{label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={href}>{label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-shell/95 px-3 backdrop-blur md:hidden">
            <SidebarTrigger aria-label={t("shell.openSidebar")} className="h-9 w-9 rounded-sm border border-border bg-shell text-muted-foreground hover:bg-panel-hover hover:text-foreground" />
            <span className="text-sm font-semibold text-foreground">{t("app.brand")}</span>
          </header>
          <div className="min-h-screen min-w-0 bg-background p-[var(--shell-padding)]">
            {routeLoading ? <PageSkeleton className="px-0 py-0" /> : <Outlet />}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
