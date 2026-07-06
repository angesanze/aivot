// Conversion section instead of a price list. Deliberate: no price numbers,
// just a strong CTA to try the app. If you ever add paid plans, put the data
// here and adapt Offer.astro.
import { links } from "./site";
import type { Lang } from "../lib/i18n";

interface Offer {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  includes: string[];
}

export const offer: Record<Lang, Offer> = {
  en: {
    eyebrow: "Early access",
    title: "Try it now, free",
    subtitle:
      "Create a project and get your first optimal schedule in minutes. No credit card, no commitment.",
    primaryCta: { label: "Try it free", href: links.app },
    secondaryCta: { label: "Read the docs", href: links.docs },
    includes: [
      "Unlimited projects and runs",
      "The full rule catalog",
      "Explained infeasibility on every run",
      "Recipe store to reuse rule sets",
      "CSV export, share and embed",
      "English / Italian, switchable live",
    ],
  },
  it: {
    eyebrow: "Accesso anticipato",
    title: "Provalo adesso, gratis",
    subtitle:
      "Crea un progetto e ottieni la prima pianificazione ottima in pochi minuti. Nessuna carta di credito, nessun impegno.",
    primaryCta: { label: "Provalo gratis", href: links.app },
    secondaryCta: { label: "Leggi la documentazione", href: links.docs },
    includes: [
      "Progetti e run illimitati",
      "Il catalogo regole completo",
      "Infeasibility spiegata a ogni run",
      "Store ricette per riusare i set di regole",
      "Export CSV, condivisione ed embed",
      "Italiano / inglese, cambio al volo",
    ],
  },
};
