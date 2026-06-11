import React, { useEffect, useState } from "react";
import { api } from "../api";
import { EmptyState, Hint, ConfirmButton, inputCls, btnPrimary, btnGhost } from "./ui.jsx";
import { SearchIcon } from "./icons.jsx";
import { useT, useLocale } from "../i18n.jsx";

/* Store condiviso: ricette di regole pubblicate dagli utenti.
   Si pubblica dal progetto attivo, si installa nel progetto attivo. */

function PublishPanel({ dataset, onPublished, onCancel }) {
  const t = useT();
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
        {t("store.publish_title", { name: dataset.name })}
      </h3>
      <p className="text-sm text-muted">
        {t("store.publish_desc", { count: dataset.constraints_count })}
      </p>
      <label className="block text-sm">
        <span className="font-semibold text-slate-700">
          {t("store.field_title")}
        </span>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("store.title_placeholder")}
          className={inputCls}
        />
      </label>
      <label className="block text-sm">
        <span className="font-semibold text-slate-700">
          {t("store.field_description")}
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder={t("store.description_placeholder")}
          className={inputCls}
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button onClick={publish} disabled={busy || !title.trim()} className={btnPrimary}>
          {busy ? t("store.publishing") : t("store.publish_submit")}
        </button>
        <button onClick={onCancel} className={btnGhost}>
          {t("common.cancel")}
        </button>
      </div>
    </section>
  );
}

function RecipeCard({ item, dataset, onInstalled, onDeleted }) {
  const t = useT();
  const locale = useLocale();
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
          {item.rules_count === 1
            ? t("store.rules_count_one")
            : t("store.rules_count_other", { n: item.rules_count })}
        </span>
      </div>
      <p className="text-xs text-muted">
        {t("store.by")} <b>{item.author_username}</b> ·{" "}
        {new Date(item.created_at).toLocaleDateString(locale)} ·{" "}
        {item.installs === 1
          ? t("store.installs_one")
          : t("store.installs_other", { n: item.installs })}
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
            {done === 1
              ? t("store.installed_one", { name: dataset?.name })
              : t("store.installed_other", { n: done, name: dataset?.name })}
          </span>
        ) : (
          <button
            onClick={install}
            disabled={busy || !dataset}
            title={!dataset ? t("store.open_project_first") : undefined}
            className="text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-500 rounded-lg px-4 py-1.5 disabled:opacity-40"
          >
            {busy ? t("store.installing") : t("store.install")}
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
              confirmLabel={t("store.withdraw_confirm")}
              className="text-xs font-medium text-danger/70 hover:text-danger"
            >
              {t("store.withdraw")}
            </ConfirmButton>
          </span>
        )}
      </div>
    </article>
  );
}

export default function Store({ dataset, onGoTo }) {
  const t = useT();
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
          {t("store.title")}
        </h2>
        <p className="text-muted text-[15px] mt-3 leading-relaxed">
          {t("store.desc")}
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
            placeholder={t("store.search_placeholder")}
            className={`${inputCls} mt-0 pl-9`}
          />
        </label>
        {!publishing && (
          <button
            onClick={() => setPublishing(true)}
            disabled={!dataset || !dataset.constraints_count}
            title={
              !dataset
                ? t("store.open_project_first")
                : !dataset.constraints_count
                  ? t("store.no_rules_title")
                  : undefined
            }
            className={`${btnPrimary} ml-auto`}
          >
            {t("store.publish_btn")}
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
          {t("store.error", { error })}
        </p>
      )}

      {items.length === 0 && !error ? (
        <EmptyState>
          {query ? t("store.empty_search") : t("store.empty")}
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

      <Hint title={t("store.hint_title")}>
        <p>
          {t("store.hint_p1_1")}
          <b>{t("store.hint_p1_rules")}</b>
          {t("store.hint_p1_2")}
        </p>
        <p>
          {t("store.hint_p2_1")}
          <button
            onClick={() => onGoTo("rules")}
            className="text-op underline underline-offset-2"
          >
            {t("store.hint_p2_rules_link")}
          </button>
          {t("store.hint_p2_2")}
          <b>{t("store.hint_p2_custom")}</b>
          {t("store.hint_p2_3")}
        </p>
      </Hint>
    </div>
  );
}
