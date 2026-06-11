import React, { useState } from "react";
import { api } from "../api";
import { codeColors } from "./ui.jsx";
import { useT, useLocale } from "../i18n.jsx";

/* Esiti del solver tradotti per chi non sa cos'è CP-SAT.
   Le classi restano qui; etichette e descrizioni vivono nei dizionari
   i18n e si risolvono al render con statusInfo(t, status). */
const STATUS_CLS = {
  OPTIMAL: "bg-emerald-100 text-emerald-700",
  FEASIBLE: "bg-emerald-100 text-emerald-700",
  INFEASIBLE: "bg-rose-100 text-rose-700",
  ERROR: "bg-rose-100 text-rose-700",
  UNKNOWN: "bg-amber-100 text-amber-700",
  RUNNING: "bg-amber-100 text-amber-700",
  PENDING: "bg-slate-100 text-slate-500",
};

/* Stati senza descrizione (transitori). */
const NO_DESC = ["RUNNING", "PENDING"];

export const statusInfo = (t, status) => {
  const key = STATUS_CLS[status] ? status : "UNKNOWN";
  return {
    label: t(`status.${key}.label`),
    cls: STATUS_CLS[key],
    desc: NO_DESC.includes(key) ? "" : t(`status.${key}.desc`),
  };
};

/* Esito tecnicamente riuscito ma con griglia vuota: senza spiegazione
   sembra un errore, quindi va evidenziato a parte. */
export const isEmptyOk = (run) =>
  ["OPTIMAL", "FEASIBLE"].includes(run.status) && run.assignments.length === 0;

export const runTitle = (t, run) => run.name || t("run.title", { id: run.id });

/* Griglia turni: persone × giorni, celle = codici turno assegnati.
   Esportata: la usa anche la pagina pubblica del widget (/embed). */
