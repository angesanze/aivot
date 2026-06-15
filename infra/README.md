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

## Two ways to deploy

| Mode | How | Terraform state | When |
|------|-----|-----------------|------|
| **Manual (one-shot)** | Cloud Shell button → `bash deploy.sh` | **local** (Cloud Shell home) | quick start, personal use |
| **CI/CD (push-to-deploy)** | merge to `production` → GitHub Actions runs `deploy.sh` | **remote** (GCS bucket) | continuous deployment |

The manual button does **not** set up any pipeline — it just deploys the
current code once. To redeploy you re-run `bash deploy.sh`. The CI/CD
pipeline below is opt-in and turns every push to `production` into a deploy.

The single rule that keeps them compatible: **the Terraform state must be
shared.** The manual flow keeps it locally; CI/CD keeps it in a GCS bucket.
Mixing the two on one project only works if both point at the same state —
hence the migration step below.

## Continuous deployment (push-to-deploy) — full runbook

`.github/workflows/deploy.yml` runs `deploy.sh` on every push to the
`production` branch, with `CREATE_PROJECT=false` and Terraform state in a
GCS bucket. Set it up **once**. All commands are idempotent and repeatable.

Pick your values first (used throughout):

```bash
PROJECT=aviot-calculator          # your existing project id
REGION=europe-west1
BUCKET=$PROJECT-tfstate           # any globally-unique bucket name
```

### 1. Create the Terraform state bucket

```bash
gcloud storage buckets create gs://$BUCKET --project $PROJECT --location $REGION
gcloud storage buckets update gs://$BUCKET --versioning   # keep state history
```

### 2. Create the deploy service account + key

```bash
gcloud iam service-accounts create aivot-deployer \
  --project $PROJECT --display-name "AIVOT GitHub deployer"

DEPLOYER=aivot-deployer@$PROJECT.iam.gserviceaccount.com

# Simple on a personal project. For least privilege, grant the narrower set
# instead (run.admin, cloudsql.admin, secretmanager.admin, cloudtasks.admin,
# artifactregistry.admin, cloudbuild.builds.editor, firebasehosting.admin,
# storage.admin, iam.serviceAccountAdmin, iam.serviceAccountUser,
# resourcemanager.projectIamAdmin, serviceusage.serviceUsageAdmin).
gcloud projects add-iam-policy-binding $PROJECT \
  --member "serviceAccount:$DEPLOYER" --role roles/owner

gcloud iam service-accounts keys create key.json --iam-account $DEPLOYER
```

### 3a. Already deployed with the button? Migrate the local state → bucket

Do this **in the same `infra/` folder where you ran `deploy.sh`** (the one
that holds your local `terraform.tfstate`):

```bash
git pull   # make sure you have the latest infra

printf 'terraform {\n  backend "gcs" {}\n}\n' > backend.tf

terraform init -migrate-state \
  -backend-config="bucket=$BUCKET" \
  -backend-config="prefix=aivot/$PROJECT"
# answer "yes" to copy the existing state into the bucket
```

Then **stop Terraform from managing the project itself**, so the CI (which
runs with `create_project=false`) won't try to destroy it. The project
stays on GCP, just unmanaged:

```bash
terraform state rm 'google_project.this[0]'
```

> Why: `create_project` toggles a counted resource. The button used
> `true` (project in state); CI uses `false` (no such resource). Without
> this `state rm`, the first CI run would plan to **delete your project**.
> Removing it from state makes both sides agree. Run `terraform plan` after
> — it should show **no destroy of the project**.

### 3b. Starting fresh (no button deploy yet)?

Skip 3a. Pre-create the project (`gcloud projects create $PROJECT ...`,
link billing), then the first `production` push provisions everything
directly into the bucket. Nothing to migrate.

### 4. Configure GitHub secrets & variables

With the [`gh`](https://cli.github.com) CLI (or the repo UI under
*Settings → Secrets and variables → Actions*):

```bash
gh secret   set GCP_CREDENTIALS  < key.json
gh variable set GCP_PROJECT_ID   --body "$PROJECT"
gh variable set GCP_REGION       --body "$REGION"
gh variable set TF_STATE_BUCKET  --body "$BUCKET"
# optional
gh secret   set BREVO_API_KEY      --body "<brevo-key>"
gh variable set BREVO_SENDER_EMAIL --body "<sender@domain>"
gh variable set GOOGLE_CLIENT_ID   --body "<oauth-client-id>"

rm key.json   # don't leave the key on disk
```

### 5. Turn it on

`production` must contain the workflow, so point it at `main` and push:

```bash
git push origin main:production
```

That first push triggers a deploy. From now on, **every merge into
`production` redeploys automatically**. Typical flow: open a PR → CI checks
go green → merge to `main` → when ready to ship, fast-forward `production`:

```bash
git push origin main:production
```

### What the pipeline runs

The same `deploy.sh` you'd run by hand, non-interactively: builds the
backend image, runs the migration job, deploys Cloud Run, then builds and
publishes the frontend to Firebase Hosting — all against the shared GCS
state.

## Security notes

- The Cloud Run service is public so the browser can reach `/api/`. The
  internal `/tasks/**` worker endpoints are protected at the application
  layer: every request must carry a valid **OIDC token** signed by the
  `aivot-run` service account (`backend/config/cloud_tasks.py` →
  `verify_task_request`).
- Secrets live in Secret Manager and are injected into Cloud Run as secret
  env refs — never baked into the image or the Cloud Tasks payloads.

## Database migrations

Migrations do **not** run in the serving container — that would let several
cold-starting instances race to migrate at once. Instead a dedicated
**Cloud Run Job** (`aivot-migrate`, in `main.tf`) runs `migrate` then `seed`,
and `deploy.sh` executes it **before** the new backend revision goes live
(migrate-then-deploy). Static files are collected once at image build
(`Dockerfile`), so the serving container only runs gunicorn.

To migrate manually (e.g. outside a full deploy):

```bash
gcloud run jobs execute aivot-migrate --region <REGION> --project <PROJECT>
```

## Further hardening

At larger scale, also consider:

- **`min_instances >= 1`** to avoid cold starts on the API.
- A larger **`db_tier`** and `availability_type = "REGIONAL"` for HA.
