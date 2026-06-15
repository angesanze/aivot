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

## Deploy to Google Cloud

One button provisions the whole stack on a fresh (or existing) Google
Cloud project — Cloud SQL, Cloud Run for the Django backend, Firebase
Hosting for the frontend, and the Cloud Tasks queues that run emails and
solver jobs in the background:

[![Open in Cloud Shell](https://gstatic.com/cloudssh/images/open-btn.svg)](https://shell.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https://github.com/angesanze/aivot&cloudshell_working_dir=infra&cloudshell_command=bash%20deploy.sh)

The button opens Google Cloud Shell with the repo cloned into `infra/`. If
it doesn't start the script on its own, just run it:

```bash
bash deploy.sh
```

It asks for a project id and a billing account, then does the rest
(Terraform + Cloud Build + migration job + Firebase). ~10–15 minutes,
mostly Cloud SQL provisioning. At the end it prints the frontend, backend
and admin URLs.

> **Note**: creating a *new* project requires you to pick a billing
> account — Google does not allow that to be fully unattended (cost
> protection). Everything after that is automatic.

By default the button is a **one-shot manual deploy** (Terraform state
stays local in Cloud Shell). To redeploy, run `bash deploy.sh` again.

### Want push-to-deploy CI/CD? Answer "yes" to one prompt

When `deploy.sh` asks **"Configurare anche la pipeline CI/CD
push-to-deploy?"**, answer `true`. It then:

- keeps Terraform state in a shared GCS bucket (created automatically),
- creates a deploy service account,
- and — if the [`gh`](https://cli.github.com) CLI is logged in
  (`gh auth login`) — **sets the GitHub secrets/variables on your repo for
  you**, detecting the repo from your clone's `git remote`.

After that, every push to the `production` branch deploys automatically:

```bash
git push origin main:production
```

### Fork & deploy (for your own copy)

1. **Fork** this repo.
2. In your fork's `README.md`, point the Cloud Shell button at your repo —
   replace `angesanze/aivot` in the button URL above with `your-user/your-fork`
   (or just open Cloud Shell on your fork and run `bash deploy.sh`).
3. Click the button → `bash deploy.sh` → answer `true` to the pipeline
   prompt. With `gh` logged in, the secrets are configured automatically;
   otherwise the script prints the exact commands to run.
4. `git push origin main:production` to deploy.

The full runbook, the least-privilege role list, and how to migrate a
pre-existing local-state deploy onto the pipeline are in
[`infra/README.md`](infra/README.md).

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
docker compose exec backend python manage.py test    # 68 tests
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

Async solve and email **are done**: on the Google Cloud deploy they run on
Cloud Tasks queues (locally they stay inline — same code, automatic
fallback). Next:

1. Warm start: feed the last solution as a hint when re-planning
2. Conditional rules ("if working Saturday, then Sunday off") in the
   custom rule builder
3. Alternative email providers (generic SMTP)
