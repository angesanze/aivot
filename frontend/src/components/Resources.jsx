import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { StepHeader, Hint, Field, EmptyState, inputCls, btnPrimary, btnGhost } from "./ui.jsx";

/* Import massivo da Excel/CSV: bottone che apre il file picker, esito
   inline, modello scaricabile per partire col formato giusto. */
function ImportBox({ dsId, onImported }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permette di ricaricare lo stesso file
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.importResources(dsId, file);
      setResult(r);
      onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const csv = "Nome;Competenze\nAnna Rossi;infermiere, senior\nBruno Bianchi;infermiere\n";
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "persone-modello.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="bg-white/70 backdrop-blur border border-slate-200/70 rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.06)] p-4 space-y-3">
      <h3 className="font-medium">Importa da Excel o CSV</h3>
      <p className="text-sm text-muted">
        Prima colonna il nome, seconda le competenze (separate da virgola).
        L'intestazione è facoltativa.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.csv,.txt"
        onChange={pick}
        className="hidden"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={btnPrimary}
        >
          {busy ? "Importazione…" : "↑ Scegli il file"}
        </button>
        <button
          onClick={downloadTemplate}
          className="text-xs font-medium text-op underline underline-offset-2"
        >
          scarica il modello
        </button>
      </div>
      {result && (
        <p className="text-sm text-op font-medium">
          ✓ {result.created} persone importate
          {result.skipped_rows.length > 0 &&
            ` — righe saltate (senza nome): ${result.skipped_rows.join(", ")}`}
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}

const parseSkills = (text) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/* Riga della tabella: in lettura mostra, in modifica diventa un mini-form. */
function ResourceRow({ r, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(r.name);
  const [skills, setSkills] = useState(r.skills.join(", "));

  const save = async () => {
    await api.updateResource(r.id, {
      name: name.trim(),
      skills: parseSkills(skills),
    });
    setEditing(false);
    onSaved();
  };

  if (editing)
    return (
      <tr className="border-b border-line/50">
        <td className="py-2 pr-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white border border-line rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
          />
        </td>
        <td className="py-2 pr-4">
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="es. infermiere, senior"
            className="w-full bg-white border border-line rounded px-2 py-1 font-mono text-xs focus:outline-none focus:border-emerald-500"
          />
        </td>
        <td className="py-2 text-right whitespace-nowrap">
          <button
            onClick={save}
            disabled={!name.trim()}
            className="text-xs font-medium text-op hover:underline mr-3"
          >
            salva
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs font-medium text-muted hover:text-paper"
          >
            annulla
          </button>
        </td>
      </tr>
    );

  return (
    <tr className="border-b border-line/50">
      <td className="py-2 pr-4">{r.name}</td>
      <td className="py-2 pr-4 font-mono text-xs text-op">
        {r.skills.length ? r.skills.join(" · ") : <span className="text-muted">—</span>}
      </td>
      <td className="py-2 text-right whitespace-nowrap">
        <button
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-muted hover:text-paper mr-3"
        >
          modifica
        </button>
        <button
          onClick={onDeleted}
          className="text-xs font-medium text-danger/70 hover:text-danger"
        >
          elimina
        </button>
      </td>
    </tr>
  );
}

export default function Resources({ dsId, onChanged, onNext }) {
  const [resources, setResources] = useState([]);
  const [names, setNames] = useState("");
  const [skills, setSkills] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.resources(dsId).then(setResources);
  useEffect(() => {
    load();
  }, [dsId]);

  const changed = () => {
    load();
    onChanged();
  };

  const add = async () => {
    const list = names
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name) => ({ dataset: dsId, name, skills: parseSkills(skills) }));
    if (!list.length) return;
    setBusy(true);
    try {
      await api.createResources(list);
      setNames("");
      changed();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r) => {
    await api.deleteResource(r.id);
    changed();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <StepHeader step={2} title="Inserisci le persone">
        Chi può essere assegnato ai turni? Aggiungi le persone una per riga.
        Le competenze servono alle regole di copertura (es. "almeno un senior
        di notte"): se non ti servono, puoi lasciarle vuote.
      </StepHeader>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            Persone nel progetto · {resources.length}
          </h3>
          {resources.length === 0 ? (
            <EmptyState>
              Nessuna persona ancora. Usa il modulo a fianco: scrivi i nomi,
              uno per riga, e premi "Aggiungi".
            </EmptyState>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted font-mono text-xs border-b border-line">
                  <th className="py-2 pr-4 font-normal">Nome</th>
                  <th className="py-2 pr-4 font-normal">Competenze</th>
                  <th className="py-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <ResourceRow
                    key={r.id}
                    r={r}
                    onSaved={changed}
                    onDeleted={() => remove(r)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="space-y-4">
          <section className="bg-white/70 backdrop-blur border border-slate-200/70 rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.06)] p-4 space-y-3">
            <h3 className="font-medium">Aggiungi persone</h3>
            <Field label="Nomi (uno per riga)">
              <textarea
                value={names}
                onChange={(e) => setNames(e.target.value)}
                rows={5}
                placeholder={"Anna Rossi\nBruno Bianchi\nCarla Verdi"}
                className={inputCls}
              />
            </Field>
            <Field
              label="Competenze comuni (facoltative)"
              hint="Separate da virgola, applicate a tutte le persone inserite. Potrai modificarle singolarmente dopo."
            >
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="es. infermiere, senior"
                className={inputCls}
              />
            </Field>
            <button onClick={add} disabled={busy || !names.trim()} className={btnPrimary}>
              Aggiungi
            </button>
          </section>

          <ImportBox dsId={dsId} onImported={changed} />

          <Hint title="A cosa servono le competenze?">
            <p>
              Una competenza è un'etichetta libera (es.{" "}
              <code className="font-mono text-op">senior</code>,{" "}
              <code className="font-mono text-op">rianimazione</code>). Le
              regole di copertura possono richiederla: "almeno 1 persona con
              competenza <i>senior</i> per ogni turno di notte".
            </p>
          </Hint>
        </aside>
      </div>

      {resources.length > 0 && (
        <div className="flex items-center gap-3 pt-2 border-t border-line">
          <button onClick={onNext} className={btnPrimary}>
            Continua: definisci i turni →
          </button>
          <span className="text-muted text-sm">
            Potrai sempre tornare qui per aggiungere o modificare persone.
          </span>
        </div>
      )}
    </div>
  );
}
