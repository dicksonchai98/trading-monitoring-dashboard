import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/ui/sidebar";

function readIsMobileViewport(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.innerWidth <= 768;
}

export function AppShell(): JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(readIsMobileViewport);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
            <button
              type="button"
              aria-label="Open sidebar"
              className="fixed left-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-shell text-muted-foreground shadow-sm transition-colors hover:bg-panel-hover hover:text-foreground"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
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
          style={{ marginLeft: isMobile ? "0px" : sidebarWidth }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
