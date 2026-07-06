// Global copy and links. Edit here — every component reads from this file.
import type { Lang } from "../lib/i18n";

export const site = {
  name: "AIVOT",
  url: "https://aivot.rocks",
  // theme accent (emerald) — matches the logo gradient #34d399 → #0d9488
  themeColor: "#10b981",
};

// Language-independent links.
// NOTE: the app has no /register or /login route — its root shows the
// login/registration screen — so every app CTA points at the bare app URL.
export const links = {
  app: "https://app.aivot.rocks",
  docs: "https://angesanze.github.io/aivot/",
  github: "https://github.com/angesanze/aivot",
  email: "hello@aivot.rocks",
};

interface Stat {
  value: string;
  label: string;
}

interface SiteCopy {
  htmlLang: string;
  metaTitle: string; // <title>
  metaDescription: string;
  tagline: string;
  description: string;
  heroBadge: string;
  nav: { how: string; features: string; solver: string; docs: string };
  cta: { try: string; docs: string; login: string; open: string };
  stats: Stat[];
  footer: { tagline: string; contact: string; rights: string };
}

export const copy: Record<Lang, SiteCopy> = {
  en: {
    htmlLang: "en",
    metaTitle: "AIVOT — Every constraint, a solution",
    metaDescription:
      "AIVOT turns people, shifts and rules into the optimal schedule. A CP-SAT engine (Google OR-Tools) finds the best plan — and when none exists, it explains which rules conflict.",
    tagline: "Every constraint, a solution.",
    description:
      "Describe your people, shifts and rules — AIVOT's CP-SAT engine (Google OR-Tools) computes the optimal schedule. And when no schedule can satisfy every rule, it tells you exactly which ones conflict.",
    heroBadge: "Open source · CP-SAT · IT / EN",
    nav: { how: "How it works", features: "Features", solver: "The solver", docs: "Docs" },
    cta: { try: "Try it free", docs: "Documentation", login: "Log in", open: "Open the app" },
    stats: [
      { value: "1", label: "solver engine (CP-SAT)" },
      { value: "5", label: "steps to a schedule" },
      { value: "IT · EN", label: "interface" },
      { value: "REST", label: "API + embeds" },
    ],
    footer: {
      tagline: "Constraint-based scheduling, made explainable.",
      contact: "Contact",
      rights: "Open source · GPL-3.0",
    },
  },
  it: {
    htmlLang: "it",
    metaTitle: "AIVOT — Ogni vincolo, una soluzione",
    metaDescription:
      "AIVOT trasforma persone, turni e regole nella pianificazione ottima. Un motore CP-SAT (Google OR-Tools) trova il piano migliore — e quando non esiste, spiega quali regole sono in conflitto.",
    tagline: "Ogni vincolo, una soluzione.",
    description:
      "Descrivi persone, turni e regole — il motore CP-SAT di AIVOT (Google OR-Tools) calcola la pianificazione ottima. E quando nessuna pianificazione può rispettare tutte le regole, ti dice esattamente quali sono in conflitto.",
    heroBadge: "Open source · CP-SAT · IT / EN",
    nav: { how: "Come funziona", features: "Funzioni", solver: "Il motore", docs: "Docs" },
    cta: { try: "Provalo gratis", docs: "Documentazione", login: "Accedi", open: "Apri l'app" },
    stats: [
      { value: "1", label: "motore solutore (CP-SAT)" },
      { value: "5", label: "passi a una pianificazione" },
      { value: "IT · EN", label: "interfaccia" },
      { value: "REST", label: "API + embed" },
    ],
    footer: {
      tagline: "Pianificazione a vincoli, resa spiegabile.",
      contact: "Contatti",
      rights: "Open source · GPL-3.0",
    },
  },
};
