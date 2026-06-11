import React, { useEffect, useState } from "react";
import { api, getToken, onUnauthorized } from "./api";
import Login from "./components/Login.jsx";
import ProjectPicker from "./components/ProjectPicker.jsx";
import { BookIcon, CheckIcon, FolderIcon, StoreIcon } from "./components/icons.jsx";
import Store from "./components/Store.jsx";
import Profile from "./components/Profile.jsx";
import DatasetStep from "./components/DatasetStep.jsx";
import Resources from "./components/Resources.jsx";
import Slots from "./components/Slots.jsx";
import Composer from "./components/Composer.jsx";
import Runs from "./components/Runs.jsx";
import Archive from "./components/Archive.jsx";
import Catalog from "./components/Catalog.jsx";
import { LANGS, useI18n, useT } from "./i18n.jsx";

/* Percorso guidato: l'utente segue i passi in ordine la prima volta,
   poi salta liberamente. Il catalogo è consultazione, fuori dal flusso. */
const STEPS = [
  { id: "dataset", labelKey: "app.step.dataset", needsDs: false },
  { id: "people", labelKey: "app.step.people", needsDs: true, countKey: "resources_count" },
  { id: "slots", labelKey: "app.step.slots", needsDs: true, countKey: "slots_count" },
  { id: "rules", labelKey: "app.step.rules", needsDs: true, countKey: "constraints_count" },
  { id: "solve", labelKey: "app.step.solve", needsDs: true },
];

/* Cambio lingua compatto: due bottoncini IT/EN, l'attivo è evidenziato. */
function LangSwitcher({ className = "" }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          title={l.label}
          className={`px-2 py-1 rounded-lg text-[11px] font-semibold tracking-wide transition-colors ${
            lang === l.code
              ? "bg-white/10 text-white"
              : "text-slate-500 hover:text-white"
          }`}
        >
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Logo() {
  const t = useT();
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo.svg"
        alt=""
        className="w-9 h-9 rounded-xl shadow-lg shadow-emerald-500/30"
      />
      <div className="leading-tight">
        <p className="font-brand text-lg tracking-[0.14em] text-white">
          AIVOT
        </p>
        <p className="text-[11px] text-slate-400">{t("brand.tagline")}</p>
      </div>
    </div>
  );
}

/* Una voce del percorso: numero, spunta quando il passo è completo,
   contatore di cosa contiene. */
