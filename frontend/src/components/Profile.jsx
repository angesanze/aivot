import React, { useState } from "react";
import { api } from "../api";
import { Field, Hint, inputCls, btnPrimary, cardCls } from "./ui.jsx";

/* Area utente: i propri dati e la password, modificabili dalla
   piattaforma senza passare dal backoffice. */

function DataCard({ user, onUserChanged }) {
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
      <h3 className="font-medium">I tuoi dati</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nome">
          <input value={form.first_name} onChange={set("first_name")} className={inputCls} />
        </Field>
        <Field label="Cognome">
          <input value={form.last_name} onChange={set("last_name")} className={inputCls} />
        </Field>
      </div>
      <Field
        label="Email"
        hint="Qui arrivano le comunicazioni di servizio e il recupero password."
      >
        <input type="email" value={form.email} onChange={set("email")} className={inputCls} />
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy || !form.email} className={btnPrimary}>
          {busy ? "Salvataggio…" : "Salva i dati"}
        </button>
        {saved && <span className="text-sm text-op font-medium">✓ Salvato</span>}
      </div>
    </section>
  );
}

function PasswordCard({ user, onUserChanged }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    if (next !== confirm) {
      setError("Le due password non coincidono.");
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
        {user.has_password ? "Cambia password" : "Imposta una password"}
      </h3>
      {!user.has_password && (
        <p className="text-sm text-muted">
          Sei entrato con Google: impostando una password potrai accedere
          anche con nome utente e password.
        </p>
      )}
      {user.has_password && (
        <Field label="Password attuale">
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
        <Field label="Nuova password">
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Min 8 caratteri"
            autoComplete="new-password"
            className={inputCls}
          />
        </Field>
        <Field label="Conferma">
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
          {busy ? "Aggiornamento…" : "Aggiorna password"}
        </button>
        {done && (
          <span className="text-sm text-op font-medium">
            ✓ Fatto — gli accessi sugli altri dispositivi sono stati chiusi
          </span>
        )}
      </div>
    </section>
  );
}

export default function Profile({ user, onUserChanged }) {
  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Il tuo profilo
        </h2>
        <p className="text-muted text-[15px] mt-3 leading-relaxed">
          Accedi come{" "}
          <span className="font-mono text-paper">{user.username}</span>
          {user.has_password ? "" : " (account Google)"} — il nome utente non
          si può cambiare. Tutto il resto sì.
        </p>
      </header>

      <DataCard user={user} onUserChanged={onUserChanged} />
      <PasswordCard user={user} onUserChanged={onUserChanged} />

      <Hint title="E per eliminare l'account?">
        <p>
          Per ora scrivici: l'eliminazione cancella definitivamente progetti,
          pianificazioni e ricette pubblicate, quindi preferiamo un passaggio
          umano. L'autoeliminazione arriverà con le impostazioni avanzate.
        </p>
      </Hint>
    </div>
  );
}
