import React, { useState } from "react";
import { api } from "../api";
import { useDatasetData } from "../hooks/useDatasetData.js";
import { EmptyState, Hint, inputCls } from "./ui.jsx";
import { PencilIcon, TrashIcon } from "./icons.jsx";
import RunCard, { runTitle } from "./RunCard.jsx";
import { useT } from "../i18n.jsx";

/* Pannello di modifica nome + gruppo di una run. */
function EditForm({ run, groups, onSaved, onCancel }) {
  const t = useT();
  const [name, setName] = useState(run.name || "");
  const [group, setGroup] = useState(run.group || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateRun(run.id, { name: name.trim(), group: group.trim() });
      onSaved();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/70 backdrop-blur border border-emerald-300 rounded-2xl p-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="font-semibold text-slate-700">{t("archive.name_label")}</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder={t("run.title", { id: run.id })}
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-slate-700">{t("archive.group_label")}</span>
          <input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder={t("archive.group_placeholder")}
            list="run-groups"
            className={inputCls}
          />
          <span className="block text-xs text-muted mt-1">
            {t("archive.group_hint")}
          </span>
        </label>
      </div>
      <datalist id="run-groups">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      {error && <p className="font-mono text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-500 rounded-lg px-4 py-1.5 disabled:opacity-40"
        >
          {saving ? t("archive.saving") : t("common.save")}
        </button>
        <button
          onClick={onCancel}
          className="text-sm font-medium text-muted hover:text-paper px-3 py-1.5"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

export default function Archive({ dsId, onGoTo }) {
  const t = useT();
  const { resources, slots, runs, error: loadError, refresh } =
    useDatasetData(dsId, { withRuns: true });
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [error, setError] = useState(null);

  const noGroup = t("archive.no_group");
  const groups = [...new Set(runs.map((r) => r.group).filter(Boolean))].sort();
  // Gruppi in ordine alfabetico, le run senza gruppo in coda.
  const sections = [
    ...groups.map((g) => ({ title: g, runs: runs.filter((r) => r.group === g) })),
    { title: noGroup, runs: runs.filter((r) => !r.group) },
  ].filter((s) => s.runs.length > 0);

  const remove = async (run) => {
    setError(null);
    try {
      await api.deleteRun(run.id);
      setConfirming(null);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const actionsFor = (run) =>
    confirming === run.id ? (
      <>
        <span className="text-xs text-danger font-medium whitespace-nowrap">
          {t("archive.delete_confirm")}
        </span>
        <button
          onClick={() => remove(run)}
          className="text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg px-2.5 py-1.5"
        >
          {t("ui.confirm_yes")}
        </button>
        <button
          onClick={() => setConfirming(null)}
          className="text-xs font-medium text-muted hover:text-paper px-2 py-1.5"
        >
          {t("ui.confirm_no")}
        </button>
      </>
    ) : (
      <>
        <button
          onClick={() => {
            setEditing(editing === run.id ? null : run.id);
            setConfirming(null);
          }}
          title={t("archive.edit_title")}
          className="text-muted hover:text-paper hover:bg-slate-900/5 rounded-lg p-2 transition-colors"
        >
          <PencilIcon />
        </button>
        <button
          onClick={() => {
            setConfirming(run.id);
            setEditing(null);
          }}
          title={t("archive.delete_title")}
          className="text-muted hover:text-danger hover:bg-rose-50 rounded-lg p-2 transition-colors"
        >
          <TrashIcon />
        </button>
      </>
    );

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
          {t("archive.title")}
        </h2>
        <p className="text-muted text-[15px] mt-3 leading-relaxed">
          {t("archive.desc")}{" "}
          <button
            onClick={() => onGoTo("solve")}
            className="text-op underline underline-offset-2"
          >
            {t("archive.go_solve")}
          </button>
          .
        </p>
      </header>

      {(error || loadError) && (
        <p className="font-mono text-sm text-danger">
          {t("archive.error", { msg: error || loadError })}{" "}
          <button onClick={refresh} className="underline underline-offset-2">
            {t("common.retry")}
          </button>
        </p>
      )}

      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h3
            className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
              section.title === noGroup
                ? "bg-slate-100 text-slate-500"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {section.title}
            <span className="ml-1.5 font-normal">({section.runs.length})</span>
          </h3>
          {section.runs.map((run) => (
            <div key={run.id} className="space-y-2">
              <RunCard
                run={run}
                resources={resources}
                slots={slots}
                onGoTo={onGoTo}
                open={open === run.id}
                onToggle={() => setOpen(open === run.id ? null : run.id)}
                actions={actionsFor(run)}
              />
              {editing === run.id && (
                <EditForm
                  run={run}
                  groups={groups}
                  onCancel={() => setEditing(null)}
                  onSaved={async () => {
                    setEditing(null);
                    await refresh();
                  }}
                />
              )}
            </div>
          ))}
        </section>
      ))}

      {runs.length === 0 && (
        <EmptyState>{t("archive.empty")}</EmptyState>
      )}

      <Hint title={t("archive.hint_title")}>
        <p>
          {t("archive.hint1a")} <b>{t("archive.hint1_name")}</b>{" "}
          {t("archive.hint1b")} <b>{t("archive.hint1_group")}</b>{" "}
          {t("archive.hint1c")}
        </p>
        <p>{t("archive.hint2")}</p>
      </Hint>
    </div>
  );
}
