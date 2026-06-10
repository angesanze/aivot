import React, { useEffect, useState } from "react";
import { api } from "../api";
import { EmptyState, Hint, ConfirmButton, inputCls, btnPrimary, btnGhost } from "./ui.jsx";
import { SearchIcon } from "./icons.jsx";

/* Store condiviso: ricette di regole pubblicate dagli utenti.
   Si pubblica dal progetto attivo, si installa nel progetto attivo. */

function PublishPanel({ dataset, onPublished, onCancel }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const item = await api.publishRecipe({
        dataset: dataset.id,
        title: title.trim(),
        description: description.trim(),
      });
      onPublished(item);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <section className="bg-white/80 backdrop-blur border border-emerald-300 ring-2 ring-emerald-500/15 rounded-2xl p-4 space-y-3">
      <h3 className="font-medium">
        Pubblica le regole di «{dataset.name}»
      </h3>
      <p className="text-sm text-muted">
        Verranno condivise le {dataset.constraints_count} regole attive del
        progetto (senza dati: niente persone né turni). Le regole legate a
        persone specifiche vengono escluse automaticamente.
      </p>
      <label className="block text-sm">
        <span className="font-semibold text-slate-700">Titolo *</span>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Es. Turnistica reparto ospedaliero H24"
          className={inputCls}
        />
      </label>
      <label className="block text-sm">
        <span className="font-semibold text-slate-700">
          Descrizione — aiuta gli altri a capire quando usarla
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Per chi è? Che problemi risolve? Cosa va adattato?"
          className={inputCls}
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button onClick={publish} disabled={busy || !title.trim()} className={btnPrimary}>
          {busy ? "Pubblicazione…" : "Pubblica nello store"}
        </button>
        <button onClick={onCancel} className={btnGhost}>
          Annulla
        </button>
      </div>
    </section>
  );
}

function RecipeCard({ item, dataset, onInstalled, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  const install = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.installRecipe(item.id, dataset.id);
      setDone(r.installed);
      onInstalled();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="bg-white/70 backdrop-blur border border-slate-200/70 rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.06)] p-4 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="font-semibold">{item.title}</h4>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
          {item.rules_count} regole
        </span>
      </div>
      <p className="text-xs text-muted">
        di <b>{item.author_username}</b> ·{" "}
        {new Date(item.created_at).toLocaleDateString("it-IT")} ·{" "}
        {item.installs} installazioni
      </p>
      {item.description && (
        <p className="text-sm text-muted">{item.description}</p>
      )}
      <p className="text-xs text-muted font-mono">
        {item.payload.rules.map((r) => r.label || r.type).join(" · ")}
      </p>
      <div className="flex items-center gap-3 mt-auto pt-2">
        {done != null ? (
          <span className="text-sm text-op font-medium">
            ✓ {done} regole aggiunte a «{dataset?.name}»
          </span>
        ) : (
          <button
            onClick={install}
            disabled={busy || !dataset}
            title={!dataset ? "Prima apri un progetto" : undefined}
            className="text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-500 rounded-lg px-4 py-1.5 disabled:opacity-40"
          >
            {busy ? "Installazione…" : "Installa nel progetto"}
          </button>
        )}
        {error && <span className="text-xs text-danger">{error}</span>}
        {item.is_mine && (
          <span className="ml-auto">
            <ConfirmButton
              onConfirm={async () => {
                await api.deleteRecipe(item.id);
                onDeleted();
              }}
              confirmLabel="Ritirare dallo store?"
              className="text-xs font-medium text-danger/70 hover:text-danger"
            >
              ritira
            </ConfirmButton>
          </span>
        )}
      </div>
    </article>
  );
}

export default function Store({ dataset, onGoTo }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);

  const load = (q = query) =>
    api.storeItems(q).then(setItems).catch((e) => setError(e.message));

  useEffect(() => {
    load("");
  }, []);

  // Ricerca con piccolo debounce: lo store può crescere parecchio
  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Store delle ricette
        </h2>
        <p className="text-muted text-[15px] mt-3 leading-relaxed">
          Set di regole già rodati, pubblicati dalla community: installane
          uno nel tuo progetto e adatta i valori, invece di partire da zero.
          Quando le tue regole funzionano bene, ricambia: pubblicale qui.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block w-full max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca: ospedale, negozio, scuola…"
            className={`${inputCls} mt-0 pl-9`}
          />
        </label>
        {!publishing && (
          <button
            onClick={() => setPublishing(true)}
            disabled={!dataset || !dataset.constraints_count}
            title={
              !dataset
                ? "Prima apri un progetto"
                : !dataset.constraints_count
                  ? "Il progetto attivo non ha ancora regole"
                  : undefined
            }
            className={`${btnPrimary} ml-auto`}
          >
            ↑ Pubblica le regole del progetto
          </button>
        )}
      </div>

      {publishing && (
        <PublishPanel
          dataset={dataset}
          onCancel={() => setPublishing(false)}
          onPublished={() => {
            setPublishing(false);
            load();
          }}
        />
      )}

      {error && (
        <p className="font-mono text-sm text-danger">
          Store non raggiungibile: {error}
        </p>
      )}

      {items.length === 0 && !error ? (
        <EmptyState>
          {query
            ? "Nessuna ricetta corrisponde alla ricerca."
            : "Lo store è ancora vuoto. Hai un set di regole che funziona? Sii il primo a pubblicarlo."}
        </EmptyState>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {items.map((item) => (
            <RecipeCard
              key={item.id}
              item={item}
              dataset={dataset}
              onInstalled={() => load()}
              onDeleted={() => load()}
            />
          ))}
        </div>
      )}

      <Hint title="Cosa contiene una ricetta?">
        <p>
          Solo le <b>regole</b> (tipo, parametri, obbligo/preferenza, pesi):
          mai persone, turni o dati del progetto d'origine. Le regole legate
          a persone specifiche (indisponibilità, coppie…) vengono escluse
          automaticamente alla pubblicazione.
        </p>
        <p>
          Dopo l'installazione le regole sono tue: modificale, disattivale o
          eliminale dal passo{" "}
          <button
            onClick={() => onGoTo("rules")}
            className="text-op underline underline-offset-2"
          >
            Regole
          </button>
          . Con la regola <b>«Su misura»</b> del catalogo puoi anche
          costruire vincoli nuovi e condividerli qui.
        </p>
      </Hint>
    </div>
  );
}
