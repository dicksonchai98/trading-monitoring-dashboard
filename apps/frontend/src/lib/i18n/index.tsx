import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import type { JSX } from "react";
import { messages, type LanguagePreset, type TranslationKey } from "@/lib/i18n/messages";

export const LANGUAGE_STORAGE_KEY = "ui.language.preset";

type TranslationVariables = Record<string, string | number>;

interface I18nContextValue {
  locale: LanguagePreset;
  setLocale: (locale: LanguagePreset) => void;
  t: (key: TranslationKey, variables?: TranslationVariables) => string;
}

function normalizeLanguage(value: string | null | undefined): LanguagePreset {
  return value === "zh-TW" ? "zh-TW" : "en";
}

function applyLanguagePresetToDocument(value: LanguagePreset): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("lang", value);
  document.documentElement.setAttribute("data-language", value);
}

function readInitialLanguage(): LanguagePreset {
  if (typeof window !== "undefined") {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return normalizeLanguage(savedLanguage);
  }
  return "en";
}

function formatMessage(template: string, variables?: TranslationVariables): string {
  if (!variables) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = variables[token];
    return value === undefined ? `{${token}}` : String(value);
  });
}

const fallbackContext: I18nContextValue = {
  locale: "en",
  setLocale: () => undefined,
  t: (key, variables) => formatMessage(messages.en[key], variables),
};

const I18nContext = createContext<I18nContextValue>(fallbackContext);

export function I18nProvider({ children }: PropsWithChildren): JSX.Element {
  const [locale, setLocale] = useState<LanguagePreset>(readInitialLanguage);

  useEffect(() => {
    applyLanguagePresetToDocument(locale);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
    }
  }, [locale]);

  const t = useCallback((key: TranslationKey, variables?: TranslationVariables): string => {
    const localeMessages = messages[locale] as Record<string, string>;
    const template = localeMessages[key] ?? messages.en[key];
    return formatMessage(template, variables);
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export function useT(): I18nContextValue["t"] {
  return useI18n().t;
}

export type { LanguagePreset, TranslationKey };
export type { I18nContextValue };

