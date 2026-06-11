import React from "react";
import { Field, inputCls } from "./ui.jsx";
import { useT } from "../i18n.jsx";

/* Form generato dal param_schema del template: l'utente compone e
   parametrizza, non programma. */
export function ParamFields({ schema, resources, values, onChange }) {
  const t = useT();
  if (!schema.length)
    return (
      <p className="text-sm text-muted sm:col-span-2">
        {t("fields.no_params")}
      </p>
    );
  return schema.map((p) => (
    <Field key={p.name} label={`${p.label}${p.required ? " *" : ""}`} hint={p.help}>
      {p.type === "resource" ? (
        <select
          value={values[p.name] ?? ""}
          onChange={(e) =>
            onChange(p.name, e.target.value ? Number(e.target.value) : "")
          }
          className={inputCls}
        >
          <option value="">
            {p.required ? t("fields.choose_person") : t("fields.all_people")}
          </option>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      ) : p.type === "select" ? (
        <select
          value={values[p.name] ?? p.default ?? ""}
          onChange={(e) => onChange(p.name, e.target.value)}
          className={inputCls}
        >
          {(p.options || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={p.type === "int" ? "number" : p.type === "date" ? "date" : "text"}
          value={values[p.name] ?? p.default ?? ""}
          onChange={(e) =>
            onChange(
              p.name,
              p.type === "int" ? Number(e.target.value) : e.target.value
            )
          }
          className={inputCls}
        />
      )}
    </Field>
  ));
}

/* Interruttore obbligo/preferenza, usato sia nell'editor sia in lista. */
export function NatureToggle({ nature, onChange }) {
  const t = useT();
  return (
    <div className="inline-flex text-[11px] font-bold rounded-full bg-slate-900/5 p-0.5">
      {[
        ["hard", t("fields.hard")],
        ["soft", t("fields.soft")],
      ].map(([n, label]) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          title={n === "hard" ? t("fields.hard_title") : t("fields.soft_title")}
          className={`px-3 py-1 tracking-wide rounded-full transition-all ${
            nature === n
              ? n === "hard"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30"
              : "text-muted hover:text-paper"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
