import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { StepHeader, Hint, Field, EmptyState, inputCls, btnPrimary, btnGhost } from "./ui.jsx";
import { useT } from "../i18n.jsx";

/* Import massivo da Excel/CSV: bottone che apre il file picker, esito
   inline, modello scaricabile per partire col formato giusto. */
function ImportBox({ dsId, onImported }) {
  const t = useT();
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
    const csv = `${t("people.import_csv_header")}\nAnna Rossi;infermiere, senior\nBruno Bianchi;infermiere\n`;
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
      <h3 className="font-medium">{t("people.import_title")}</h3>
      <p className="text-sm text-muted">{t("people.import_desc")}</p>
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
          {busy ? t("people.import_busy") : t("people.import_pick")}
        </button>
        <button
          onClick={downloadTemplate}
          className="text-xs font-medium text-op underline underline-offset-2"
        >
          {t("people.import_template")}
        </button>
      </div>
      {result && (
        <p className="text-sm text-op font-medium">
          {result.created === 1
            ? t("people.import_done_one")
            : t("people.import_done_many", { n: result.created })}
          {result.skipped_rows.length > 0 &&
            ` — ${t("people.import_skipped", { rows: result.skipped_rows.join(", ") })}`}
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
  const t = useT();
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
            placeholder={t("people.skills_placeholder")}
            className="w-full bg-white border border-line rounded px-2 py-1 font-mono text-xs focus:outline-none focus:border-emerald-500"
          />
        </td>
        <td className="py-2 text-right whitespace-nowrap">
          <button
            onClick={save}
            disabled={!name.trim()}
            className="text-xs font-medium text-op hover:underline mr-3"
          >
            {t("people.save")}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs font-medium text-muted hover:text-paper"
          >
            {t("people.cancel")}
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
          {t("common.edit")}
        </button>
        <button
          onClick={onDeleted}
          className="text-xs font-medium text-danger/70 hover:text-danger"
        >
          {t("common.delete")}
        </button>
      </td>
    </tr>
  );
}

export default function Resources({ dsId, onChanged, onNext }) {
  const t = useT();
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
      <StepHeader step={2} title={t("people.title")}>
        {t("people.desc")}
      </StepHeader>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            {t("people.in_project", { n: resources.length })}
          </h3>
          {resources.length === 0 ? (
            <EmptyState>{t("people.empty")}</EmptyState>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted font-mono text-xs border-b border-line">
                  <th className="py-2 pr-4 font-normal">{t("people.col_name")}</th>
                  <th className="py-2 pr-4 font-normal">{t("people.col_skills")}</th>
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
            <h3 className="font-medium">{t("people.add_title")}</h3>
            <Field label={t("people.names_label")}>
              <textarea
                value={names}
                onChange={(e) => setNames(e.target.value)}
                rows={5}
                placeholder={t("people.names_placeholder")}
                className={inputCls}
              />
            </Field>
            <Field
              label={t("people.common_skills_label")}
              hint={t("people.common_skills_hint")}
            >
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder={t("people.skills_placeholder")}
                className={inputCls}
              />
            </Field>
            <button onClick={add} disabled={busy || !names.trim()} className={btnPrimary}>
              {t("people.add")}
            </button>
          </section>

          <ImportBox dsId={dsId} onImported={changed} />

          <Hint title={t("people.skills_hint_title")}>
            <p>
              {t("people.skills_hint_1")}{" "}
              <code className="font-mono text-op">{t("people.skills_hint_code1")}</code>,{" "}
              <code className="font-mono text-op">{t("people.skills_hint_code2")}</code>
              {t("people.skills_hint_2")} <i>senior</i>{" "}
              {t("people.skills_hint_3")}
            </p>
          </Hint>
        </aside>
      </div>

      {resources.length > 0 && (
        <div className="flex items-center gap-3 pt-2 border-t border-line">
          <button onClick={onNext} className={btnPrimary}>
            {t("people.continue")}
          </button>
          <span className="text-muted text-sm">{t("people.footer_note")}</span>
        </div>
      )}
    </div>
  );
}
