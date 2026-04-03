import type { JSX } from "react";
import { useEffect, useState } from "react";
import { LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageLayout } from "@/components/ui/page-layout";
import { logout } from "@/features/auth/api/auth";
import { createPortalSession } from "@/features/subscription/api/billing";
import { useAuthStore } from "@/lib/store/auth-store";

type FontPreset = "mono" | "sans";
type ThemePreset = "ember" | "ocean" | "graphite";
type LanguagePreset = "en" | "zh-TW";

const FONT_STORAGE_KEY = "ui.font.preset";
const THEME_STORAGE_KEY = "ui.theme.preset";
const LANGUAGE_STORAGE_KEY = "ui.language.preset";

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

function applyLanguagePreset(value: LanguagePreset): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("lang", value);
  document.documentElement.setAttribute("data-language", value);
}

export function SettingsPage(): JSX.Element {
  const navigate = useNavigate();
  const { token, role, clearSession } = useAuthStore();
  const isAuthenticated = role !== "visitor";
  const [fontPreset, setFontPreset] = useState<FontPreset>("mono");
  const [themePreset, setThemePreset] = useState<ThemePreset>("ember");
  const [languagePreset, setLanguagePreset] = useState<LanguagePreset>("en");
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const savedFont = window.localStorage.getItem(FONT_STORAGE_KEY);
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const nextFont: FontPreset = savedFont === "sans" ? "sans" : "mono";
    const nextTheme: ThemePreset = savedTheme === "ocean" || savedTheme === "graphite" ? savedTheme : "ember";
    const nextLanguage: LanguagePreset = savedLanguage === "zh-TW" ? "zh-TW" : "en";
    setFontPreset(nextFont);
    setThemePreset(nextTheme);
    setLanguagePreset(nextLanguage);
    applyFontPreset(nextFont);
    applyThemePreset(nextTheme);
    applyLanguagePreset(nextLanguage);
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

  function updateLanguagePreset(nextLanguage: LanguagePreset): void {
    setLanguagePreset(nextLanguage);
    applyLanguagePreset(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
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
      toast.success("Billing portal opened.");
      if (typeof window !== "undefined" && result.portal_url) {
        window.open(result.portal_url, "_blank", "noopener,noreferrer");
      }
    } catch {
      setPortalError("Unable to open billing portal right now.");
      toast.error("Unable to open billing portal right now.");
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleLogout(): Promise<void> {
    try {
      await logout();
      toast.success("Logged out successfully.");
    } catch {
      toast.error("Logout request failed.");
    }
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <PageLayout title="Settings">
      <Card className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-semibold text-foreground">Settings</h2>
          <Settings className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-foreground">Font</p>
          <select
            className="h-10 w-44 rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-border-strong"
            value={fontPreset}
            onChange={(event) => updateFontPreset(event.target.value as FontPreset)}
          >
            <option value="mono">Mono</option>
            <option value="sans">Sans</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-foreground">Color style</p>
          <select
            className="h-10 w-44 rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-border-strong"
            value={themePreset}
            onChange={(event) => updateThemePreset(event.target.value as ThemePreset)}
          >
            <option value="ember">Ember</option>
            <option value="ocean">Ocean</option>
            <option value="graphite">Graphite</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-foreground">Language</p>
          <select
            className="h-10 w-44 rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-border-strong"
            value={languagePreset}
            onChange={(event) => updateLanguagePreset(event.target.value as LanguagePreset)}
          >
            <option value="en">English</option>
            <option value="zh-TW">中文</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-foreground">Billing portal</p>
          <Button type="button" variant="outline" className="w-44" onClick={() => void handleOpenPortal()} disabled={!token || portalLoading}>
            {portalLoading ? "Opening portal..." : "Open Billing Portal"}
          </Button>
        </div>

        {portalUrl ? (
          <a className="block text-xs text-primary underline-offset-4 hover:underline" href={portalUrl} target="_blank" rel="noreferrer">
            Open latest billing portal link
          </a>
        ) : null}
        {portalError ? <p className="text-xs text-danger">{portalError}</p> : null}

        {isAuthenticated ? (
          <Button type="button" className="w-full" onClick={() => void handleLogout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Login required to manage account actions.</p>
        )}
      </Card>
    </PageLayout>
  );
}
