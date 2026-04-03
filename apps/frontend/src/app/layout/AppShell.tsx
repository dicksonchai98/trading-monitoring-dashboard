import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Sidebar } from "@/components/ui/sidebar";

function readIsMobileViewport(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.innerWidth <= 768;
}

export function AppShell(): JSX.Element {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(readIsMobileViewport);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(true);

  useEffect(() => {
    setRouteLoading(true);
    const timerId = window.setTimeout(() => setRouteLoading(false), 260);
    return () => window.clearTimeout(timerId);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateViewport = (): void => {
      const nextMobile = readIsMobileViewport();
      setIsMobile(nextMobile);
      if (!nextMobile) {
        setMobileSidebarOpen(false);
      }
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const sidebarWidth = sidebarCollapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w-expanded)";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="min-h-screen w-full">
        {isMobile ? (
          <>
            <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center border-b border-border bg-shell/95 px-3 backdrop-blur">
              <button
                type="button"
                aria-label="Open sidebar"
                className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-shell text-muted-foreground transition-colors hover:bg-panel-hover hover:text-foreground"
                onClick={() => setMobileSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="pointer-events-none absolute inset-x-0 text-center">
                <span className="text-sm font-semibold text-foreground">Trading Monitor</span>
              </div>
            </header>
            {mobileSidebarOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close sidebar overlay"
                  className="fixed inset-0 z-20 bg-black/40"
                  onClick={() => setMobileSidebarOpen(false)}
                />
                <Sidebar
                  mobile
                  mobileOpen
                  className="fixed inset-y-0 left-0 z-30 h-screen w-[var(--sidebar-w-expanded)] rounded-none border-y-0 border-l-0"
                  onCloseMobile={() => setMobileSidebarOpen(false)}
                />
              </>
            ) : null}
          </>
        ) : (
          <Sidebar
            className={
              sidebarCollapsed
                ? "fixed inset-y-0 left-0 z-20 h-screen w-[var(--sidebar-w-collapsed)] rounded-none border-y-0 border-l-0"
                : "fixed inset-y-0 left-0 z-20 h-screen w-[var(--sidebar-w-expanded)] rounded-none border-y-0 border-l-0"
            }
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((current) => !current)}
          />
        )}

        <main
          className="min-h-screen min-w-0 bg-background p-[var(--shell-padding)]"
          style={{
            marginLeft: isMobile ? "0px" : sidebarWidth,
            paddingTop: isMobile ? "calc(var(--shell-padding) + 56px)" : undefined,
          }}
        >
          {routeLoading ? <PageSkeleton className="px-0 py-0" /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}
