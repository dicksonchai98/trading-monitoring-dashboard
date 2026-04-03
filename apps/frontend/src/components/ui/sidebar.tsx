import type { JSX } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  CreditCard,
  Database,
  Gauge,
  History,
  Shield,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  X,
} from "lucide-react";
import { decodeAccessToken } from "@/features/auth/lib/token";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils/cn";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/historical-data-analysis", label: "Historical Data Analysis", icon: Database },
  { to: "/historical-data-loader", label: "Historical Data Loader", icon: History },
  { to: "/historical-amplitude-distribution", label: "Historical Amplitude Distribution", icon: BarChart3 },
  { to: "/market-thermometer", label: "Market Thermometer", icon: Gauge },
  { to: "/subscription", label: "Subscription", icon: CreditCard },
  { to: "/admin/audit", label: "Admin Audit", icon: ClipboardList },
  { to: "/forbidden", label: "Access Control", icon: Shield },
  { to: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  mobile?: boolean;
  mobileOpen?: boolean;
  onToggle?: () => void;
  onCloseMobile?: () => void;
}

export function Sidebar({
  className,
  collapsed = false,
  mobile = false,
  mobileOpen = true,
  onToggle,
  onCloseMobile,
}: SidebarProps): JSX.Element {
  const location = useLocation();
  const { token, role } = useAuthStore();
  const isAuthenticated = role !== "visitor";

  let account = "";
  if (token) {
    try {
      const payload = decodeAccessToken(token);
      account = typeof payload.sub === "string" ? payload.sub : "";
    } catch {
      account = "";
    }
  }

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col overflow-visible rounded-md border border-border bg-shell p-[var(--panel-padding)] transition-[width] duration-300 ease-out will-change-[width]",
        className,
      )}
    >
      <div className={cn("mb-[var(--section-gap)] px-3 py-2", collapsed && "px-2")}>
        {!mobile ? (
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute -right-3 top-[var(--shell-padding)] z-10 inline-flex h-[var(--sidebar-toggle-size)] w-[var(--sidebar-toggle-size)] items-center justify-center rounded-sm border border-border bg-shell text-muted-foreground shadow-sm transition-colors hover:bg-panel-hover hover:text-foreground"
            onClick={onToggle}
            type="button"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        ) : (
          <button
            type="button"
            aria-label="Close sidebar"
            className={cn(
              "absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-panel-hover hover:text-foreground",
              !mobileOpen && "hidden",
            )}
            onClick={onCloseMobile}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          <span
            aria-label="Trading Monitor brand"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-primary/40 bg-primary/15 text-primary"
          >
            <BarChart3 className="h-4 w-4" />
          </span>
          {collapsed ? null : <p className="text-sm font-semibold text-foreground">Trading Monitor</p>}
        </div>
      </div>

      <nav className="flex-1 space-y-[var(--space-1)]" data-testid="sidebar-nav">
        {nav.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;

          return (
            <Link
              aria-label={collapsed ? item.label : undefined}
              key={item.to}
              className={cn(
                "flex items-center rounded-sm border py-2 text-sm transition-colors",
                collapsed ? "justify-center px-2" : "gap-2 px-3",
                active
                  ? "border-border-strong bg-card text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
              )}
              to={item.to}
              data-testid={item.to === "/settings" ? "sidebar-settings-nav" : undefined}
              onClick={() => {
                if (mobile) {
                  onCloseMobile?.();
                }
              }}
            >
              <Icon className="h-4 w-4" />
              {collapsed ? null : <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={cn("relative mt-[var(--section-gap)]")} data-testid="sidebar-footer">
        <div
          id="user-info"
          data-name="user-info"
          className={cn("border border-border bg-card p-2 text-xs text-muted-foreground", collapsed && "hidden")}
          data-testid="sidebar-user-info"
        >
          {isAuthenticated ? (
            <div data-testid="sidebar-user-info-display" className="space-y-2">
              <div className="space-y-1">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">Account</p>
                <p className="font-semibold text-foreground">{account || "unknown"}</p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">Role</p>
                <p className="text-foreground">{role}</p>
              </div>
            </div>
          ) : (
            <Link
              className="flex h-10 w-full items-center justify-center rounded-sm border border-primary bg-primary text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
              to="/login"
              onClick={() => {
                if (mobile) {
                  onCloseMobile?.();
                }
              }}
            >
              Login / Register
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
