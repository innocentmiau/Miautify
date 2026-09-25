import i18next, { type TFunction } from "i18next";
import en from "../locales/en.json" with { type: "json" };

// English is the source language. A new language is one more JSON file added here.
export const resources = {
  en: { translation: en },
} as const;

export const fallbackLanguage = "en";

// Takes the system's preferred languages in order ("pt-PT", "en-US", ...) and returns the
// first one we have a translation for, matching on the base language ("pt", "en").
export function pickLanguage(preferred: readonly string[]): string {
  for (const tag of preferred) {
    const base = tag.split("-")[0].toLowerCase();
    if (base in resources) {
      return base;
    }
  }
  return fallbackLanguage;
}

export async function initI18n(language: string): Promise<TFunction> {
  return i18next.init({
    lng: language,
    fallbackLng: fallbackLanguage,
    resources,
    // Escaping is for HTML. We only put translated text in with textContent, never
    // innerHTML, so escaping here would show "&amp;" instead of "&".
    interpolation: { escapeValue: false },
  });
}
