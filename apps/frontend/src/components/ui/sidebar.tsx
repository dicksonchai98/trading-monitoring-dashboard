import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  LogOut,
} from "lucide-react";
import { createPortalSession } from "@/features/subscription/api/billing";
import { decodeAccessToken } from "@/features/auth/lib/token";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils/cn";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/historical-data-analysis", label: "Historical Data Analysis", icon: Database },
  { to: "/historical-data-loader", label: "Historical Data Loader", icon: History },
  { to: "/historical-amplitude-distribution", label: "Historical Amplitude Distribution", icon: BarChart3 },
  { to: "/analytics/events", label: "Event Analytics", icon: BarChart3 },
  { to: "/analytics/distributions", label: "Distribution Analytics", icon: BarChart3 },
  { to: "/market-thermometer", label: "Market Thermometer", icon: Gauge },
  { to: "/subscription", label: "Subscription", icon: CreditCard },
  { to: "/admin/audit", label: "Admin Audit", icon: ClipboardList },
  { to: "/forbidden", label: "Access Control", icon: Shield },
];

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

type FontPreset = "mono" | "sans";
type ThemePreset = "ember" | "ocean" | "graphite";

const FONT_STORAGE_KEY = "ui.font.preset";
const THEME_STORAGE_KEY = "ui.theme.preset";

function applyFontPreset(value: FontPreset): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("data-font", value);
}

function applyThemePreset(value: ThemePreset): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("data-theme", value);
}

export function Sidebar({
  className,
  collapsed = false,
  onToggle,
}: SidebarProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, role, clearSession } = useAuthStore();
  const isAuthenticated = role !== "visitor";
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fontPreset, setFontPreset] = useState<FontPreset>("mono");
  const [themePreset, setThemePreset] = useState<ThemePreset>("ember");
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedFont = window.localStorage.getItem(FONT_STORAGE_KEY);
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextFont: FontPreset = savedFont === "sans" ? "sans" : "mono";
    const nextTheme: ThemePreset =
      savedTheme === "ocean" || savedTheme === "graphite" ? savedTheme : "ember";

    setFontPreset(nextFont);
    setThemePreset(nextTheme);
    applyFontPreset(nextFont);
    applyThemePreset(nextTheme);
  }, []);

  function updateFontPreset(nextFont: FontPreset): void {
    setFontPreset(nextFont);
    applyFontPreset(nextFont);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FONT_STORAGE_KEY, nextFont);
    }
  }

  function updateThemePreset(nextTheme: ThemePreset): void {
    setThemePreset(nextTheme);
    applyThemePreset(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }
  }

  async function handleOpenPortal(): Promise<void> {
    if (!token || portalLoading) {
      return;
    }
    setPortalLoading(true);
    setPortalError(null);
    try {
      const result = await createPortalSession(token);
      setPortalUrl(result.portal_url);
      if (typeof window !== "undefined" && result.portal_url) {
        window.open(result.portal_url, "_blank", "noopener,noreferrer");
      }
    } catch {
      setPortalError("Unable to open billing portal right now.");
    } finally {
      setPortalLoading(false);
    }
  }

  function handleLogout(): void {
    clearSession();
    setSettingsOpen(false);
    navigate("/login", { replace: true });
  }

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
        "relative flex h-full flex-col overflow-visible rounded-md border border-border bg-shell p-[var(--panel-padding)] transition-[width] duration-200",
        className,
      )}
    >
      <div
        className={cn("mb-[var(--section-gap)] px-3 py-2", collapsed && "px-2")}
      >
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[var(--shell-padding)] z-10 inline-flex h-[var(--sidebar-toggle-size)] w-[var(--sidebar-toggle-size)] items-center justify-center rounded-sm border border-border bg-shell text-muted-foreground shadow-sm transition-colors hover:bg-panel-hover hover:text-foreground"
          onClick={onToggle}
          type="button"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed && "justify-center",
          )}
        >
          <span
            aria-label="Trading Monitor brand"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-primary/40 bg-primary/15 text-primary"
          >
            <BarChart3 className="h-4 w-4" />
          </span>
          {collapsed ? null : (
            <p className="text-sm font-semibold text-foreground">
              Trading Monitor
            </p>
          )}
        </div>
      </div>
      <nav className="flex-1 space-y-[var(--space-1)]">
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
            >
              <Icon className="h-4 w-4" />
              {collapsed ? null : (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div
        className={cn("relative mt-[var(--section-gap)]")}
        data-testid="sidebar-footer"
      >
        <div
          id="user-info"
          data-name="user-info"
          className={cn(
            "border border-border bg-card p-2 text-xs text-muted-foreground",
            collapsed && "hidden",
          )}
          data-testid="sidebar-user-info"
        >
          {isAuthenticated ? (
            <button
              type="button"
              className="w-full rounded-sm text-left transition-colors hover:bg-panel-hover"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
              data-testid="sidebar-user-info-trigger"
            >
              <div className="mb-2 flex items-center gap-2 text-subtle-foreground">
                <Settings className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-[0.08em]">
                  Settings
                </span>
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">
                    Account
                  </p>
                  <p className="font-semibold text-foreground">
                    {account || "unknown"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">
                    Role
                  </p>
                  <p className="text-foreground">{role}</p>
                </div>
              </div>
            </button>
          ) : (
            <Link
              className="flex h-10 w-full items-center justify-center rounded-sm border border-primary bg-primary text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
              to="/login"
            >
              ?»å…¥ / è¨»å?
            </Link>
          )}
        </div>
      </div>
      {settingsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSettingsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Settings dialog"
        >
          <div
            className="w-full max-w-xl rounded-sm border border-border-strong bg-shell p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Settings</h2>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-panel-hover hover:text-foreground"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-subtle-foreground">
                  Font
                </p>
                <select
                  className="h-10 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-border-strong"
                  value={fontPreset}
                  onChange={(event) =>
                    updateFontPreset(event.target.value as FontPreset)
                  }
                >
                  <option value="mono">Mono</option>
                  <option value="sans">Sans</option>
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-subtle-foreground">
                  Color style
                </p>
                <select
                  className="h-10 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-border-strong"
                  value={themePreset}
                  onChange={(event) =>
                    updateThemePreset(event.target.value as ThemePreset)
                  }
                >
                  <option value="ember">Ember</option>
                  <option value="ocean">Ocean</option>
                  <option value="graphite">Graphite</option>
                </select>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-subtle-foreground">
                  Billing portal
                </p>
                <button
                  type="button"
                  className="h-10 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground transition-colors hover:border-border-strong hover:bg-panel-hover disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void handleOpenPortal()}
                  disabled={!token || portalLoading}
                >
                  {portalLoading ? "Opening portal..." : "Open Billing Portal"}
                </button>
                {portalUrl ? (
                  <a
                    className="text-xs text-primary underline-offset-4 hover:underline"
                    href={portalUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open latest billing portal link
                  </a>
                ) : null}
                {portalError ? (
                  <p className="text-xs text-danger">{portalError}</p>
                ) : null}
              </div>

              {isAuthenticated ? (
                <div className="border-t border-border pt-4">
                  <button
                    type="button"
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-sm border border-danger/60 bg-danger/10 px-3 text-sm text-danger transition-colors hover:bg-danger/20"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

