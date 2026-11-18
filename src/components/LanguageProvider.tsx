"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: Dictionary;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: "en",
  setLocale: () => {},
  t: getDictionary("en"),
});

export function LanguageProvider({
  initialLocale = "en",
  children,
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("lang");
      if (q === "id" || q === "en") {
        setLocaleState(q);
        localStorage.setItem("affilora_lang", q);
        document.cookie = `jingle_lang=${q};path=/;max-age=31536000;SameSite=Lax`;
        return;
      }
      const saved = localStorage.getItem("affilora_lang");
      if (saved === "id" || saved === "en") {
        setLocaleState(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem("affilora_lang", next);
      document.cookie = `jingle_lang=${next};path=/;max-age=31536000;SameSite=Lax`;
    } catch {
      // ignore
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        locale,
        setLocale,
        t: getDictionary(locale),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
