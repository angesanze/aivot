import React, { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronIcon } from "./icons.jsx";

/* Selettore del progetto attivo: dropdown custom coerente con la
   sidebar scura, al posto del select nativo del browser. */
export default function ProjectPicker({ datasets, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = datasets.find((d) => d.id === value);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-2 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm font-medium hover:border-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-colors"
      >
        <span className="truncate">{current?.name ?? "Scegli progetto"}</span>
        <span className="ml-auto">
          <ChevronIcon open={open} />
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1.5 w-full max-h-64 overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl shadow-xl shadow-black/40 p-1"
        >
          {datasets.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                role="option"
                aria-selected={d.id === value}
                onClick={() => {
                  onChange(d.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  d.id === value
                    ? "bg-emerald-500/15 text-emerald-300 font-semibold"
                    : "text-slate-200 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="truncate">{d.name}</span>
                {d.id === value && (
                  <span className="ml-auto text-emerald-400 shrink-0">
                    <CheckIcon />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
