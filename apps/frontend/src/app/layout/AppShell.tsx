import type { JSX } from "react";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/ui/sidebar";

export function AppShell(): JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarWidth = sidebarCollapsed
    ? "var(--sidebar-w-collapsed)"
    : "var(--sidebar-w-expanded)";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="min-h-screen w-full">
        <Sidebar
          className={
            sidebarCollapsed
              ? "fixed inset-y-0 left-0 z-20 h-screen w-[var(--sidebar-w-collapsed)] rounded-none border-y-0 border-l-0"
              : "fixed inset-y-0 left-0 z-20 h-screen w-[var(--sidebar-w-expanded)] rounded-none border-y-0 border-l-0"
          }
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((current) => !current)}
        />
        <main
          className="min-h-screen min-w-0 bg-background p-[var(--shell-padding)]"
          style={{ marginLeft: sidebarWidth }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
