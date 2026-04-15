import type { JSX } from "react";
import { Fragment, useEffect, useState } from "react";
import { Languages, Moon, Sun } from "lucide-react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { SidebarInset, SidebarProvider, SidebarSeparator, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ShellNavigationProvider, useShellNavigation } from "@/app/navigation/ShellNavigationContext";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const COLOR_MODE_STORAGE_KEY = "ui.color.mode";

type ColorMode = "light" | "dark";

function normalizeColorMode(value: string | null | undefined): ColorMode {
  return value === "light" ? "light" : "dark";
}

function readInitialColorMode(): ColorMode {
  if (typeof window !== "undefined") {
    return normalizeColorMode(window.localStorage.getItem(COLOR_MODE_STORAGE_KEY));
  }
  return "dark";
}

function applyColorModeToDocument(colorMode: ColorMode): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("data-color-mode", colorMode);
  document.documentElement.classList.toggle("dark", colorMode === "dark");
}

const BREADCRUMB_LABEL_KEYS: Record<string, TranslationKey> = {
  dashboard: "shell.breadcrumb.dashboard",
  "historical-data-analysis": "shell.breadcrumb.historicalDataAnalysis",
  "market-thermometer": "shell.breadcrumb.marketThermometer",
  "industry-contribution-heatmap":
    "shell.breadcrumb.industryContributionHeatmap",
  "historical-data-loader": "shell.breadcrumb.historicalDataLoader",
  "historical-amplitude-distribution": "shell.breadcrumb.amplitudeDistribution",
  subscription: "shell.breadcrumb.subscription",
  admin: "shell.breadcrumb.admin",
  audit: "shell.breadcrumb.auditLog",
  settings: "shell.breadcrumb.settings",
};

function AppShellContent(): JSX.Element {
  const { locale, setLocale, t } = useI18n();
  const location = useLocation();
  const { createLinkClickHandler, isRouteLoading } = useShellNavigation();
  const [colorMode, setColorMode] = useState<ColorMode>(readInitialColorMode);
  const segments = location.pathname.split("/").filter(Boolean);

  useEffect(() => {
    applyColorModeToDocument(colorMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode);
    }
  }, [colorMode]);

  function toggleColorMode(): void {
    setColorMode((current) => (current === "dark" ? "light" : "dark"));
  }

  function toggleLanguage(): void {
    setLocale(locale === "en" ? "zh-TW" : "en");
  }

  function renderHeaderActions(buttonSizeClassName: string): JSX.Element {
    return (
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label={colorMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={colorMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={toggleColorMode}
          className={`${buttonSizeClassName} inline-flex items-center justify-center rounded-sm border border-border bg-shell text-muted-foreground hover:bg-panel-hover hover:text-foreground`}
        >
          {colorMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          type="button"
          aria-label={locale === "en" ? "Switch to Chinese" : "Switch to English"}
          title={locale === "en" ? "Switch to Chinese" : "Switch to English"}
          onClick={toggleLanguage}
          className={`${buttonSizeClassName} inline-flex items-center justify-center rounded-sm border border-border bg-shell text-muted-foreground hover:bg-panel-hover hover:text-foreground`}
        >
          <Languages className="h-4 w-4" />
        </button>
      </div>
    );
  }

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
                    <Link to="/dashboard" onClick={createLinkClickHandler("/dashboard")}>
                      {t("app.brand")}
                    </Link>
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
                            <Link to={href} onClick={createLinkClickHandler(href)}>
                              {label}
                            </Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
            {renderHeaderActions("h-8 w-8")}
          </header>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-shell/95 px-3 backdrop-blur md:hidden">
            <SidebarTrigger aria-label={t("shell.openSidebar")} className="h-9 w-9 rounded-sm border border-border bg-shell text-muted-foreground hover:bg-panel-hover hover:text-foreground" />
            <span className="text-sm font-semibold text-foreground">{t("app.brand")}</span>
            {renderHeaderActions("h-8 w-8")}
          </header>
          <div className="min-h-screen min-w-0 bg-background p-[var(--shell-padding)]">
            {isRouteLoading ? <PageSkeleton className="px-0 py-0" /> : <Outlet />}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export function AppShell(): JSX.Element {
  return (
    <ShellNavigationProvider>
      <AppShellContent />
    </ShellNavigationProvider>
  );
}
