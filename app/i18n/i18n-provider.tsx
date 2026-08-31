"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { de } from "./messages/de";
import { en } from "./messages/en";
import { fr } from "./messages/fr";
import { it } from "./messages/it";
import type { Locale, MessageKey, Messages, TranslationValues } from "./types";

const STORAGE_KEY = "timmy-timer-language";
const LANGUAGE_CHANGE_EVENT = "timmy-timer-language-change";
const DEFAULT_LOCALE: Locale = "en";
let memoryLocale: Locale = DEFAULT_LOCALE;

const messages: Record<Locale, Messages> = { en, it, fr, de };

export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-GB",
  it: "it-IT",
  fr: "fr-FR",
  de: "de-DE",
};

export const LANGUAGE_OPTIONS: Array<{
  locale: Locale;
  labelKey: MessageKey;
}> = [
  { locale: "en", labelKey: "settings.language.english" },
  { locale: "it", labelKey: "settings.language.italian" },
  { locale: "fr", labelKey: "settings.language.french" },
  { locale: "de", labelKey: "settings.language.german" },
];

type I18nContextValue = {
  locale: Locale;
  localeTag: string;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: TranslationValues) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getStoredLocale,
    () => DEFAULT_LOCALE,
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    memoryLocale = nextLocale;
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {
      // Keep the preference in memory when storage is unavailable.
    }
    window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
  }, []);

  const t = useCallback(
    (key: MessageKey, values: TranslationValues = {}) =>
      interpolate(messages[locale][key], values),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, localeTag: LOCALE_TAGS[locale], setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "it" || value === "fr" || value === "de";
}

function getStoredLocale(): Locale {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(value)) memoryLocale = value;
    return memoryLocale;
  } catch {
    return memoryLocale;
  }
}

function subscribeToLocale(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);
  };
}

function interpolate(message: string, values: TranslationValues) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    message,
  );
}