function StepButton({ step, index, active, disabled, done, count, onClick, vertical }) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? t("app.need_project") : undefined}
      className={`flex items-center gap-3 rounded-xl text-sm transition-all whitespace-nowrap ${
        vertical ? "w-full px-3 py-2.5" : "px-3 py-2"
      } ${
        active
          ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-white font-semibold ring-1 ring-inset ring-emerald-400/40"
          : disabled
            ? "text-slate-600 cursor-not-allowed"
            : "text-slate-300 hover:text-white hover:bg-white/5"
      }`}
    >
      <span
        className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 transition-all ${
          done
            ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md shadow-emerald-500/40"
            : active
              ? "ring-2 ring-inset ring-emerald-400 text-emerald-300"
              : disabled
                ? "ring-1 ring-inset ring-slate-700 text-slate-600"
                : "ring-1 ring-inset ring-slate-500 text-slate-300"
        }`}
      >
        {done ? <CheckIcon /> : index + 1}
      </span>
      {t(step.labelKey)}
      {count != null && count > 0 && (
        <span className="ml-auto text-[11px] font-semibold text-slate-200 bg-white/10 rounded-full px-2 py-0.5">
          {count}
        </span>
      )}
    </button>
  );
}

export default function App() {
  const t = useT();
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [dsId, setDsId] = useState(null);
  // ?step=people|slots|rules|solve|catalog apre direttamente quel passo
  const [step, setStep] = useState(
    () => new URLSearchParams(window.location.search).get("step") || "dataset"
  );
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = () =>
    api
      .datasets()
      .then((d) => {
        setDatasets(d);
        setError(null);
        return d;
      })
      .catch((e) => setError(e.message));

  // Sessione: riconosce il token salvato; un 401 da qualunque chiamata
  // rimanda alla schermata di accesso.
  useEffect(() => {
    onUnauthorized(() => setUser(null));
    if (getToken()) {
      api
        .me()
        .then(setUser)
        .catch((e) => console.warn("Sessione non ripristinata:", e.message))
        .finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, []);

  // I dati si caricano solo a utente autenticato
  useEffect(() => {
    if (!user) return;
    refresh().then((d) => {
      if (d?.length) setDsId(d[0].id);
      setLoaded(true);
    });
  }, [user]);

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
    setDatasets([]);
    setDsId(null);
    setStep("dataset");
    setLoaded(false);
  };

  if (!authChecked) return null;
  if (!user) return <Login onAuth={setUser} />;

  const current = datasets.find((d) => d.id === dsId) || null;

  const isDone = {
    dataset: !!current,
    people: (current?.resources_count ?? 0) > 0,
    slots: (current?.slots_count ?? 0) > 0,
    rules: (current?.constraints_count ?? 0) > 0,
    solve: false,
  };

  const openDataset = (id) => {
    setDsId(id);
    setStep("people");
  };

  const goTo = (id) => setStep(id);

  const projectPicker = current && (
    <ProjectPicker datasets={datasets} value={dsId} onChange={setDsId} />
  );

  const stepButtons = (vertical) =>
    STEPS.map((s, i) => (
      <StepButton
        key={s.id}
        step={s}
        index={i}
        vertical={vertical}
        active={step === s.id}
        disabled={s.needsDs && !dsId}
        done={isDone[s.id]}
        count={s.countKey && current ? current[s.countKey] : null}
        onClick={() => setStep(s.id)}
      />
    ));

  const archiveBtn = (extra = "") => (
    <button
      onClick={() => setStep("archive")}
      disabled={!dsId}
      title={!dsId ? t("app.need_project") : undefined}
      className={`flex items-center gap-2.5 rounded-xl text-sm transition-colors ${extra} ${
        step === "archive"
          ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-white font-semibold ring-1 ring-emerald-400/30"
          : !dsId
            ? "text-slate-600 cursor-not-allowed"
            : "text-slate-400 hover:text-white hover:bg-white/5"
      }`}
    >
      <FolderIcon />
      {t("app.nav.archive")}
    </button>
  );

  const catalogBtn = (extra = "") => (
    <button
      onClick={() => setStep("catalog")}
      className={`flex items-center gap-2.5 rounded-xl text-sm transition-colors ${extra} ${
        step === "catalog"
          ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-white font-semibold ring-1 ring-emerald-400/30"
          : "text-slate-400 hover:text-white hover:bg-white/5"
      }`}
    >
      <BookIcon />
      {t("app.nav.catalog")}
    </button>
  );

  const storeBtn = (extra = "") => (
    <button
      onClick={() => setStep("store")}
      className={`flex items-center gap-2.5 rounded-xl text-sm transition-colors ${extra} ${
        step === "store"
          ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-white font-semibold ring-1 ring-emerald-400/30"
          : "text-slate-400 hover:text-white hover:bg-white/5"
      }`}
    >
      <StoreIcon />
      {t("app.nav.store")}
    </button>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar scura: il percorso sempre visibile, con lo stato di avanzamento. */}
      <aside className="hidden md:flex md:flex-col w-72 shrink-0 bg-slate-900 px-5 py-7 gap-7 sticky top-0 h-screen">
        <Logo />
        {current && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1">
              {t("app.active_project")}
            </p>
            {projectPicker}
          </div>
        )}
        <nav className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1">
            {t("app.path")}
          </p>
          {stepButtons(true)}
        </nav>
        <div className="mt-auto border-t border-slate-800 pt-4 space-y-1.5">
          {archiveBtn("w-full px-3 py-2.5")}
          {storeBtn("w-full px-3 py-2.5")}
          {catalogBtn("w-full px-3 py-2.5")}
          <LangSwitcher className="px-3 pt-2" />
          <div className="flex items-center gap-2.5 px-3 pt-3">
            <button
              onClick={() => setStep("profile")}
              title={t("app.profile_title")}
              className={`flex items-center gap-2.5 min-w-0 rounded-lg px-1.5 py-1 -ml-1.5 transition-colors ${
                step === "profile"
                  ? "bg-white/10 text-white"
                  : "hover:bg-white/5"
              }`}
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-slate-200 text-xs font-bold uppercase shrink-0">
                {user.username.slice(0, 2)}
              </span>
              <span className="text-sm text-slate-300 truncate">
                {user.username}
              </span>
            </button>
            <button
              onClick={logout}
              className="ml-auto text-xs font-medium text-slate-500 hover:text-white transition-colors shrink-0"
              title={t("app.logout_title")}
            >
              {t("app.logout")}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Intestazione mobile: logo, progetto e passi scorrevoli. */}
        <div className="md:hidden bg-slate-900 px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <Logo />
            <div className="ml-auto w-44">{projectPicker}</div>
            <button
              onClick={() => setStep("profile")}
              title={t("app.profile_title_short")}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-slate-200 text-xs font-bold uppercase shrink-0"
            >
              {user.username.slice(0, 2)}
            </button>
            <button
              onClick={logout}
              className="text-xs font-medium text-slate-500 hover:text-white transition-colors shrink-0"
              title={t("app.logout_title_user", { username: user.username })}
            >
              {t("app.logout")}
            </button>
            <LangSwitcher />
          </div>
          <nav className="flex gap-1 overflow-x-auto p-1 -mx-1">
            {stepButtons(false)}
            {archiveBtn("px-3 py-2")}
            {storeBtn("px-3 py-2")}
            {catalogBtn("px-3 py-2")}
          </nav>
        </div>

        <main className="p-6 lg:p-10 max-w-5xl mx-auto w-full">
          {error && (
            <div className="bg-rose-50/80 backdrop-blur border border-rose-200 rounded-2xl px-4 py-3 mb-6">
              <p className="text-danger text-sm font-medium">
                {t("app.server_unreachable", { error })}
              </p>
            </div>
          )}
          {loaded && step === "dataset" && (
            <DatasetStep
              datasets={datasets}
              currentId={dsId}
              onOpen={openDataset}
              onChanged={refresh}
            />
          )}
          {dsId && step === "people" && (
            <Resources dsId={dsId} onChanged={refresh} onNext={() => goTo("slots")} />
          )}
          {dsId && step === "slots" && (
            <Slots dsId={dsId} onChanged={refresh} onNext={() => goTo("rules")} />
          )}
          {dsId && step === "rules" && (
            <Composer dsId={dsId} onChanged={refresh} onNext={() => goTo("solve")} />
          )}
          {dsId && step === "solve" && (
            <Runs dsId={dsId} dataset={current} onGoTo={goTo} />
          )}
          {dsId && step === "archive" && <Archive dsId={dsId} onGoTo={goTo} />}
          {step === "store" && <Store dataset={current} onGoTo={goTo} />}
          {step === "catalog" && <Catalog />}
          {step === "profile" && (
            <Profile user={user} onUserChanged={setUser} />
          )}
        </main>
      </div>
    </div>
  );
}
