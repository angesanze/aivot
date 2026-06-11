import React, { useEffect, useState } from "react";
import { api } from "../api";
import {
  StepHeader, Hint, Field, EmptyState, ConfirmButton, codeColors,
  inputCls, btnPrimary, btnGhost,
} from "./ui.jsx";
import { useT, useLocale } from "../i18n.jsx";

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`); // mezzogiorno: immune ai cambi d'ora
  d.setDate(d.getDate() + n);
  return toISO(d);
};
const isWeekend = (iso) => {
  const dow = new Date(`${iso}T12:00:00`).getDay();
  return dow === 0 || dow === 6;
};
const eachDay = (from, to) => {
  const days = [];
  for (let d = from; d <= to && days.length < 366; d = addDays(d, 1)) days.push(d);
  return days;
};

const DEFAULT_SHIFTS = [
  { code: "M", labelKey: "slots.shift_morning", start: "06:00", end: "14:00" },
  { code: "P", labelKey: "slots.shift_afternoon", start: "14:00", end: "22:00" },
  { code: "N", labelKey: "slots.shift_night", start: "22:00", end: "06:00" },
];

export default function Slots({ dsId, onChanged, onNext }) {
  const t = useT();
  const locale = useLocale();
  const today = toISO(new Date());
  const [slots, setSlots] = useState([]);
  const [shifts, setShifts] = useState(() =>
    DEFAULT_SHIFTS.map(({ labelKey, ...s }) => ({ ...s, label: t(labelKey) }))
  );
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 6));
  const [skipWeekend, setSkipWeekend] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => api.slots(dsId).then(setSlots);
  useEffect(() => {
    load();
  }, [dsId]);

  const changed = () => {
    load();
    onChanged();
  };

  const setShift = (i, field, value) =>
    setShifts(shifts.map((s, j) => (j === i ? { ...s, [field]: value } : s)));

  const days = eachDay(from, to).filter((d) => !skipWeekend || !isWeekend(d));
  const validShifts = shifts.filter((s) => s.code.trim());
  const toCreate = days.length * validShifts.length;

  const generate = async () => {
    setBusy(true);
    try {
      const list = days.flatMap((day) =>
        validShifts.map((s) => ({
          dataset: dsId,
          day,
          code: s.code.trim(),
          label: s.label,
          start: s.start || null,
          end: s.end || null,
        }))
      );
      await api.createSlots(list);
      changed();
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    await api.clearSlots(dsId);
    changed();
  };

  const removeSlot = async (s) => {
    await api.deleteSlot(s.id);
    changed();
  };

  const byDay = {};
  slots.forEach((s) => (byDay[s.day] ??= []).push(s));
  const slotDays = Object.keys(byDay).sort();
  const colorByCode = codeColors(slots.map((s) => s.code));

  return (
    <div className="space-y-6 max-w-5xl">
      <StepHeader step={3} title={t("slots.title")}>
        {t("slots.desc")}
      </StepHeader>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
        <aside className="space-y-4">
          <section className="bg-white/70 backdrop-blur border border-slate-200/70 rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.06)] p-4 space-y-4">
            <h3 className="font-medium">{t("slots.generate_title")}</h3>

            <div>
              <p className="text-sm text-muted mb-2">{t("slots.step_bands")}</p>
              <div className="space-y-2">
                {shifts.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={s.code}
                      onChange={(e) => setShift(i, "code", e.target.value)}
                      placeholder="M"
                      title={t("slots.code_title")}
                      className="w-12 bg-white border border-line rounded px-2 py-1.5 font-mono text-center focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      value={s.label}
                      onChange={(e) => setShift(i, "label", e.target.value)}
                      placeholder={t("slots.label_placeholder")}
                      className="flex-1 min-w-0 bg-white border border-line rounded px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="time"
                      value={s.start}
                      onChange={(e) => setShift(i, "start", e.target.value)}
                      className="bg-white border border-line rounded px-1.5 py-1.5 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="time"
                      value={s.end}
                      onChange={(e) => setShift(i, "end", e.target.value)}
                      className="bg-white border border-line rounded px-1.5 py-1.5 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => setShifts(shifts.filter((_, j) => j !== i))}
                      title={t("slots.remove_band")}
                      className="font-mono text-danger/70 hover:text-danger px-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  setShifts([...shifts, { code: "", label: "", start: "", end: "" }])
                }
                className="text-xs font-medium text-muted hover:text-paper mt-2"
              >
                {t("slots.add_band")}
              </button>
            </div>

            <div>
              <p className="text-sm text-muted mb-2">{t("slots.step_period")}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("slots.from")}>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label={t("slots.to")}>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted mt-2">
                <input
                  type="checkbox"
                  checked={skipWeekend}
                  onChange={(e) => setSkipWeekend(e.target.checked)}
                  className="accent-[#059669]"
                />
                {t("slots.skip_weekend")}
              </label>
            </div>

            <button
              onClick={generate}
              disabled={busy || toCreate === 0}
              className={btnPrimary}
            >
              {busy
                ? t("slots.creating")
                : t("slots.generate_btn", {
                    n: toCreate,
                    days: days.length,
                    bands: validShifts.length,
                  })}
            </button>
          </section>

          <Hint title={t("slots.hint_title")}>
            <p>
              {t("slots.hint_1")}{" "}
              <code className="font-mono text-op">{t("slots.hint_code1")}</code>,{" "}
              <code className="font-mono text-op">{t("slots.hint_code2")}</code>
              {t("slots.hint_2")}
            </p>
          </Hint>
        </aside>

        <section>
          <div className="flex items-baseline gap-4 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("slots.in_project", { n: slots.length })}
            </h3>
            {slots.length > 0 && (
              <span className="ml-auto">
                <ConfirmButton
                  onConfirm={clearAll}
                  confirmLabel={t("slots.clear_confirm", { n: slots.length })}
                  className="text-xs font-medium text-danger/70 hover:text-danger"
                >
                  {t("slots.clear_all")}
                </ConfirmButton>
              </span>
            )}
          </div>
          {slots.length === 0 ? (
            <EmptyState>{t("slots.empty")}</EmptyState>
          ) : (
            <div className="space-y-3">
              {slotDays.map((day) => (
                <div key={day} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted w-28">
                    {new Date(`${day}T12:00:00`).toLocaleDateString(locale, {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                  {byDay[day].map((s) => (
                    <span
                      key={s.id}
                      className={`group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-xs font-semibold ${
                        colorByCode[s.code] || "bg-slate-100 text-slate-600"
                      }`}
                      title={`${s.label || s.code} ${s.start?.slice(0, 5) ?? ""}–${s.end?.slice(0, 5) ?? ""}`}
                    >
                      <span>{s.code}</span>
                      <span className="opacity-60 font-normal">
                        {s.start?.slice(0, 5)}–{s.end?.slice(0, 5)}
                      </span>
                      <button
                        onClick={() => removeSlot(s)}
                        className="text-danger/0 group-hover:text-danger/80"
                        title={t("slots.delete_one")}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {slots.length > 0 && (
        <div className="flex items-center gap-3 pt-2 border-t border-line">
          <button onClick={onNext} className={btnPrimary}>
            {t("slots.continue")}
          </button>
          <span className="text-muted text-sm">{t("slots.footer_note")}</span>
        </div>
      )}
    </div>
  );
}
