import React, { useEffect, useState } from "react";
import { api } from "../api";
import { ScheduleGrid } from "./RunCard.jsx";
import { useT, useLocale } from "../i18n.jsx";

/* Pagina pubblica del widget (/embed/<token>): solo la griglia della
   pianificazione condivisa, pensata per vivere dentro un iframe. */
export default function Embed({ token }) {
  const t = useT();
  const locale = useLocale();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.embedRun(token).then(setData).catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <p className="text-sm text-slate-500 text-center">
          {t("embed.unavailable")}
        </p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-bold text-slate-900">{data.name}</h1>
        <span className="text-xs text-slate-400">
          {t("embed.updated_at", {
            date: new Date(data.created_at).toLocaleDateString(locale),
          })}
        </span>
      </header>

      <ScheduleGrid
        run={{ id: "widget", assignments: data.assignments }}
        resources={data.resources}
        slots={data.slots}
      />

      <footer className="mt-auto pt-2 border-t border-slate-100">
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-emerald-600 transition-colors"
        >
          <img src="/logo.svg" alt="" className="w-4 h-4 rounded" />
          {t("embed.created_with")}{" "}
          <span className="font-brand tracking-[0.12em]">AIVOT</span> —{" "}
          {t("brand.tagline")}
        </a>
      </footer>
    </div>
  );
}
