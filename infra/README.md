# Deploy AIVOT on Google Cloud

This folder provisions and deploys the whole platform on Google Cloud:

```
project + billing + APIs
  ├─ Cloud SQL (PostgreSQL 16)        ← application database
  ├─ Secret Manager                   ← SECRET_KEY, DB password, Brevo key
  ├─ Service account "aivot-run"      ← Cloud Run identity + Tasks OIDC signer
  ├─ Cloud Tasks
  │    ├─ queue "emails"              ← transactional email delivery
  │    └─ queue "solver-runs"         ← CP-SAT solver jobs
  ├─ Cloud Run "aivot-backend"        ← Django + gunicorn (public)
  └─ Firebase Hosting                 ← React frontend (rewrites /api → Cloud Run)
```

The backend code degrades gracefully: when the `CLOUD_TASKS_*` env vars
are absent (local `docker-compose`), emails fall back to a background
thread and the solver runs inline — exactly as before. On Cloud Run the
queues take over, so a long solve never blocks a request and email
delivery survives instance scale-down.

## The one-button path (recommended)

Use the **Open in Cloud Shell** button in the root [`README.md`](../README.md).
It clones the repo into Cloud Shell (where `gcloud`, `terraform`,
`firebase` and `docker` are pre-installed and authenticated) and runs
[`deploy.sh`](deploy.sh).

## Manual deploy

```bash
cd infra
./deploy.sh
```

The script is interactive; it can also run unattended if you export the
variables first:

```bash
export PROJECT_ID=aivot-acme
export CREATE_PROJECT=true
export BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX
export REGION=europe-west1
export BREVO_API_KEY=...           # optional
export BREVO_SENDER_EMAIL=...      # optional
export GOOGLE_CLIENT_ID=...        # optional
./deploy.sh
```

### What it does

1. **Terraform, pass 1** — creates the project and all resources with a
   placeholder backend image and an empty `service_url` (queues inactive,
   backend runs inline). This is what lets Cloud Run start before the real
   image exists.
2. **Cloud Build** — builds `backend/` and pushes it to Artifact Registry.
3. **Terraform, pass 2** — re-applies with the real image and the Cloud
   Run URL as `service_url`, which switches the Cloud Tasks queues on.
4. **Firebase Hosting** — builds the frontend and deploys it, rewriting
   `/api/**` to the Cloud Run service (same-origin, no CORS).

## Prerequisites

- A Google account with permission to **create projects**
  (`resourcemanager.projects.create`) or an existing project to deploy to
  (`CREATE_PROJECT=false`).
- An active **billing account** (`gcloud billing accounts list`) when
  creating a new project.
- In Cloud Shell everything is already installed. Locally you need
  `gcloud`, `terraform >= 1.5`, `firebase-tools`, `node 20` and to have run
  `gcloud auth login`.

## Cost

Defaults aim at the cheapest workable setup (`db-f1-micro`, Cloud Run
scale-to-zero). Expect a few euros/month idle, mostly Cloud SQL. Tear it
all down with:

```bash
cd infra && terraform destroy   # deletion_protection is off by design
```

## Variables

See [`variables.tf`](variables.tf). The most relevant:

| Variable | Default | Purpose |
|----------|---------|---------|
| `project_id` | — | GCP project id (new or existing) |
| `create_project` | `true` | create a new project vs. reuse one |
| `billing_account` | — | required when `create_project=true` |
| `region` | `europe-west1` | Cloud Run / SQL / Tasks region |
| `db_tier` | `db-f1-micro` | Cloud SQL instance size |
| `brevo_api_key` | `""` | enables real email delivery |
| `google_client_id` | `""` | enables Google sign-in |
| `enable_firebase` | `true` | provision Firebase Hosting |

## Continuous deploy (GitOps)

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) redeploys
to an **existing** project on every push to the `production` branch. It
reuses `deploy.sh` with `CREATE_PROJECT=false` and a **remote Terraform
state on GCS**, so state is shared across CI runs.

First-time provisioning (which creates the project and the state bucket)
is done once with the Cloud Shell button; the `production` branch then
handles ongoing deploys. Required repo secrets/variables are listed at the
top of the workflow file.

## Security notes

- The Cloud Run service is public so the browser can reach `/api/`. The
  internal `/tasks/**` worker endpoints are protected at the application
  layer: every request must carry a valid **OIDC token** signed by the
  `aivot-run` service account (`backend/config/cloud_tasks.py` →
  `verify_task_request`).
- Secrets live in Secret Manager and are injected into Cloud Run as secret
  env refs — never baked into the image or the Cloud Tasks payloads.
