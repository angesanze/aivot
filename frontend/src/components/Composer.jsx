import React, { useEffect, useState } from "react";
import { api } from "../api";
import {
  StepHeader,
  Hint,
  Field,
  EmptyState,
  FAMILY_LABELS,
  FAMILY_COLORS,
  inputCls,
  btnPrimary,
  btnGhost,
} from "./ui.jsx";
import { ParamFields, NatureToggle } from "./ConstraintFields.jsx";

export default function Composer({ dsId, onChanged, onNext }) {
  const [templates, setTemplates] = useState([]);
  const [resources, setResources] = useState([]);
  const [constraints, setConstraints] = useState([]);
  // editor: { id: null per nuovo vincolo, template, params, nature, weight, label }
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState("");

  const load = () => api.constraints(dsId).then(setConstraints);

  useEffect(() => {
    api.templates().then(setTemplates);
    api.resources(dsId).then(setResources);
    load();
  }, [dsId]);

  const changed = () => {
    load();
    onChanged();
  };

  const tplById = Object.fromEntries(templates.map((t) => [t.id, t]));
  const resById = Object.fromEntries(resources.map((r) => [r.id, r]));

  /* Filtro del catalogo laterale: su nome e descrizione, ogni parola conta. */
  const tplMatch = (t) =>
    search
      .toLowerCase()
      .split(/\s+/)
      .every((w) => `${t.name} ${t.description}`.toLowerCase().includes(w));
  const visible = templates.filter(tplMatch);
  const families = [...new Set(visible.map((t) => t.family))];

  /* Parametri in chiaro: "Minimo persone: 2 · Competenza: senior",
     mai JSON grezzo in faccia all'utente. */
  const paramSummary = (c) => {
    const tpl = tplById[c.template];
    if (!tpl) return JSON.stringify(c.params);
    const parts = tpl.param_schema
      .filter((p) => c.params[p.name] != null && c.params[p.name] !== "")
      .map((p) => {
        const v = c.params[p.name];
        const shown =
          p.type === "resource"
            ? resById[v]?.name ?? `#${v}`
            : p.type === "select"
              ? p.options?.find((o) => o.value === v)?.label ?? v
              : v;
        return `${p.label}: ${shown}`;
      });
    return parts.join(" · ");
  };

  const startAdd = (t) => {
    const params = {};
    t.param_schema.forEach((p) => {
      if (p.default !== undefined) params[p.name] = p.default;
    });
    setEditor({
      id: null,
      template: t,
      params,
      nature: t.default_nature,
      weight: 1,
      label: "",
    });
  };

  const startEdit = (c) => {
    const tpl = tplById[c.template];
    if (!tpl) return;
    setEditor({
      id: c.id,
      template: tpl,
      params: { ...c.params },
      nature: c.nature,
      weight: c.weight,
      label: c.label,
    });
  };

  const save = async () => {
    const params = Object.fromEntries(
      Object.entries(editor.params).filter(([, v]) => v !== "" && v != null)
    );
    const body = {
      params,
      nature: editor.nature,
      weight: editor.weight,
      label: editor.label,
    };
    if (editor.id == null) {
      await api.createConstraint({
        ...body,
        dataset: dsId,
        template: editor.template.id,
        enabled: true,
      });
    } else {
      await api.updateConstraint(editor.id, body);
    }
    setEditor(null);
    changed();
  };

  const missingRequired = editor?.template.param_schema.some(
    (p) =>
      p.required && (editor.params[p.name] == null || editor.params[p.name] === "")
  );

  const toggle = (c, field, value) =>
    api.updateConstraint(c.id, { [field]: value }).then(changed);

  return (
    <div className="space-y-6">
      <StepHeader step={4} title="Componi le regole della pianificazione">
        Scegli le regole dal catalogo a destra e impostane i valori. Ogni
        regola è un <b className="text-paper">obbligo</b> (va rispettata per
        forza) o una <b className="text-paper">preferenza</b> (violarla costa
        una penalità che il motore cerca di minimizzare).
      </StepHeader>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            Regole attive nel progetto · {constraints.length}
          </h3>

          {constraints.length === 0 && !editor && (
            <EmptyState>
              Nessuna regola ancora. Inizia dal catalogo a destra: per i turni
              di lavoro, quasi sempre servono "Un turno al giorno per persona"
              e una "Copertura minima".
            </EmptyState>
          )}

          {constraints.map((c) => (
            <article
              key={c.id}
              className={`bg-white/70 backdrop-blur border rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.06)] p-4 ${
                c.enabled ? "border-line" : "border-line opacity-40"
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold">{c.label || c.template_name}</span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    FAMILY_COLORS[c.family] || "bg-slate-100 text-slate-600"
                  }`}
                >
                  {FAMILY_LABELS[c.family] || c.family}
                </span>
                {!c.enabled && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    disattivata
                  </span>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <NatureToggle
                    nature={c.nature}
                    onChange={(n) => toggle(c, "nature", n)}
                  />
                  {c.nature === "soft" && (
                    <label
                      className="font-mono text-xs text-muted"
                      title="Quanto pesa violare questa preferenza: più alto = il motore la sacrifica per ultima"
                    >
                      peso{" "}
                      <input
                        type="number"
                        min="1"
                        value={c.weight}
                        onChange={(e) => toggle(c, "weight", Number(e.target.value))}
                        className="w-14 bg-white border border-line rounded px-1 py-0.5 text-paper"
                      />
                    </label>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <p className="text-sm text-muted">
                  {paramSummary(c) || "Senza parametri"}
                </p>
                <div className="ml-auto flex items-center gap-3">
                  <button
                    onClick={() => startEdit(c)}
                    className="text-xs font-medium text-muted hover:text-paper"
                  >
                    modifica
                  </button>
                  <button
                    onClick={() => toggle(c, "enabled", !c.enabled)}
                    className="text-xs font-medium text-muted hover:text-paper"
                    title="Una regola disattivata resta salvata ma il motore la ignora"
                  >
                    {c.enabled ? "disattiva" : "attiva"}
                  </button>
                  <button
                    onClick={() => api.deleteConstraint(c.id).then(changed)}
                    className="text-xs font-medium text-danger/70 hover:text-danger"
                  >
                    elimina
                  </button>
                </div>
              </div>
            </article>
          ))}

          {/* Editor: stesso modulo per creare e per modificare */}
          {editor && (
            <div className="bg-white/80 backdrop-blur border border-emerald-300 ring-2 ring-emerald-500/15 rounded-2xl shadow-[0_4px_24px_rgba(16,185,129,0.15)] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">
                    {editor.id == null ? "Nuova regola: " : "Modifica: "}
                    {editor.template.name}
                  </h3>
                  {editor.template.description && (
                    <p className="text-sm text-muted mt-0.5">
                      {editor.template.description}
                    </p>
                  )}
                </div>
                <NatureToggle
                  nature={editor.nature}
                  onChange={(n) => setEditor({ ...editor, nature: n })}
                />
              </div>
              <p className="text-xs text-muted border-l-2 border-line pl-2">
                {editor.nature === "hard"
                  ? "Obbligo: se le regole obbligatorie sono incompatibili tra loro, il motore non troverà nessuna pianificazione e ti indicherà quali sono in conflitto."
                  : "Preferenza: il motore cerca di rispettarla, ma può violarla se necessario. Il peso decide quanto costa ogni violazione."}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <ParamFields
                  schema={editor.template.param_schema}
                  resources={resources}
                  values={editor.params}
                  onChange={(k, v) =>
                    setEditor({ ...editor, params: { ...editor.params, [k]: v } })
                  }
                />
                <Field
                  label="Etichetta (facoltativa)"
                  hint="Un nome tuo per riconoscerla, es. 'Almeno un senior di notte'."
                >
                  <input
                    value={editor.label}
                    onChange={(e) => setEditor({ ...editor, label: e.target.value })}
                    placeholder={editor.template.name}
                    className={inputCls}
                  />
                </Field>
                {editor.nature === "soft" && (
                  <Field
                    label="Peso penalità"
                    hint="Più alto = violazione più costosa. Usa pesi diversi per dire cosa conta di più."
                  >
                    <input
                      type="number"
                      min="1"
                      value={editor.weight}
                      onChange={(e) =>
                        setEditor({ ...editor, weight: Number(e.target.value) })
                      }
                      className={inputCls}
                    />
                  </Field>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={save} disabled={missingRequired} className={btnPrimary}>
                  {editor.id == null ? "Aggiungi regola" : "Salva modifiche"}
                </button>
                <button onClick={() => setEditor(null)} className={btnGhost}>
                  Annulla
                </button>
                {missingRequired && (
                  <span className="text-xs text-warn self-center">
                    Compila i campi obbligatori (*)
                  </span>
                )}
              </div>
            </div>
          )}

          {constraints.length > 0 && !editor && (
            <div className="flex items-center gap-3 pt-3">
              <button onClick={onNext} className={btnPrimary}>
                Continua: calcola la pianificazione →
              </button>
            </div>
          )}
        </div>

        {/* Catalogo laterale: da template a regola in un click */}
        <aside className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Aggiungi dal catalogo
          </h3>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca una regola…"
            className={`${inputCls} mt-0`}
          />
          {visible.length === 0 && (
            <p className="text-sm text-muted">
              Nessuna regola trovata: prova con un'altra parola.
            </p>
          )}
          {families.map((f) => (
            <div key={f}>
              <p
                className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mb-1.5 ${
                  FAMILY_COLORS[f] || "bg-slate-100 text-slate-600"
                }`}
              >
                {FAMILY_LABELS[f] || f}
              </p>
              <div className="space-y-1.5">
                {visible
                  .filter((t) => t.family === f)
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => startAdd(t)}
                      title={t.description}
                      className="w-full text-left bg-white/70 backdrop-blur border border-slate-200/70 rounded-xl px-3 py-2.5 text-sm hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 transition-all"
                    >
                      {t.name}
                      {t.description && (
                        <span className="block text-xs text-muted mt-0.5">
                          {t.description}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          ))}
          <Hint title="Obbligo o preferenza?">
            <p>
              <b className="text-paper">Obbligo</b>: regola non negoziabile (es.
              riposo minimo per legge). Troppe regole obbligatorie in conflitto ={" "}
              nessuna soluzione.
            </p>
            <p>
              <b className="text-paper">Preferenza</b>: desiderata (es. equità
              delle notti). Il motore la viola solo se serve, pagando il peso che
              hai scelto.
            </p>
          </Hint>
        </aside>
      </div>
    </div>
  );
}
