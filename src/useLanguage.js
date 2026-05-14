import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "foodmap_lang";

export function useLanguage() {
  const [lang, setLangState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || "en";
      return stored === "es" ? "es" : "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}
  }, [lang]);

  const setLang = useCallback((l) => {
    if (l === "en" || l === "es") setLangState(l);
  }, []);

  return { lang, setLang };
}
