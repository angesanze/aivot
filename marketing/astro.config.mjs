// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Static marketing site for aivot.rocks. Output → dist/, served by the "www"
// Firebase Hosting target (see ../firebase.json). The app itself (the planner)
// lives on the separate "app" target (app.aivot.rocks).
//
// Bilingual: English is the default (served at /), Italian at /it/. Content is
// keyed by locale in src/data/*.ts; each component takes a `lang` prop.
export default defineConfig({
  site: "https://aivot.rocks",
  i18n: {
    defaultLocale: "en",
    locales: ["en", "it"],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
