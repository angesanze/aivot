import React, { useEffect, useState } from "react";
import { api } from "../api";
import {
  StepHeader, Hint, Field, EmptyState, ConfirmButton, codeColors,
  inputCls, btnPrimary, btnGhost,
} from "./ui.jsx";

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
  { code: "M", label: "Mattino", start: "06:00", end: "14:00" },
  { code: "P", label: "Pomeriggio", start: "14:00", end: "22:00" },
  { code: "N", label: "Notte", start: "22:00", end: "06:00" },
];

export default function Slots({ dsId, onChanged, onNext }) {
  const today = toISO(new Date());
  const [slots, setSlots] = useState([]);
  const [shifts, setShifts] = useState(DEFAULT_SHIFTS);
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
      <StepHeader step={3} title="Definisci i turni da coprire">
        Un turno è una casella da riempire: un giorno più una fascia oraria
        (es. "lunedì 7 luglio, Mattino"). Invece di inserirli a mano, descrivi
        le fasce della giornata e il periodo: li generiamo noi per ogni giorno.
      </StepHeader>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
        <aside className="space-y-4">
          <section className="bg-white/70 backdrop-blur border border-slate-200/70 rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.06)] p-4 space-y-4">
            <h3 className="font-medium">Genera i turni</h3>

            <div>
              <p className="text-sm text-muted mb-2">
                1 · Le fasce della giornata
              </p>
              <div className="space-y-2">
                {shifts.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={s.code}
                      onChange={(e) => setShift(i, "code", e.target.value)}
                      placeholder="M"
                      title="Codice breve (compare nella griglia)"
                      className="w-12 bg-white border border-line rounded px-2 py-1.5 font-mono text-center focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      value={s.label}
                      onChange={(e) => setShift(i, "label", e.target.value)}
                      placeholder="Nome"
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
                      title="Rimuovi fascia"
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
                + aggiungi fascia
              </button>
            </div>

            <div>
              <p className="text-sm text-muted mb-2">2 · Il periodo</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dal">
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Al (incluso)">
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
                Salta sabato e domenica
              </label>
            </div>

            <button
              onClick={generate}
              disabled={busy || toCreate === 0}
              className={btnPrimary}
            >
              {busy
                ? "Creazione…"
                : `Genera ${toCreate} turni (${days.length} giorni × ${validShifts.length} fasce)`}
            </button>
          </section>

          <Hint title="E se i miei 'turni' sono aule o postazioni?">
            <p>
              Il codice della fascia è libero: al posto di M/P/N puoi usare{" "}
              <code className="font-mono text-op">Aula-1</code>,{" "}
              <code className="font-mono text-op">Sala-2</code>… Ogni
              combinazione giorno + codice è una casella che il motore può
              assegnare a una persona.
            </p>
          </Hint>
        </aside>

        <section>
          <div className="flex items-baseline gap-4 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Turni nel progetto · {slots.length}
            </h3>
            {slots.length > 0 && (
              <span className="ml-auto">
                <ConfirmButton
                  onConfirm={clearAll}
                  confirmLabel={`Eliminare tutti i ${slots.length} turni?`}
                  className="text-xs font-medium text-danger/70 hover:text-danger"
                >
                  svuota tutti
                </ConfirmButton>
              </span>
            )}
          </div>
          {slots.length === 0 ? (
            <EmptyState>
              Nessun turno ancora. Imposta fasce e periodo nel modulo a fianco
              e premi "Genera": creeremo un turno per ogni giorno × fascia.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {slotDays.map((day) => (
                <div key={day} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted w-28">
                    {new Date(`${day}T12:00:00`).toLocaleDateString("it-IT", {
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
                        title="Elimina questo turno"
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
            Continua: imposta le regole →
          </button>
          <span className="text-muted text-sm">
            Passa sopra un turno con il mouse per eliminarlo singolarmente.
          </span>
        </div>
      )}
    </div>
  );
}
