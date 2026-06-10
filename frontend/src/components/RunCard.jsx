import React, { useState } from "react";
import { api } from "../api";
import { codeColors } from "./ui.jsx";

/* Esiti del solver tradotti per chi non sa cos'è CP-SAT. */
export const STATUS_INFO = {
  OPTIMAL: {
    label: "Ottimale",
    cls: "bg-emerald-100 text-emerald-700",
    desc: "Trovata la migliore pianificazione possibile con queste regole.",
  },
  FEASIBLE: {
    label: "Valida",
    cls: "bg-emerald-100 text-emerald-700",
    desc: "Trovata una pianificazione valida entro il tempo limite. Potrebbe esisterne una migliore: riprova con più tempo.",
  },
  INFEASIBLE: {
    label: "Impossibile",
    cls: "bg-rose-100 text-rose-700",
    desc: "Nessuna pianificazione rispetta tutti gli obblighi: alcuni sono in conflitto tra loro.",
  },
  ERROR: { label: "Errore", cls: "bg-rose-100 text-rose-700", desc: "Qualcosa è andato storto durante il calcolo." },
  UNKNOWN: {
    label: "Tempo esaurito",
    cls: "bg-amber-100 text-amber-700",
    desc: "Il tempo limite è scaduto prima di un esito. Aumentalo e riprova.",
  },
  RUNNING: { label: "In corso", cls: "bg-amber-100 text-amber-700", desc: "" },
  PENDING: { label: "In attesa", cls: "bg-slate-100 text-slate-500", desc: "" },
};

/* Esito tecnicamente riuscito ma con griglia vuota: senza spiegazione
   sembra un errore, quindi va evidenziato a parte. */
export const isEmptyOk = (run) =>
  ["OPTIMAL", "FEASIBLE"].includes(run.status) && run.assignments.length === 0;

/* Fallback per le run salvate prima che il backend generasse la motivazione. */
const FALLBACK_EMPTY_EXPLANATION =
  "Il calcolo è riuscito, ma nessuna regola attiva obbliga ad assegnare " +
  "qualcuno: la griglia vuota rispetta tutti gli obblighi (le regole di " +
  "capacità mettono solo un tetto, non un minimo). Aggiungi una regola " +
  "«copertura minima» per riempire la griglia.";

export const runTitle = (run) => run.name || `Pianificazione #${run.id}`;

/* Griglia turni: persone × giorni, celle = codici turno assegnati.
   Esportata: la usa anche la pagina pubblica del widget (/embed). */
export function ScheduleGrid({ run, resources, slots }) {
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
    const header = ["Persona", ...days];
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
    a.download = `pianificazione-${run.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="text-sm font-mono">
          <thead>
            <tr className="text-muted text-xs">
              <th className="text-left py-2 pr-4 font-normal">Persona</th>
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
          <span>· = riposo</span>
        </p>
        <button
          onClick={exportCsv}
          className="ml-auto text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm hover:shadow transition-all"
        >
          ↓ Esporta CSV
        </button>
      </div>
    </div>
  );
}

/* Widget embeddabile: genera il link pubblico e lo snippet <iframe>
   da incollare in un sito. Revocabile in ogni momento. */
function EmbedPanel({ run }) {
  const [token, setToken] = useState(run.share_token || "");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const snippet = token
    ? `<iframe src="${window.location.origin}/embed/${token}" width="100%" height="420" style="border:0;border-radius:12px" loading="lazy" title="${runTitle(run)}"></iframe>`
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
        Widget per il tuo sito
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
            &lt;/&gt; Genera codice widget
          </button>
          <span className="text-xs text-muted">
            Crea un link pubblico: chiunque abbia il codice vedrà questa
            griglia (nomi inclusi), dentro qualunque pagina web.
          </span>
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
              {copied ? "✓ Copiato" : "Copia codice"}
            </button>
            <a
              href={`/embed/${token}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-op underline underline-offset-2"
            >
              Anteprima
            </a>
            <button
              onClick={() =>
                call(() => api.unshareRun(run.id), () => setToken(""))
              }
              disabled={busy}
              className="ml-auto text-xs font-medium text-danger/70 hover:text-danger"
            >
              Revoca il widget
            </button>
          </div>
          <p className="text-xs text-muted">
            La revoca spegne il widget ovunque sia stato incollato.
          </p>
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
  const info = STATUS_INFO[run.status] || STATUS_INFO.UNKNOWN;
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
            {runTitle(run)}
          </span>
          <span className="font-mono text-xs text-muted">
            #{run.id} · {new Date(run.created_at).toLocaleString("it-IT")}
          </span>
          {run.wall_time != null && (
            <span className="font-mono text-xs text-muted">
              calcolata in {run.wall_time}s
            </span>
          )}
          {run.objective != null && run.objective > 0 && (
            <span
              className="font-mono text-xs text-warn"
              title="Somma dei pesi delle preferenze violate: più basso è, meglio è"
            >
              penalità {run.objective}
            </span>
          )}
          <span
            className={`ml-auto font-mono text-xs ${
              isEmptyOk(run) ? "text-warn font-semibold" : "text-muted"
            }`}
          >
            {run.assignments.length} assegnazioni {open ? "▾" : "▸"}
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
                {isEmptyOk(run)
                  ? "Perché zero assegnazioni?"
                  : "Perché questo risultato?"}
              </p>
              <p>{run.explanation || FALLBACK_EMPTY_EXPLANATION}</p>
              {isEmptyOk(run) && (
                <button
                  onClick={() => onGoTo("rules")}
                  className="mt-2 text-op underline underline-offset-2"
                >
                  Vai alle regole
                </button>
              )}
            </div>
          )}
          {run.status === "INFEASIBLE" && (
            <div className="space-y-2">
              <p className="text-danger text-sm font-medium">
                Questi obblighi non possono valere tutti insieme:
              </p>
              <ul className="font-mono text-sm text-paper">
                {run.conflicts.map((c) => (
                  <li key={c}>· {c}</li>
                ))}
              </ul>
              <p className="text-sm text-muted">
                Per sbloccare: trasformane uno in preferenza, allenta i
                suoi valori, oppure aggiungi persone o turni.{" "}
                <button
                  onClick={() => onGoTo("rules")}
                  className="text-op underline underline-offset-2"
                >
                  Vai alle regole
                </button>
              </p>
            </div>
          )}
          {run.violations.length > 0 && (
            <div>
              <p className="text-warn text-sm font-medium mb-1">
                Preferenze non rispettate del tutto:
              </p>
              <ul className="font-mono text-xs text-muted">
                {run.violations.map((v, i) => (
                  <li key={i}>
                    · {v.constraint} (violata ×{v.amount}, costo {v.cost})
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
