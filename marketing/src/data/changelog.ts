// Changelog / "What's new". Most recent entry ON TOP. Adding a release =
// adding an object here and pushing: CI redeploys the site automatically.
import type { Lang } from "../lib/i18n";

export interface ChangelogEntry {
  date: string; // YYYY-MM-DD
  version: string;
  changes: string[];
}

interface ChangelogSection {
  title: string;
  subtitle: string;
  entries: ChangelogEntry[];
}

export const changelogSection: Record<Lang, ChangelogSection> = {
  en: {
    title: "What's new",
    subtitle: "Recent changes.",
    entries: [
      {
        date: "2026-07-07",
        version: "1.0.0",
        changes: [
          "First public release of AIVOT.",
          "CP-SAT engine (Google OR-Tools) with an explainable-infeasibility report.",
          "Rule catalog, recipe store, schedule archive with CSV export, share & embed.",
          "Bilingual EN/IT, Google Sign-In, and a one-click Google Cloud deploy.",
        ],
      },
    ],
  },
  it: {
    title: "Novità",
    subtitle: "Cosa è cambiato di recente.",
    entries: [
      {
        date: "2026-07-07",
        version: "1.0.0",
        changes: [
          "Primo rilascio pubblico di AIVOT.",
          "Motore CP-SAT (Google OR-Tools) con report di infeasibility spiegata.",
          "Catalogo regole, store ricette, archivio pianificazioni con export CSV, condivisione ed embed.",
          "Bilingue IT/EN, accesso con Google e deploy su Google Cloud in un clic.",
        ],
      },
    ],
  },
};
