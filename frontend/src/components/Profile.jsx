import React, { useState } from "react";
import { api } from "../api";
import { Field, Hint, inputCls, btnPrimary, cardCls } from "./ui.jsx";
import { useT } from "../i18n.jsx";

/* Area utente: i propri dati e la password, modificabili dalla
   piattaforma senza passare dal backoffice. */

function DataCard({ user, onUserChanged }) {
  const t = useT();
  const [form, setForm] = useState({
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    email: user.email || "",
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    setSaved(false);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateMe(form);
      onUserChanged(updated);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${cardCls} p-5 space-y-3`}>
      <h3 className="font-medium">{t("profile.data_title")}</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t("profile.first_name")}>
          <input value={form.first_name} onChange={set("first_name")} className={inputCls} />
        </Field>
        <Field label={t("profile.last_name")}>
          <input value={form.last_name} onChange={set("last_name")} className={inputCls} />
        </Field>
      </div>
      <Field
        label={t("profile.email")}
        hint={t("profile.email_hint")}
      >
        <input type="email" value={form.email} onChange={set("email")} className={inputCls} />
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy || !form.email} className={btnPrimary}>
          {busy ? t("profile.saving") : t("profile.save_data")}
        </button>
        {saved && <span className="text-sm text-op font-medium">{t("profile.saved")}</span>}
      </div>
    </section>
  );
}

function PasswordCard({ user, onUserChanged }) {
  const t = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    if (next !== confirm) {
      setError(t("profile.password_mismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.changePassword({
        current_password: current,
        new_password: next,
      });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      if (!user.has_password) onUserChanged({ ...user, has_password: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${cardCls} p-5 space-y-3`}>
      <h3 className="font-medium">
        {user.has_password ? t("profile.change_password") : t("profile.set_password")}
      </h3>
      {!user.has_password && (
        <p className="text-sm text-muted">
          {t("profile.google_hint")}
        </p>
      )}
      {user.has_password && (
        <Field label={t("profile.current_password")}>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className={inputCls}
          />
        </Field>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t("profile.new_password")}>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder={t("profile.min_chars")}
            autoComplete="new-password"
            className={inputCls}
          />
        </Field>
        <Field label={t("profile.confirm")}>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className={inputCls}
          />
        </Field>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy || !next || !confirm || (user.has_password && !current)}
          className={btnPrimary}
        >
          {busy ? t("profile.updating") : t("profile.update_password")}
        </button>
        {done && (
          <span className="text-sm text-op font-medium">
            {t("profile.password_done")}
          </span>
        )}
      </div>
    </section>
  );
}

export default function Profile({ user, onUserChanged }) {
  const t = useT();
  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
          {t("profile.title")}
        </h2>
        <p className="text-muted text-[15px] mt-3 leading-relaxed">
          {t("profile.intro_login_as")}{" "}
          <span className="font-mono text-paper">{user.username}</span>
          {user.has_password ? "" : ` ${t("profile.intro_google")}`}{" "}
          {t("profile.intro_rest")}
        </p>
      </header>

      <DataCard user={user} onUserChanged={onUserChanged} />
      <PasswordCard user={user} onUserChanged={onUserChanged} />

      <Hint title={t("profile.delete_title")}>
        <p>{t("profile.delete_text")}</p>
      </Hint>
    </div>
  );
}
