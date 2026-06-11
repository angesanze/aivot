import React, { useState } from "react";
import { api } from "../api";
import {
  StepHeader, Hint, Field, EmptyState, ConfirmButton,
  inputCls, btnPrimary, btnGhost,
} from "./ui.jsx";
import { useT } from "../i18n.jsx";

export default function DatasetStep({ datasets, currentId, onOpen, onChanged }) {
  const t = useT();
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
      <StepHeader step={1} title={t("project.title")}>
        {t("project.desc")}
      </StepHeader>

      <Hint title={t("project.how_title")} open={datasets.length === 0}>
        <p>{t("project.how_intro")}</p>
        <ol className="list-decimal ml-5 space-y-1">
          {/* ogni riga è "Etichetta — testo": la parte prima del trattino va in grassetto */}
          {["project.how_step1", "project.how_step2", "project.how_step3", "project.how_step4", "project.how_step5"].map((k) => {
            const s = t(k);
            const i = s.indexOf(" — ");
            return (
              <li key={k}>
                <b className="text-paper">{s.slice(0, i)}</b>
                {s.slice(i)}
              </li>
            );
          })}
        </ol>
        <p>{t("project.how_outro")}</p>
      </Hint>

      {datasets.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t("project.yours")}
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
                    {t("project.count_people", { n: d.resources_count })}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {t("project.count_slots", { n: d.slots_count })}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                    {t("project.count_rules", { n: d.constraints_count })}
                  </span>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <button onClick={() => onOpen(d.id)} className={btnPrimary}>
                  {t("project.open")}
                </button>
                <ConfirmButton
                  onConfirm={() => remove(d)}
                  confirmLabel={t("project.delete_confirm")}
                  className="text-xs font-medium text-danger/70 hover:text-danger"
                >
                  {t("common.delete")}
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
              {t("project.create_first")}
            </button>
          }
        >
          {t("project.empty")}
        </EmptyState>
      )}

      {creating ? (
        <section className="bg-white/80 backdrop-blur border border-emerald-300 ring-2 ring-emerald-500/15 rounded-2xl shadow-[0_4px_24px_rgba(16,185,129,0.15)] p-4 space-y-3">
          <h3 className="font-medium">{t("project.new_title")}</h3>
          <Field label={t("project.name_label")} hint={t("project.name_hint")}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder={t("project.name_placeholder")}
              className={inputCls}
              autoFocus
            />
          </Field>
          <Field label={t("project.desc_label")}>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("project.desc_placeholder")}
              className={inputCls}
            />
          </Field>
          <div className="flex gap-2">
            <button onClick={create} disabled={busy || !name.trim()} className={btnPrimary}>
              {t("project.create_btn")}
            </button>
            {datasets.length > 0 && (
              <button onClick={() => setCreating(false)} className={btnGhost}>
                {t("common.cancel")}
              </button>
            )}
          </div>
        </section>
      ) : (
        datasets.length > 0 && (
          <button onClick={() => setCreating(true)} className={btnGhost}>
            {t("project.new_btn")}
          </button>
        )
      )}
    </div>
  );
}
