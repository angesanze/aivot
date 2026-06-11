import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { familyLabel, FAMILY_COLORS, EmptyState, inputCls } from "./ui.jsx";
import { SearchIcon } from "./icons.jsx";
import { useT } from "../i18n.jsx";

/* Ordine di presentazione delle famiglie: dalle regole strutturali
   alle personalizzazioni individuali. */
const FAMILY_ORDER = ["base", "copertura", "capacita", "sequenza",
                      "equita", "preferenze", "persone", "custom"];

/* Match su nome, descrizione e parametri: chi cerca "notte" deve trovare
   anche le regole che parlano di notti solo nella descrizione. */
const matches = (t, q) => {
  if (!q) return true;
  const hay = [
    t.name,
    t.description,
    t.code,
    ...t.param_schema.map((p) => p.label || p.name),
  ]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
};

function TemplateCard({ t: tpl }) {
  const t = useT();
  return (
    <article className="bg-white/70 backdrop-blur border border-slate-200/70 rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.06)] p-4 hover:shadow-[0_4px_24px_rgba(15,23,42,0.1)] hover:border-emerald-300 transition-all">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="font-semibold">{tpl.name}</h4>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
            tpl.default_nature === "hard"
              ? "bg-slate-900 text-white"
              : "bg-emerald-100 text-emerald-700"
          }`}
          title={t("catalog.nature_title")}
        >
          {tpl.default_nature === "hard"
            ? t("catalog.nature_hard")
            : t("catalog.nature_soft")}
        </span>
      </div>
      <span
        className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1.5 ${
          FAMILY_COLORS[tpl.family] || "bg-slate-100 text-slate-600"
        }`}
      >
        {familyLabel(t, tpl.family)}
      </span>
      <p className="text-sm text-muted mt-2">{tpl.description}</p>
      {tpl.param_schema.length > 0 && (
        <p className="text-xs text-muted mt-3">
          <span className="font-semibold">{t("catalog.params_label")}</span>{" "}
          {tpl.param_schema.map((p) => p.label || p.name).join(" · ")}
        </p>
      )}
    </article>
  );
}

export default function Catalog() {
  const t = useT();
  const [templates, setTemplates] = useState([]);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState(null); // null = tutte
  const [nature, setNature] = useState(null); // null | hard | soft
  const [error, setError] = useState(null);

  useEffect(() => {
    api.templates().then(setTemplates).catch((e) => setError(e.message));
  }, []);

  const families = FAMILY_ORDER.filter((f) =>
    templates.some((t) => t.family === f)
  );

  const filtered = useMemo(
    () =>
      templates.filter(
        (t) =>
          matches(t, query) &&
          (!family || t.family === family) &&
          (!nature || t.default_nature === nature)
      ),
    [templates, query, family, nature]
  );

  const countBy = (f) =>
    templates.filter((t) => t.family === f && matches(t, query)).length;

  const chip = (active, extra = "") =>
    `text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${extra} ${
      active
        ? "bg-slate-900 text-white border-slate-900 shadow-md"
        : "bg-white/70 text-slate-600 border-slate-200 hover:border-slate-400"
    }`;

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
          {t("catalog.title")}
        </h2>
        <p className="text-muted text-[15px] mt-3 leading-relaxed">
          {t("catalog.desc")}
        </p>
      </header>

      {/* Barra di ricerca e filtri: sticky per restare a portata di mano
          quando il catalogo si allunga. */}
      <div className="sticky top-0 z-20 -mx-2 px-2 py-3 bg-ink/80 backdrop-blur-md space-y-3">
        <label className="relative block max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("catalog.search_placeholder")}
            className={`${inputCls} mt-0 pl-9`}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setFamily(null)} className={chip(!family)}>
            {t("catalog.all_chip", {
              n: templates.filter((tpl) => matches(tpl, query)).length,
            })}
          </button>
          {families.map((f) => (
            <button
              key={f}
              onClick={() => setFamily(family === f ? null : f)}
              className={chip(family === f)}
            >
              {familyLabel(t, f)} · {countBy(f)}
            </button>
          ))}
          <span className="w-px h-5 bg-slate-300 mx-1 hidden sm:block" />
          {[
            ["hard", t("catalog.hard_chip")],
            ["soft", t("catalog.soft_chip")],
          ].map(([n, label]) => (
            <button
              key={n}
              onClick={() => setNature(nature === n ? null : n)}
              className={chip(nature === n)}
              title={t("catalog.nature_filter_title")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="font-mono text-sm text-danger">
          {t("catalog.error", { error })}
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState>{t("catalog.empty")}</EmptyState>
      ) : family || query || nature ? (
        /* Con filtri attivi: lista piatta, ordinata per famiglia. */
        <div className="grid md:grid-cols-2 gap-3">
          {FAMILY_ORDER.flatMap((f) =>
            filtered.filter((t) => t.family === f)
          ).map((t) => (
            <TemplateCard key={t.id} t={t} />
          ))}
        </div>
      ) : (
        /* Senza filtri: sezioni per famiglia, per farsi un'idea d'insieme. */
        families.map((f) => (
          <section key={f}>
            <h3
              className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 ${
                FAMILY_COLORS[f] || "bg-slate-100 text-slate-600"
              }`}
            >
              {familyLabel(t, f)}
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {filtered
                .filter((t) => t.family === f)
                .map((t) => (
                  <TemplateCard key={t.id} t={t} />
                ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
