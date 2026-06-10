import React, { useState } from "react";
import { api } from "../api";
import {
  StepHeader, Hint, Field, EmptyState, ConfirmButton,
  inputCls, btnPrimary, btnGhost,
} from "./ui.jsx";

export default function DatasetStep({ datasets, currentId, onOpen, onChanged }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(datasets.length === 0);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const ds = await api.createDataset({ name: name.trim(), description });
      setName("");
      setDescription("");
      setCreating(false);
      await onChanged();
      onOpen(ds.id); // entra subito nel passo successivo
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d) => {
    await api.deleteDataset(d.id);
    onChanged();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <StepHeader step={1} title="Scegli o crea un progetto">
        Un progetto raccoglie tutto ciò che serve per una pianificazione: le
        persone da assegnare, i turni da coprire e le regole da rispettare.
        Esempio: "Reparto cardiologia — luglio".
      </StepHeader>

      <Hint title="Come funziona l'applicazione?" open={datasets.length === 0}>
        <p>Si lavora in cinque passi, nell'ordine del percorso nel menu laterale:</p>
        <ol className="list-decimal ml-5 space-y-1">
          <li><b className="text-paper">Progetto</b> — crei un contenitore per la pianificazione.</li>
          <li><b className="text-paper">Persone</b> — inserisci chi può lavorare e le sue competenze.</li>
          <li><b className="text-paper">Turni</b> — definisci i turni da coprire (es. mattino/pomeriggio/notte per due settimane).</li>
          <li><b className="text-paper">Regole</b> — scegli i vincoli dal catalogo: copertura minima, riposi, equità, indisponibilità…</li>
          <li><b className="text-paper">Pianifica</b> — il motore calcola la tabella turni che rispetta le regole.</li>
        </ol>
        <p>
          Puoi tornare su qualsiasi passo in ogni momento: i dati restano
          salvati sul server.
        </p>
      </Hint>

      {datasets.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            I tuoi progetti
          </h3>
          {datasets.map((d) => (
            <article
              key={d.id}
              className={`bg-white/70 backdrop-blur border rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.06)] p-4 flex flex-wrap items-center gap-4 transition-shadow hover:shadow-[0_4px_24px_rgba(15,23,42,0.1)] ${
                d.id === currentId
                  ? "border-emerald-400 ring-2 ring-emerald-500/15"
                  : "border-slate-200/70"
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold">{d.name}</p>
                {d.description && (
                  <p className="text-sm text-muted truncate">{d.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                    {d.resources_count} persone
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {d.slots_count} turni
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                    {d.constraints_count} regole
                  </span>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <button onClick={() => onOpen(d.id)} className={btnPrimary}>
                  Apri
                </button>
                <ConfirmButton
                  onConfirm={() => remove(d)}
                  confirmLabel="Eliminare tutto il progetto?"
                  className="text-xs font-medium text-danger/70 hover:text-danger"
                >
                  elimina
                </ConfirmButton>
              </div>
            </article>
          ))}
        </section>
      )}

      {datasets.length === 0 && !creating && (
        <EmptyState
          action={
            <button onClick={() => setCreating(true)} className={btnPrimary}>
              Crea il primo progetto
            </button>
          }
        >
          Non c'è ancora nessun progetto.
        </EmptyState>
      )}

      {creating ? (
        <section className="bg-white/80 backdrop-blur border border-emerald-300 ring-2 ring-emerald-500/15 rounded-2xl shadow-[0_4px_24px_rgba(16,185,129,0.15)] p-4 space-y-3">
          <h3 className="font-medium">Nuovo progetto</h3>
          <Field label="Nome *" hint="Un titolo che riconoscerai: reparto, periodo, aula…">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Es. Reparto cardiologia — luglio"
              className={inputCls}
              autoFocus
            />
          </Field>
          <Field label="Descrizione (facoltativa)">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Es. 9 infermieri, turni M/P/N, copertura minima 2"
              className={inputCls}
            />
          </Field>
          <div className="flex gap-2">
            <button onClick={create} disabled={busy || !name.trim()} className={btnPrimary}>
              Crea e continua →
            </button>
            {datasets.length > 0 && (
              <button onClick={() => setCreating(false)} className={btnGhost}>
                Annulla
              </button>
            )}
          </div>
        </section>
      ) : (
        datasets.length > 0 && (
          <button onClick={() => setCreating(true)} className={btnGhost}>
            + Nuovo progetto
          </button>
        )
      )}
    </div>
  );
}
