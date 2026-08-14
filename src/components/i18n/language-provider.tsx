"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import id from "@/src/i18n/id.json";
import en from "@/src/i18n/en.json";

export type Locale = "id" | "en";
type TranslationKey = keyof typeof id;
type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};

const dictionaries = { id, en };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("id");

  function t(key: TranslationKey, values?: Record<string, string | number>) {
    let text: string = dictionaries[locale][key];
    for (const [name, value] of Object.entries(values ?? {})) text = text.replaceAll(`{${name}}`, String(value));
    return text;
  }

  return <LanguageContext.Provider value={{ locale, setLocale, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
