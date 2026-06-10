# AIVOT

**Ogni vincolo, una soluzione.**

Piattaforma di pianificazione sotto vincoli: descrivi persone, turni e
regole — il motore CP-SAT (Google OR-Tools) calcola la pianificazione
migliore e, quando non esiste, ti spiega *perché* e *quali* regole sono
in conflitto. La varietà sta nel catalogo dei vincoli: il motore è uno
e non cambia mai.

## Avvio in un comando

```bash
docker compose up --build
```

Fatto. Al primo avvio vengono creati automaticamente:

| Cosa | Dove | Credenziali |
|------|------|-------------|
| Piattaforma | http://localhost:5173 | registrati, oppure `demo` / `demo1234` |
| Backoffice Django | http://localhost:8001/admin/ | `admin` / `aivot-admin` |
| API | http://localhost:8001/api/ | token via `/api/auth/login/` |

L'utente `demo` ha già un progetto d'esempio (reparto infermieri: 9
persone, 7 giorni, turni M/P/N) pronto da pianificare. **Cambia la
password del superadmin in produzione** (o impostala via `.env` prima
del primo avvio).

## Configurazione (facoltativa)

Niente è hardcoded: tutto passa da variabili d'ambiente, con default
che funzionano out-of-the-box.

```bash
cp .env.example .env   # poi compila ciò che ti serve
```

| Variabile | A cosa serve |
|-----------|--------------|
| `BREVO_API_KEY` | Email transazionali (benvenuto, reset password). Vuota = invii saltati e annotati nei log, l'app funziona comunque |
| `BREVO_SENDER_EMAIL` | Mittente: **deve essere validato su Brevo** o appartenere a un dominio autenticato, altrimenti Brevo scarta la consegna |
| `BREVO_SENDER_NAME` | Nome mittente (default: AIVOT) |
| `GOOGLE_CLIENT_ID` | Abilita il bottone "Continua con Google" (OAuth Client ID da Google Cloud Console). Vuoto = bottone nascosto |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL` | Credenziali del superadmin creato al primo avvio |
| `FRONTEND_URL` | URL pubblico del frontend, usato nei link delle email |
| `DEBUG` / `SECRET_KEY` | Produzione: `DEBUG=0` esige una `SECRET_KEY` tua (l'avvio fallisce senza) e chiude il CORS |

Ogni valore email/Google è sovrascrivibile **a caldo dal backoffice**
(`/admin/` → Configurazione piattaforma), incluso un bottone "invia
email di prova". Il DB vince sull'ambiente; i campi vuoti ricadono
sull'ambiente.

> **Provider email**: oggi l'integrazione supporta **solo Brevo**
> (https://brevo.com, piano gratuito disponibile). L'invio è isolato in
> `backend/accounts/emails.py`: aggiungere SMTP generico o un altro
> provider significa toccare una sola funzione.

## Stack

- **Backend**: Django 5 + DRF · solver OR-Tools CP-SAT · PostgreSQL 16
  (sqlite come fallback automatico senza Docker)
- **Frontend**: React 18 + Vite + Tailwind

## Cosa c'è dentro

- **Percorso guidato in 5 passi**: progetto → persone (anche import
  Excel/CSV) → turni → regole → pianificazione
- **Catalogo di 21 regole** in 8 famiglie (copertura, capacità,
  sequenza, equità, persone…), ognuna usabile come **obbligo** o come
  **preferenza pesata**
- **Regola "Su misura"**: costruisci vincoli nuovi da un form guidato
  (per turno/persona/giorno/settimana/finestra mobile, con filtri per
  codice turno, skill, persona, giorni della settimana, intervallo di
  date) — senza scrivere codice
- **Esiti spiegati**: ogni run dice *perché* ha prodotto quel risultato;
  le griglie vuote vengono motivate, l'infeasibility elenca il nucleo
  minimo di regole in conflitto
- **Archivio pianificazioni**: rinomina, raggruppa, elimina, esporta CSV
- **Widget embeddabile**: ogni pianificazione genera un `<iframe>`
  pubblico (token revocabile) da incollare in qualsiasi sito
- **Store delle ricette**: pubblica i tuoi set di regole, installa
  quelli della community (solo dati, mai codice; moderazione da admin)
- **Area utente**: registrazione completa, Google Sign-In, reset
  password via email, profilo modificabile
- **Backoffice Django** con gestione di utenti, progetti, run, store e
  configurazione della piattaforma

## Architettura

```
UTENTE ── compone ──> ConstraintInstance (dati JSON a DB, mai codice)
                            │
                            ▼  traduzione a runtime
                  solver/handlers.py   registry: tipo -> ctx.limit(...)
                            │
                            ▼
                  solver/engine.py     CP-SAT a due fasi:
                            │          1) solve veloce (presolve pieno)
                            │          2) se INFEASIBLE, passata con
                            ▼             assumptions -> conflitti
                  Run + explain.py     assegnazioni, violazioni soft,
                                       conflitti hard, spiegazione
```

Aggiungere una regola = un handler in `solver/handlers.py` (poche righe
grazie a `ctx.limit`) + una voce in `catalog/data.py` + un test. Form,
catalogo UI, spiegazioni e store si aggiornano da soli. Il seed
verifica all'avvio la coerenza catalogo ↔ handler.

## Test

```bash
docker compose exec backend python manage.py test    # 62 test
```

Coprono motore (ogni famiglia di vincoli con verifica delle soluzioni
prodotte), autenticazione, isolamento multi-utente, store, import file
e widget pubblico.

## Sviluppo senza Docker

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate && python manage.py seed
python manage.py runserver           # sqlite se POSTGRES_HOST non è settato

cd ../frontend
npm install && npm run dev           # proxy /api -> :8000
```

## Roadmap

1. Solve asincrono (Cloud Tasks su GCP / coda) — oggi è sincrono, ok
   fino a pochi utenti simultanei
2. Warm start: l'ultima soluzione come hint per le ripianificazioni
3. Regole condizionali ("se lavora sabato, domenica libera") nel
   builder Su misura
4. Provider email alternativi (SMTP generico)
