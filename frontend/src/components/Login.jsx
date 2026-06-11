import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { LANGS, useI18n, useT } from "../i18n.jsx";

/* Schermata di accesso: login, registrazione completa, recupero password
   e Google Sign-In. Unica pagina visibile senza credenziali. */

const field =
  "w-full bg-white/10 border border-white/15 text-white placeholder:text-slate-400 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-colors";

const primaryBtn =
  "w-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-sm font-semibold py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50 hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0";

/* Bottone Google ufficiale (Google Identity Services): compare solo se il
   server ha un client ID configurato. */
function GoogleButton({ clientId, onAuth, onError }) {
  const ref = useRef(null);
  const { lang, t } = useI18n();

  useEffect(() => {
    if (!clientId) return;
    const init = () => {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) =>
          api.googleLogin(resp.credential).then(onAuth).catch((e) => onError(e.message)),
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
        locale: lang,
      });
    };
    if (window.google?.accounts?.id) {
      init();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = init;
    document.head.appendChild(s);
  }, [clientId, lang]);

  if (!clientId) return null;
  return (
    <>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="flex-1 h-px bg-white/10" />
        {t("login.or")}
        <span className="flex-1 h-px bg-white/10" />
      </div>
      <div ref={ref} className="flex justify-center" />
    </>
  );
}

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

export default function Login({ onAuth }) {
  const t = useT();
  // login | register | forgot | reset
  const [mode, setMode] = useState(() =>
    new URLSearchParams(window.location.search).get("reset") ? "reset" : "login"
  );
  const [resetCode] = useState(
    () => new URLSearchParams(window.location.search).get("reset") || ""
  );
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    password: "",
    password2: "",
    terms: false,
  });
  const [googleClientId, setGoogleClientId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    api
      .authConfig()
      .then((c) => setGoogleClientId(c.google_client_id))
      .catch(() => {});
  }, []);

  const set = (k) => (e) =>
    setForm({ ...form, [k]: k === "terms" ? e.target.checked : e.target.value });

  const switchMode = (m) => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  const canSubmit = {
    login: form.username && form.password,
    register:
      form.first_name &&
      form.last_name &&
      form.email &&
      form.username &&
      form.password &&
      form.password2 &&
      form.terms,
    forgot: form.email,
    reset: form.password && form.password2,
  }[mode];

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if ((mode === "register" || mode === "reset") && form.password !== form.password2) {
      setError(t("login.password_mismatch"));
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        onAuth(await api.login({ username: form.username, password: form.password }));
      } else if (mode === "register") {
        onAuth(
          await api.register({
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email,
            username: form.username,
            password: form.password,
          })
        );
      } else if (mode === "forgot") {
        const r = await api.forgotPassword(form.email);
        setNotice(r.detail);
        setBusy(false);
      } else if (mode === "reset") {
        const user = await api.resetPassword(resetCode, form.password);
        window.history.replaceState({}, "", window.location.pathname);
        onAuth(user);
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.15),transparent_60%)]">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-end">
          <LangSwitcher />
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src="/logo.svg"
            alt=""
            className="w-16 h-16 rounded-2xl shadow-lg shadow-emerald-500/40"
          />
          <div>
            <h1 className="font-brand text-3xl tracking-[0.16em] text-white">
              AIVOT
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {t("brand.tagline")} — {t("login.subtitle")}
            </p>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/40 space-y-5">
          {(mode === "login" || mode === "register") && (
            <div className="flex text-sm font-semibold rounded-xl bg-white/5 p-1">
              {[
                ["login", t("login.tab_login")],
                ["register", t("login.tab_register")],
              ].map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-2 rounded-lg transition-all ${
                    mode === m
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {mode === "forgot" && (
            <div>
              <h2 className="text-white font-semibold">{t("login.forgot_title")}</h2>
              <p className="text-xs text-slate-400 mt-1">
                {t("login.forgot_text")}
              </p>
            </div>
          )}
          {mode === "reset" && (
            <div>
              <h2 className="text-white font-semibold">{t("login.reset_title")}</h2>
              <p className="text-xs text-slate-400 mt-1">
                {t("login.reset_text")}
              </p>
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  autoFocus
                  value={form.first_name}
                  onChange={set("first_name")}
                  placeholder={t("login.first_name")}
                  autoComplete="given-name"
                  className={field}
                />
                <input
                  value={form.last_name}
                  onChange={set("last_name")}
                  placeholder={t("login.last_name")}
                  autoComplete="family-name"
                  className={field}
                />
              </div>
            )}

            {(mode === "register" || mode === "forgot") && (
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder={t("login.email")}
                autoComplete="email"
                className={field}
              />
            )}

            {(mode === "login" || mode === "register") && (
              <input
                autoFocus={mode === "login"}
                value={form.username}
                onChange={set("username")}
                placeholder={t("login.username")}
                autoComplete="username"
                className={field}
              />
            )}

            {mode !== "forgot" && (
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder={
                  mode === "login" ? t("login.password") : t("login.password_min")
                }
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className={field}
              />
            )}

            {(mode === "register" || mode === "reset") && (
              <input
                type="password"
                value={form.password2}
                onChange={set("password2")}
                placeholder={t("login.password_confirm")}
                autoComplete="new-password"
                className={field}
              />
            )}

            {mode === "register" && (
              <label className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.terms}
                  onChange={set("terms")}
                  className="mt-0.5 accent-emerald-500"
                />
                <span>{t("login.terms")}</span>
              </label>
            )}

            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs text-slate-400 hover:text-emerald-300 transition-colors"
                >
                  {t("login.forgot_title")}
                </button>
              </div>
            )}

            {error && <p className="text-sm text-rose-400">{error}</p>}
            {notice && <p className="text-sm text-emerald-300">{notice}</p>}

            <button type="submit" disabled={busy || !canSubmit} className={primaryBtn}>
              {busy
                ? t("login.busy")
                : t(
                    {
                      login: "login.tab_login",
                      register: "login.submit_register",
                      forgot: "login.submit_forgot",
                      reset: "login.submit_reset",
                    }[mode]
                  )}
            </button>
          </form>

          {(mode === "login" || mode === "register") && (
            <GoogleButton
              clientId={googleClientId}
              onAuth={onAuth}
              onError={setError}
            />
          )}

          {(mode === "forgot" || mode === "reset") && (
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              {t("login.back")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
