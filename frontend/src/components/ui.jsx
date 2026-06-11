import React, { useState } from "react";
import { useT } from "../i18n.jsx";

/* Etichetta tradotta per le famiglie di vincoli del catalogo:
   familyLabel(t, "copertura") -> "Copertura" / "Coverage". */
export const familyLabel = (t, family) => {
  const label = t(`family.${family}`);
  return label === `family.${family}` ? family : label;
};

/* Ogni famiglia ha il suo colore: si riconosce a colpo d'occhio. */
export const FAMILY_COLORS = {
  base: "bg-slate-100 text-slate-600",
  copertura: "bg-sky-100 text-sky-700",
  capacita: "bg-violet-100 text-violet-700",
  sequenza: "bg-amber-100 text-amber-700",
  equita: "bg-pink-100 text-pink-700",
  preferenze: "bg-teal-100 text-teal-700",
  persone: "bg-indigo-100 text-indigo-700",
  custom: "bg-fuchsia-100 text-fuchsia-700",
};

/* Palette ciclica per i codici turno (M, P, N, Aula-1…): lo stesso codice
   ha sempre lo stesso colore in tutta l'app. */
const CODE_PALETTE = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-indigo-100 text-indigo-700",
  "bg-rose-100 text-rose-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
];
export const codeColors = (codes) => {
  const map = {};
  [...new Set(codes)].forEach((c, i) => {
    map[c] = CODE_PALETTE[i % CODE_PALETTE.length];
  });
  return map;
};

/* Stili condivisi: bottoni con gradiente e ombra colorata, card in vetro. */
export const btnPrimary =
  "inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0 disabled:cursor-not-allowed";
export const btnGhost =
  "text-sm font-medium text-muted px-4 py-2.5 rounded-xl hover:text-paper hover:bg-slate-900/5 transition-colors";
export const inputCls =
  "mt-1 w-full bg-white/80 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-paper placeholder:text-muted/60 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-shadow";
export const cardCls =
  "bg-white/70 backdrop-blur border border-slate-200/70 rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.06)]";

/* Intestazione di ogni passo: barra di avanzamento + titolo grande. */
export function StepHeader({ step, title, children }) {
  const t = useT();
  return (
    <header className="mb-8 max-w-3xl">
      <div className="flex items-center gap-1.5 mb-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i < step
                ? "w-6 bg-emerald-500/50"
                : i === step
                  ? "w-12 bg-gradient-to-r from-emerald-500 to-teal-400"
                  : "w-6 bg-slate-900/10"
            }`}
          />
        ))}
        <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
          {t("ui.step_of", { n: step })}
        </span>
      </div>
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
        {title}
      </h2>
      {children && (
        <p className="text-muted text-[15px] mt-3 leading-relaxed">{children}</p>
      )}
    </header>
  );
}

/* Riquadro informativo richiudibile: spiega senza invadere. */
export function Hint({ title, children, open: openDefault = false }) {
  const t = useT();
  const [open, setOpen] = useState(openDefault);
  title = title ?? t("ui.hint_title");
  return (
    <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/60 backdrop-blur border border-emerald-200/70 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-emerald-900/80 hover:text-emerald-900"
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-500/30 shrink-0">
          {open ? "−" : "?"}
        </span>
        {title}
      </button>
      {open && (
        <div className="pr-4 pb-4 pl-4 ml-9 text-sm text-slate-600 space-y-2 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

/* Campo con etichetta: niente più label sparse e disallineate. */
export function Field({ label, hint, children }) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

/* Conferma inline in due tempi: niente window.confirm. Il primo click
   trasforma il bottone in "Confermi? Sì / No". */
export function ConfirmButton({ onConfirm, children, confirmLabel, className = "" }) {
  const t = useT();
  const [asking, setAsking] = useState(false);
  confirmLabel = confirmLabel ?? t("ui.confirm");
  if (!asking) {
    return (
      <button onClick={() => setAsking(true)} className={className}>
        {children}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-xs text-danger font-medium whitespace-nowrap">
        {confirmLabel}
      </span>
      <button
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
        className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg px-2.5 py-1"
      >
        {t("ui.confirm_yes")}
      </button>
      <button
        onClick={() => setAsking(false)}
        className="text-xs font-medium text-muted hover:text-paper px-1 py-1"
      >
        {t("ui.confirm_no")}
      </button>
    </span>
  );
}

/* Stato vuoto con invito all'azione: mai una pagina muta. */
export function EmptyState({ children, action }) {
  return (
    <div className="bg-white/50 backdrop-blur border-2 border-dashed border-slate-300/80 rounded-2xl p-10 text-center">
      <p className="text-muted text-sm leading-relaxed max-w-md mx-auto">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
