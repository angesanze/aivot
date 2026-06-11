<p align="center">
  <img src="frontend/public/logo.svg" width="110" alt="AIVOT logo" />
</p>

<h1 align="center">AIVOT</h1>

<p align="center"><b>Every constraint, a solution.</b></p>

Constraint-based planning platform: describe people, shifts and rules —
the CP-SAT engine (Google OR-Tools) computes the best possible schedule
and, when none exists, explains *why* and *which* rules conflict. The
variety lives in the rule catalog: the engine is one and never changes.

Fully bilingual (English / Italian), switchable live from the UI.

## One-command start

```bash
docker compose up --build
```

Done. On first start the platform automatically creates:

| What | Where | Credentials |
|------|-------|-------------|
| Platform | http://localhost:5173 | sign up, or `demo` / `demo1234` |
| Django backoffice | http://localhost:8001/admin/ | `admin` / `aivot-admin` |
| API | http://localhost:8001/api/ | token via `/api/auth/login/` |

The `demo` user comes with a sample project (hospital ward: 9 nurses,
7 days, M/P/N shifts) ready to schedule. **Change the superadmin
password in production** (or set it via `.env` before first start).

## Configuration (optional)

Nothing is hardcoded: everything comes from environment variables, with
defaults that work out of the box.

```bash
cp .env.example .env   # then fill in what you need
```

| Variable | Purpose |
|----------|---------|
| `BREVO_API_KEY` | Transactional emails (welcome, password reset). Empty = sends are skipped and logged; the app keeps working |
| `BREVO_SENDER_EMAIL` | Sender address: **must be a validated sender on Brevo** or belong to an authenticated domain, or Brevo silently drops delivery |
| `BREVO_SENDER_NAME` | Sender display name (default: AIVOT) |
| `GOOGLE_CLIENT_ID` | Enables the "Continue with Google" button (OAuth Client ID from Google Cloud Console). Empty = button hidden |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL` | Superadmin created on first start |
| `FRONTEND_URL` | Public frontend URL, used in email links |
| `DEBUG` / `SECRET_KEY` | Production: `DEBUG=0` requires your own `SECRET_KEY` (startup fails without it) and locks down CORS |

Every email/Google value can also be overridden **live from the
backoffice** (`/admin/` → Platform configuration), including a "send
test email" action. Database values win; empty fields fall back to the
environment.

> **Email provider**: the integration currently supports **Brevo only**
> (https://brevo.com, free tier available). Sending is isolated in
> `backend/accounts/emails.py`: adding generic SMTP or another provider
> means touching a single function.

## Stack

- **Backend**: Django 5 + DRF · OR-Tools CP-SAT solver · PostgreSQL 16
  (sqlite as automatic fallback without Docker)
- **Frontend**: React 18 + Vite + Tailwind

## What's inside

- **Guided 5-step flow**: project → people (with Excel/CSV bulk import)
  → shifts → rules → schedule
- **Catalog of 21 rules** across 8 families (coverage, capacity,
  sequence, fairness, people…), each usable as a **requirement** or a
  **weighted preference**
- **Custom rule builder**: create new constraints from a guided form
  (per shift / person / day / week / sliding window, with filters for
  shift code, skill, specific person, weekdays, date range) — no code
- **Explained outcomes**: every run says *why* it produced that result;
  empty grids are motivated, infeasibility lists the minimal core of
  conflicting rules
- **Schedule archive**: rename, group, delete, CSV export
- **Embeddable widget**: every schedule can generate a public `<iframe>`
  (revocable token) to paste into any website
- **Recipe store**: publish your rule sets, install the community's
  (data only, never code; admin moderation)
- **User area**: full registration, Google Sign-In, password reset via
  email, editable profile
- **Internationalization**: English and Italian end to end — UI, API
  messages, solver explanations, emails, and the rule catalog itself
  (translated at serialization time); adding a language = one JSON file
  on the frontend + one table on the backend
- **Django backoffice** managing users, projects, runs, store and
  platform configuration

## Architecture

```
USER ── composes ──> ConstraintInstance (JSON data in DB, never code)
                            │
                            ▼  runtime translation
                  solver/handlers.py   registry: type -> ctx.limit(...)
                            │
                            ▼
                  solver/engine.py     two-phase CP-SAT:
                            │          1) fast solve (full presolve)
                            │          2) if INFEASIBLE, assumptions
                            ▼             pass -> conflict core
                  Run + explain.py     assignments, soft violations,
                                       hard conflicts, explanation
```

Adding a rule = one handler in `solver/handlers.py` (a few lines thanks
to `ctx.limit`) + one entry in `catalog/data.py` (+ its English strings
in `catalog/translations.py`) + one test. Forms, catalog UI,
explanations and the store update themselves. The seed verifies
catalog ↔ handler consistency at startup.

## Tests

```bash
docker compose exec backend python manage.py test    # 67 tests
```

They cover the engine (every rule family, verified against the
solutions it produces), authentication, multi-user isolation, the
store, file import, the public widget and localization.

## Development without Docker

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate && python manage.py seed
python manage.py runserver           # sqlite if POSTGRES_HOST is unset

cd ../frontend
npm install && npm run dev           # proxies /api -> :8000
```

## Roadmap

1. Async solve (Cloud Tasks on GCP / a queue) — currently synchronous,
   fine up to a few concurrent users
2. Warm start: feed the last solution as a hint when re-planning
3. Conditional rules ("if working Saturday, then Sunday off") in the
   custom rule builder
4. Alternative email providers (generic SMTP)
