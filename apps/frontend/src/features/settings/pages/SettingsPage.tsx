import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageLayout } from "@/components/ui/page-layout";

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
  const [fontPreset, setFontPreset] = useState<FontPreset>("mono");
  const [themePreset, setThemePreset] = useState<ThemePreset>("ember");
  const [languagePreset, setLanguagePreset] = useState<LanguagePreset>("en");

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

      </Card>
    </PageLayout>
  );
}
