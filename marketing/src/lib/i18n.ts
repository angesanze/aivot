// Bilingual helpers. English is the default locale (served at /), Italian at
// /it/. Every data file exports content keyed by these two locales.
export type Lang = "en" | "it";

export const LOCALES: Lang[] = ["en", "it"];

// Root-relative home path for a locale (EN default → no prefix).
export const homeHref = (lang: Lang): string => (lang === "en" ? "/" : "/it/");

export const OTHER: Record<Lang, Lang> = { en: "it", it: "en" };

export const LABEL: Record<Lang, string> = { en: "EN", it: "IT" };
