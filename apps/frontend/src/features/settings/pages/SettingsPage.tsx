import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageLayout } from "@/components/ui/page-layout";
import { Typography } from "@/components/ui/typography";
import { LANGUAGE_STORAGE_KEY, type LanguagePreset, useI18n } from "@/lib/i18n";

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

export function SettingsPage(): JSX.Element {
  const { locale, setLocale, t } = useI18n();
  const [fontPreset, setFontPreset] = useState<FontPreset>("mono");
  const [themePreset, setThemePreset] = useState<ThemePreset>("ember");
  const [languagePreset, setLanguagePreset] = useState<LanguagePreset>(locale);

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
    setLocale(nextLanguage);
  }, [setLocale]);

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
    setLocale(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    }
  }

  return (
    <PageLayout title={t("settings.title")}>
      <Card className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <Typography as="h2" variant="title" className="text-foreground">
            {t("settings.title")}
          </Typography>
          <Settings className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Typography as="p" variant="body" className="text-foreground">
            {t("settings.font")}
          </Typography>
          <select
            className="h-10 w-44 rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-border-strong"
            value={fontPreset}
            onChange={(event) => updateFontPreset(event.target.value as FontPreset)}
          >
            <option value="mono">{t("settings.fontMono")}</option>
            <option value="sans">{t("settings.fontSans")}</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Typography as="p" variant="body" className="text-foreground">
            {t("settings.colorStyle")}
          </Typography>
          <select
            className="h-10 w-44 rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-border-strong"
            value={themePreset}
            onChange={(event) => updateThemePreset(event.target.value as ThemePreset)}
          >
            <option value="ember">{t("settings.theme.ember")}</option>
            <option value="ocean">{t("settings.theme.ocean")}</option>
            <option value="graphite">{t("settings.theme.graphite")}</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Typography as="p" variant="body" className="text-foreground">
            {t("settings.language")}
          </Typography>
          <select
            className="h-10 w-44 rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-border-strong"
            value={languagePreset}
            onChange={(event) => updateLanguagePreset(event.target.value as LanguagePreset)}
          >
            <option value="en">{t("settings.langEnglish")}</option>
            <option value="zh-TW">{t("settings.langTraditionalChinese")}</option>
          </select>
        </div>
      </Card>
    </PageLayout>
  );
}