export function ScheduleGrid({ run, resources, slots }) {
  const t = useT();
  const slotById = Object.fromEntries(slots.map((s) => [s.id, s]));
  const days = [...new Set(slots.map((s) => s.day))].sort();
  const byResource = {};
  run.assignments.forEach((a) => {
    const s = slotById[a.slot_id];
    if (!s) return;
    (byResource[a.resource_id] ??= {})[s.day] = s.code;
  });

  /* Legenda: codice → nome e orario della fascia */
  const legend = {};
  slots.forEach((s) => {
    legend[s.code] ??= s;
  });
  const colorByCode = codeColors(slots.map((s) => s.code));

  const exportCsv = () => {
    const header = [t("run.grid.person"), ...days];
    const rows = resources.map((r) => [
      r.name,
      ...days.map((d) => byResource[r.id]?.[d] ?? ""),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = t("run.grid.csv_filename", { id: run.id });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="text-sm font-mono">
          <thead>
            <tr className="text-muted text-xs">
              <th className="text-left py-2 pr-4 font-normal">{t("run.grid.person")}</th>
              {days.map((d) => (
                <th key={d} className="px-2 py-2 font-normal">
                  {d.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr key={r.id} className="border-t border-line/50">
                <td className="py-1.5 pr-4 font-sans">{r.name}</td>
                {days.map((d) => {
                  const code = byResource[r.id]?.[d];
                  return (
                    <td key={d} className="px-2 py-1.5 text-center">
                      {code ? (
                        <span
                          className={`inline-block min-w-7 px-1.5 py-0.5 rounded-md font-semibold ${
                            colorByCode[code] || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {code}
                        </span>
                      ) : (
                        <span className="text-slate-300">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-xs text-muted flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {Object.values(legend).map((s) => (
            <span key={s.code} className="inline-flex items-center gap-1.5">
              <span
                className={`font-mono font-semibold px-1.5 py-0.5 rounded-md ${
                  colorByCode[s.code] || "bg-slate-100 text-slate-600"
                }`}
              >
                {s.code}
              </span>
              {s.label || s.code}
              {s.start && ` ${s.start.slice(0, 5)}–${s.end?.slice(0, 5)}`}
            </span>
          ))}
          <span>{t("run.grid.rest")}</span>
        </p>
        <button
          onClick={exportCsv}
          className="ml-auto text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm hover:shadow transition-all"
        >
          ↓ {t("run.grid.export_csv")}
        </button>
      </div>
    </div>
  );
}

/* Widget embeddabile: genera il link pubblico e lo snippet <iframe>
   da incollare in un sito. Revocabile in ogni momento. */
function EmbedPanel({ run }) {
  const t = useT();
  const [token, setToken] = useState(run.share_token || "");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const snippet = token
    ? `<iframe src="${window.location.origin}/embed/${token}" width="100%" height="420" style="border:0;border-radius:12px" loading="lazy" title="${runTitle(t, run)}"></iframe>`
    : "";

  const call = async (fn, after) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      after(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-line pt-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        {t("embed.widget_title")}
      </p>
      {!token ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() =>
              call(() => api.shareRun(run.id), (r) => setToken(r.share_token))
            }
            disabled={busy}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm hover:shadow transition-all"
          >
            &lt;/&gt; {t("embed.generate")}
          </button>
          <span className="text-xs text-muted">{t("embed.generate_hint")}</span>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            readOnly
            value={snippet}
            rows={3}
            onFocus={(e) => e.target.select()}
            className="w-full font-mono text-xs bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-paper"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(snippet);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-500 rounded-lg px-3 py-1.5"
            >
              {copied ? `✓ ${t("embed.copied")}` : t("embed.copy")}
            </button>
            <a
              href={`/embed/${token}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-op underline underline-offset-2"
            >
              {t("embed.preview")}
            </a>
            <button
              onClick={() =>
                call(() => api.unshareRun(run.id), () => setToken(""))
              }
              disabled={busy}
              className="ml-auto text-xs font-medium text-danger/70 hover:text-danger"
            >
              {t("embed.revoke")}
            </button>
          </div>
          <p className="text-xs text-muted">{t("embed.revoke_hint")}</p>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/* Scheda di una run: intestazione richiudibile + dettaglio con
   spiegazione, conflitti, violazioni e griglia. `actions` è uno slot
   per i comandi di gestione (rinomina, elimina...) usato dall'archivio. */
export default function RunCard({ run, resources, slots, onGoTo, open, onToggle, actions }) {
  const t = useT();
  const locale = useLocale();
  const info = statusInfo(t, run.status);
  return (
    <article className="bg-white/70 backdrop-blur border border-slate-200/70 rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.06)]">
      <div className="flex items-center px-4">
        <button
          onClick={onToggle}
          className="flex-1 min-w-0 flex flex-wrap items-center gap-4 py-3 text-left"
        >
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${info.cls}`}
          >
            {info.label}
          </span>
          <span className="text-sm font-medium text-paper truncate">
            {runTitle(t, run)}
          </span>
          <span className="font-mono text-xs text-muted">
            #{run.id} · {new Date(run.created_at).toLocaleString(locale)}
          </span>
          {run.wall_time != null && (
            <span className="font-mono text-xs text-muted">
              {t("run.computed_in", { s: run.wall_time })}
            </span>
          )}
          {run.objective != null && run.objective > 0 && (
            <span
              className="font-mono text-xs text-warn"
              title={t("run.penalty_title")}
            >
              {t("run.penalty", { n: run.objective })}
            </span>
          )}
          <span
            className={`ml-auto font-mono text-xs ${
              isEmptyOk(run) ? "text-warn font-semibold" : "text-muted"
            }`}
          >
            {t("run.assignments", { n: run.assignments.length })} {open ? "▾" : "▸"}
          </span>
        </button>
        {actions && <div className="flex items-center gap-1 pl-2 shrink-0">{actions}</div>}
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-line pt-4">
          {info.desc && <p className="text-sm text-muted">{info.desc}</p>}
          {(run.explanation || isEmptyOk(run)) && (
            <div
              className={`text-sm rounded-xl border p-3 ${
                isEmptyOk(run)
                  ? "bg-amber-50/80 border-amber-200 text-amber-900"
                  : "bg-slate-50/80 border-slate-200 text-muted"
              }`}
            >
              <p className="font-medium mb-1">
                {isEmptyOk(run) ? t("run.why_empty") : t("run.why_result")}
              </p>
              <p>{run.explanation || t("run.empty_explanation")}</p>
              {isEmptyOk(run) && (
                <button
                  onClick={() => onGoTo("rules")}
                  className="mt-2 text-op underline underline-offset-2"
                >
                  {t("run.go_to_rules")}
                </button>
              )}
            </div>
          )}
          {run.status === "INFEASIBLE" && (
            <div className="space-y-2">
              <p className="text-danger text-sm font-medium">
                {t("run.infeasible_intro")}
              </p>
              <ul className="font-mono text-sm text-paper">
                {run.conflicts.map((c) => (
                  <li key={c}>· {c}</li>
                ))}
              </ul>
              <p className="text-sm text-muted">
                {t("run.infeasible_help")}{" "}
                <button
                  onClick={() => onGoTo("rules")}
                  className="text-op underline underline-offset-2"
                >
                  {t("run.go_to_rules")}
                </button>
              </p>
            </div>
          )}
          {run.violations.length > 0 && (
            <div>
              <p className="text-warn text-sm font-medium mb-1">
                {t("run.violations_title")}
              </p>
              <ul className="font-mono text-xs text-muted">
                {run.violations.map((v, i) => (
                  <li key={i}>
                    · {v.constraint} ({t("run.violation_detail", { n: v.amount, c: v.cost })})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {run.error && (
            <p className="font-mono text-sm text-danger">{run.error}</p>
          )}
          {run.assignments.length > 0 && (
            <>
              <ScheduleGrid run={run} resources={resources} slots={slots} />
              <EmbedPanel run={run} />
            </>
          )}
        </div>
      )}
    </article>
  );
}
