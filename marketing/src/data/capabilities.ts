// Everything AIVOT does today, categorised. Verified against the codebase
// (backend: catalog / scheduling / store / accounts; frontend/src). Only real
// claims — no roadmap, no vapourware.
import type { Lang } from "../lib/i18n";

export interface Capability {
  title: string;
  tagline: string;
  icon: string; // inline SVG (lucide-style), rendered with set:html
  items: string[];
}

interface CapabilitiesSection {
  eyebrow: string;
  title: string;
  subtitle: string;
  capabilities: Capability[];
}

// Icons are shared across languages.
const ICON = {
  engine: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>`,
  catalog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 4v16a2 2 0 0 0 2 2h14M4 4h12a2 2 0 0 1 2 2v10M8 8h6M8 12h6M8 16h4"/></svg>`,
  explain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  store: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 9V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3M3 9l1.5 10.5A2 2 0 0 0 6.5 21h11a2 2 0 0 0 2-1.5L21 9M3 9h18M9 13h6"/></svg>`,
  archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>`,
  lang: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>`,
  security: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>`,
  cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6-1.6A4 4 0 0 0 6 19h11.5Z"/></svg>`,
};

export const capabilitiesSection: Record<Lang, CapabilitiesSection> = {
  en: {
    eyebrow: "Everything you need",
    title: "One engine, every kind of schedule",
    subtitle:
      "The solver never changes — the variety lives in the rules. From nurse rotas to shift plans, here is what AIVOT does today.",
    capabilities: [
      {
        title: "The CP-SAT engine",
        tagline: "Optimal, not just feasible.",
        icon: ICON.engine,
        items: [
          "Google OR-Tools CP-SAT under the hood",
          "Finds the best schedule, not the first that fits",
          "Deterministic and repeatable results",
          "Configurable solve time limit per run",
        ],
      },
      {
        title: "Rule catalog",
        tagline: "The whole variety, none of the code.",
        icon: ICON.catalog,
        items: [
          "Composable constraints: coverage, rest, max/min shifts, fairness, forbidden pairings",
          "Tune each rule's parameters per project",
          "Mix hard rules (must hold) and soft ones (preferences)",
          "No engine changes to add a new kind of problem",
        ],
      },
      {
        title: "Explainable infeasibility",
        tagline: "When it can't, it says why.",
        icon: ICON.explain,
        items: [
          "No valid schedule? It names the conflicting rules",
          "Pinpoints the smallest set that makes it impossible",
          "Relax the right constraint instead of guessing",
          "Turns a dead end into a decision",
        ],
      },
      {
        title: "Recipe store",
        tagline: "Reuse a rule set in one click.",
        icon: ICON.store,
        items: [
          "Publish a working set of rules as a reusable recipe",
          "Install a recipe into any project",
          "Start from a proven template, not a blank page",
          "Share patterns across teams and projects",
        ],
      },
      {
        title: "Schedules & archive",
        tagline: "Every plan, saved and exportable.",
        icon: ICON.archive,
        items: [
          "Every run saved with its diagnostics",
          "Export any schedule to CSV",
          "Compare, revisit and re-run past plans",
          "Keep a history of what was scheduled and why",
        ],
      },
      {
        title: "Share & embed",
        tagline: "Send a plan, or drop it in a page.",
        icon: ICON.share,
        items: [
          "Share a computed schedule with a link",
          "Embed a read-only schedule anywhere",
          "Revoke access in one click",
          "No login required to view a shared plan",
        ],
      },
      {
        title: "Bilingual & clear",
        tagline: "The whole app in your language.",
        icon: ICON.lang,
        items: [
          "Full English and Italian interface",
          "Switch language live, no reload",
          "Errors and explanations localised too",
          "Backend responds in the interface language",
        ],
      },
      {
        title: "Accounts & security",
        tagline: "Sign in the way you prefer.",
        icon: ICON.security,
        items: [
          "Email + password, or Continue with Google",
          "Password reset by email (Brevo)",
          "Token-based REST API auth",
          "Django backoffice for administration",
        ],
      },
      {
        title: "Self-host or cloud",
        tagline: "Yours to run, anywhere.",
        icon: ICON.cloud,
        items: [
          "One command to run locally: docker compose up",
          "One-click deploy to Google Cloud (Cloud Run, Cloud SQL, Firebase)",
          "Background jobs via Cloud Tasks (emails, solver runs)",
          "Open source, GPL-3.0 — no lock-in",
        ],
      },
    ],
  },
  it: {
    eyebrow: "Tutto quello che serve",
    title: "Un motore, ogni tipo di pianificazione",
    subtitle:
      "Il solutore non cambia mai — la varietà vive nelle regole. Dai turni infermieristici ai piani di reparto, ecco cosa fa AIVOT oggi.",
    capabilities: [
      {
        title: "Il motore CP-SAT",
        tagline: "Ottimo, non solo ammissibile.",
        icon: ICON.engine,
        items: [
          "Google OR-Tools CP-SAT sotto il cofano",
          "Trova la pianificazione migliore, non la prima che regge",
          "Risultati deterministici e ripetibili",
          "Limite di tempo di calcolo configurabile per run",
        ],
      },
      {
        title: "Catalogo regole",
        tagline: "Tutta la varietà, zero codice.",
        icon: ICON.catalog,
        items: [
          "Vincoli componibili: copertura, riposo, turni max/min, equità, coppie vietate",
          "Regola i parametri di ogni regola per progetto",
          "Mescola regole rigide (devono valere) e morbide (preferenze)",
          "Nessuna modifica al motore per un nuovo tipo di problema",
        ],
      },
      {
        title: "Infeasibility spiegata",
        tagline: "Quando non può, dice perché.",
        icon: ICON.explain,
        items: [
          "Nessuna pianificazione valida? Nomina le regole in conflitto",
          "Individua l'insieme minimo che la rende impossibile",
          "Allenti il vincolo giusto invece di tirare a indovinare",
          "Trasforma un vicolo cieco in una decisione",
        ],
      },
      {
        title: "Store ricette",
        tagline: "Riusa un set di regole in un clic.",
        icon: ICON.store,
        items: [
          "Pubblica un set di regole funzionante come ricetta riusabile",
          "Installa una ricetta in qualunque progetto",
          "Parti da un modello provato, non dal foglio bianco",
          "Condividi schemi tra team e progetti",
        ],
      },
      {
        title: "Pianificazioni & archivio",
        tagline: "Ogni piano, salvato ed esportabile.",
        icon: ICON.archive,
        items: [
          "Ogni run salvato con la sua diagnostica",
          "Esporta qualunque pianificazione in CSV",
          "Confronta, riapri e rilancia i piani passati",
          "Uno storico di cosa è stato pianificato e perché",
        ],
      },
      {
        title: "Condividi & incorpora",
        tagline: "Invia un piano, o mettilo in pagina.",
        icon: ICON.share,
        items: [
          "Condividi una pianificazione calcolata con un link",
          "Incorpora una pianificazione in sola lettura ovunque",
          "Revoca l'accesso in un clic",
          "Nessun login per vedere un piano condiviso",
        ],
      },
      {
        title: "Bilingue & chiaro",
        tagline: "Tutta l'app nella tua lingua.",
        icon: ICON.lang,
        items: [
          "Interfaccia completa in italiano e inglese",
          "Cambia lingua al volo, senza ricaricare",
          "Anche errori e spiegazioni localizzati",
          "Il backend risponde nella lingua dell'interfaccia",
        ],
      },
      {
        title: "Account & sicurezza",
        tagline: "Accedi come preferisci.",
        icon: ICON.security,
        items: [
          "Email + password, oppure Continua con Google",
          "Reset password via email (Brevo)",
          "Autenticazione API REST a token",
          "Backoffice Django per l'amministrazione",
        ],
      },
      {
        title: "Self-host o cloud",
        tagline: "Tuo da eseguire, ovunque.",
        icon: ICON.cloud,
        items: [
          "Un comando in locale: docker compose up",
          "Deploy in un clic su Google Cloud (Cloud Run, Cloud SQL, Firebase)",
          "Job in background via Cloud Tasks (email, run del solutore)",
          "Open source, GPL-3.0 — nessun lock-in",
        ],
      },
    ],
  },
};
