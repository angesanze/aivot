import React, { useState } from "react";
import { api } from "../api";
import { useDatasetData } from "../hooks/useDatasetData.js";
import { StepHeader, Hint, EmptyState, btnPrimary } from "./ui.jsx";
import RunCard from "./RunCard.jsx";
import { useT } from "../i18n.jsx";

/* Quante run recenti mostrare qui: lo storico completo vive nell'archivio. */
const RECENT = 3;

/* Stati conclusi del solver: appena la run ne raggiunge uno il polling si
   ferma. PENDING/RUNNING significano "ancora in coda/in corso". */
const TERMINAL = ["OPTIMAL", "FEASIBLE", "INFEASIBLE", "ERROR", "UNKNOWN"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Runs({ dsId, dataset, onGoTo }) {
  const t = useT();
  const { resources, slots, runs, error: loadError, refresh } =
    useDatasetData(dsId, { withRuns: true });
  const [timeLimit, setTimeLimit] = useState(30);
  const [solving, setSolving] = useState(false);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState(null);

  const missing = [];
  if (resources.length === 0)
    missing.push({ step: "people", label: t("runs.missing_people") });
  if (slots.length === 0)
    missing.push({ step: "slots", label: t("runs.missing_slots") });
  const noRules = (dataset?.constraints_count ?? 0) === 0;

  const solve = async () => {
    setSolving(true);
    setError(null);
    try {
      let run = await api.solve(dsId, timeLimit);
      setOpen(run.id);
      // In produzione il calcolo gira su Cloud Tasks: la run torna
      // PENDING/RUNNING e si fa polling fino all'esito. In locale arriva
      // già conclusa e il ciclo non parte nemmeno. Tetto di sicurezza:
      // il time limit più un margine, così non si attende all'infinito.
      const deadline = Date.now() + (Number(timeLimit) + 30) * 1000;
      while (!TERMINAL.includes(run.status) && Date.now() < deadline) {
        await sleep(1500);
        // Un blip di rete non deve far fallire il calcolo: il solve gira
        // comunque su Cloud Tasks. Si ignora l'errore e si riprova al giro
        // dopo, fino al tetto di tempo.
        try {
          run = await api.run(run.id);
        } catch (pollErr) {
          console.warn("polling run: errore temporaneo, riprovo", pollErr);
        }
      }
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <StepHeader step={5} title={t("runs.step_title")}>
        {t("runs.step_desc")}
      </StepHeader>

      {missing.length > 0 ? (
        <div className="bg-amber-50/80 backdrop-blur border border-amber-200 rounded-2xl p-4 space-y-2">
          <p className="text-warn text-sm font-medium">
            {t("runs.missing_intro")}
          </p>
          <ul className="text-sm text-muted list-disc ml-5">
            {missing.map((m) => (
              <li key={m.step}>
                {m.label} —{" "}
                <button
                  onClick={() => onGoTo(m.step)}
                  className="text-op hover:text-op-dark underline underline-offset-2"
                >
                  {t("runs.go_to_step")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={solve} disabled={solving} className={btnPrimary}>
            {solving ? t("runs.solving") : `▶ ${t("runs.solve")}`}
          </button>
          <label
            className="text-sm text-muted"
            title={t("runs.time_limit_title")}
          >
            {t("runs.time_limit_before")}{" "}
            <input
              type="number"
              min="1"
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              className="w-16 bg-white/80 border border-slate-200 rounded-lg px-2 py-1 text-paper focus:outline-none focus:border-emerald-500"
            />{" "}
            {t("runs.time_limit_after")}
          </label>
          {noRules && (
            <span className="text-warn text-sm">
              {t("runs.no_rules")}{" "}
              <button
                onClick={() => onGoTo("rules")}
                className="text-op underline underline-offset-2"
              >
                {t("runs.add_rules")}
              </button>
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="font-mono text-sm text-danger">
          {t("runs.solve_error", { msg: error })}
        </p>
      )}
      {loadError && (
        <p className="font-mono text-sm text-danger">
          {t("runs.load_error", { msg: loadError })}{" "}
          <button onClick={refresh} className="underline underline-offset-2">
            {t("common.retry")}
          </button>
        </p>
      )}

      {runs.slice(0, RECENT).map((run) => (
        <RunCard
          key={run.id}
          run={run}
          resources={resources}
          slots={slots}
          onGoTo={onGoTo}
          open={open === run.id}
          onToggle={() => setOpen(open === run.id ? null : run.id)}
        />
      ))}

      {runs.length > RECENT && (
        <p className="text-sm text-muted">
          {t("runs.more", { n: runs.length - RECENT })}{" "}
          <button
            onClick={() => onGoTo("archive")}
            className="text-op underline underline-offset-2"
          >
            {t("runs.open_archive")}
          </button>
        </p>
      )}

      {runs.length === 0 && missing.length === 0 && (
        <EmptyState>{t("runs.empty")}</EmptyState>
      )}

      <Hint title={t("runs.hint_title")}>
        <p>
          <b className="text-op">{t("status.OPTIMAL.label")}</b>
          {t("runs.hint1a")} <b className="text-op">{t("status.FEASIBLE.label")}</b>
          {t("runs.hint1b")}{" "}
          <b className="text-danger">{t("status.INFEASIBLE.label")}</b>
          {t("runs.hint1c")}
        </p>
        <p>
          {t("runs.hint2_pre")} <b className="text-warn">{t("runs.hint2_bold")}</b>{" "}
          {t("runs.hint2_post")}
        </p>
        <p>
          {t("runs.hint3_pre")}{" "}
          <b className="text-op">{t("archive.title")}</b>
          {t("runs.hint3_post")}
        </p>
      </Hint>
    </div>
  );
}
