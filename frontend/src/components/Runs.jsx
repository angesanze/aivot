import React, { useState } from "react";
import { api } from "../api";
import { useDatasetData } from "../hooks/useDatasetData.js";
import { StepHeader, Hint, EmptyState, btnPrimary } from "./ui.jsx";
import RunCard from "./RunCard.jsx";

/* Quante run recenti mostrare qui: lo storico completo vive nell'archivio. */
const RECENT = 3;

export default function Runs({ dsId, dataset, onGoTo }) {
  const { resources, slots, runs, error: loadError, refresh } =
    useDatasetData(dsId, { withRuns: true });
  const [timeLimit, setTimeLimit] = useState(30);
  const [solving, setSolving] = useState(false);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState(null);

  const missing = [];
  if (resources.length === 0)
    missing.push({ step: "people", label: "non ci sono persone (passo 2)" });
  if (slots.length === 0)
    missing.push({ step: "slots", label: "non ci sono turni da coprire (passo 3)" });
  const noRules = (dataset?.constraints_count ?? 0) === 0;

  const solve = async () => {
    setSolving(true);
    setError(null);
    try {
      const run = await api.solve(dsId, timeLimit);
      setOpen(run.id);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <StepHeader step={5} title="Calcola la pianificazione">
        Il motore prova tutte le combinazioni persona–turno e restituisce la
        tabella che rispetta gli obblighi violando il meno possibile le
        preferenze. Qui vedi i calcoli più recenti; lo storico completo, con
        nomi e gruppi, è nella sezione "Pianificazioni".
      </StepHeader>

      {missing.length > 0 ? (
        <div className="bg-amber-50/80 backdrop-blur border border-amber-200 rounded-2xl p-4 space-y-2">
          <p className="text-warn text-sm font-medium">
            Manca qualcosa prima di poter calcolare:
          </p>
          <ul className="text-sm text-muted list-disc ml-5">
            {missing.map((m) => (
              <li key={m.step}>
                {m.label} —{" "}
                <button
                  onClick={() => onGoTo(m.step)}
                  className="text-op hover:text-op-dark underline underline-offset-2"
                >
                  vai al passo
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={solve} disabled={solving} className={btnPrimary}>
            {solving ? "Calcolo in corso…" : "▶ Calcola pianificazione"}
          </button>
          <label
            className="text-sm text-muted"
            title="Tempo massimo concesso al motore. Se scade, tiene la migliore soluzione trovata fin lì."
          >
            tempo massimo{" "}
            <input
              type="number"
              min="1"
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              className="w-16 bg-white/80 border border-slate-200 rounded-lg px-2 py-1 text-paper focus:outline-none focus:border-emerald-500"
            />{" "}
            secondi
          </label>
          {noRules && (
            <span className="text-warn text-sm">
              Nessuna regola attiva: il risultato sarà una griglia qualsiasi.{" "}
              <button
                onClick={() => onGoTo("rules")}
                className="text-op underline underline-offset-2"
              >
                Aggiungi regole
              </button>
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="font-mono text-sm text-danger">
          Errore durante il calcolo: {error}
        </p>
      )}
      {loadError && (
        <p className="font-mono text-sm text-danger">
          Errore nel caricamento dei dati: {loadError}{" "}
          <button onClick={refresh} className="underline underline-offset-2">
            riprova
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
          Altre {runs.length - RECENT} pianificazioni nello storico.{" "}
          <button
            onClick={() => onGoTo("archive")}
            className="text-op underline underline-offset-2"
          >
            Apri l'archivio
          </button>
        </p>
      )}

      {runs.length === 0 && missing.length === 0 && (
        <EmptyState>
          Nessun calcolo ancora. Premi "Calcola pianificazione": il primo
          risultato comparirà qui con la griglia persone × giorni.
        </EmptyState>
      )}

      <Hint title="Come leggere gli esiti?">
        <p>
          <b className="text-op">Ottimale</b>: la soluzione migliore in
          assoluto. <b className="text-op">Valida</b>: una buona soluzione,
          forse non la migliore (poco tempo).{" "}
          <b className="text-danger">Impossibile</b>: gli obblighi si
          contraddicono — il motore ti dice quali.
        </p>
        <p>
          La <b className="text-warn">penalità</b> misura le preferenze
          sacrificate: 0 = tutte rispettate. Confronta le penalità tra calcoli
          per capire se le tue modifiche migliorano le cose.
        </p>
        <p>
          Ogni calcolo finisce nella sezione{" "}
          <b className="text-op">Pianificazioni</b>: lì puoi rinominarlo,
          raggrupparlo ed eliminare quelli che non servono più.
        </p>
      </Hint>
    </div>
  );
}
