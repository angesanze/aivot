// The 5-step flow that takes you from an empty project to a solved schedule.
// Matches the app's real wizard: Project → People → Rules → Shifts → Plan
// (Progetto → Persone → Regole → Turni → Pianifica).
import type { Lang } from "../lib/i18n";

export interface Step {
  n: number;
  name: string;
  desc: string;
}

interface StepsSection {
  eyebrow: string;
  title: string;
  subtitle: string;
  steps: Step[];
}

export const stepsSection: Record<Lang, StepsSection> = {
  en: {
    eyebrow: "From blank page to plan",
    title: "Five steps to a schedule",
    subtitle:
      "No spreadsheets, no manual juggling. You describe the problem; the engine does the solving.",
    steps: [
      { n: 1, name: "Project", desc: "Create a project — a self-contained scheduling problem you can revisit and re-run anytime." },
      { n: 2, name: "People", desc: "Add the people (or resources) to schedule, with their availability and attributes." },
      { n: 3, name: "Rules", desc: "Pick rules from the catalog: coverage, rest between shifts, max shifts, fairness, forbidden pairings…" },
      { n: 4, name: "Shifts", desc: "Define the shifts to fill across the horizon — mornings, afternoons, nights, whatever your days look like." },
      { n: 5, name: "Plan", desc: "Run the solver. Get the optimal schedule in seconds — or a clear explanation of which rules make it impossible." },
    ],
  },
  it: {
    eyebrow: "Dal foglio bianco al piano",
    title: "Cinque passi a una pianificazione",
    subtitle:
      "Niente fogli di calcolo, niente incastri a mano. Tu descrivi il problema; il motore lo risolve.",
    steps: [
      { n: 1, name: "Progetto", desc: "Crea un progetto — un problema di pianificazione a sé, che puoi riaprire e rilanciare quando vuoi." },
      { n: 2, name: "Persone", desc: "Aggiungi le persone (o risorse) da pianificare, con disponibilità e attributi." },
      { n: 3, name: "Regole", desc: "Scegli le regole dal catalogo: copertura, riposo tra i turni, turni massimi, equità, coppie vietate…" },
      { n: 4, name: "Turni", desc: "Definisci i turni da coprire sull'orizzonte — mattine, pomeriggi, notti, qualunque sia la tua giornata." },
      { n: 5, name: "Pianifica", desc: "Lancia il motore. Ottieni la pianificazione ottima in pochi secondi — o una spiegazione chiara di quali regole la rendono impossibile." },
    ],
  },
};
