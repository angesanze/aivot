# =============================================================================
# AIVOT — infrastruttura Google Cloud
#
# Crea (o riusa) un progetto e ci mette dentro tutto lo stack:
#   progetto + billing + API  →  Cloud SQL  →  Secret Manager  →
#   service account  →  Cloud Tasks (emails, solver-runs)  →  Cloud Run  →
#   Firebase Hosting (predisposizione).
#
# Il deploy avviene in due passate (vedi deploy.sh): la prima crea tutto con
# l'immagine placeholder e service_url vuoto; la seconda passa l'immagine
# reale e l'URL del servizio, attivando le code.
# =============================================================================

locals {
  project_id = var.create_project ? google_project.this[0].project_id : var.project_id

  # Identità di runtime del backend: gira il servizio, accoda i task ed è
  # anche il service account che firma i token OIDC verso i worker.
  runtime_sa = "aivot-run@${local.project_id}.iam.gserviceaccount.com"

  # URL del frontend su Firebase Hosting (sito di default = project_id).
  frontend_url = var.enable_firebase ? "https://${local.project_id}.web.app" : ""
}

# --- Progetto e fatturazione ------------------------------------------------

resource "google_project" "this" {
  count           = var.create_project ? 1 : 0
  name            = var.project_id
  project_id      = var.project_id
  billing_account = var.billing_account
  org_id          = var.org_id != "" ? var.org_id : null

  # Evita errori se l'org impone vincoli sul default network, ecc.
  auto_create_network = true
}

# --- API necessarie ---------------------------------------------------------

resource "google_project_service" "apis" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "cloudtasks.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
  ])
  project            = local.project_id
  service            = each.value
  disable_on_destroy = false

  # Senza questo, le API si proverebbero ad abilitare prima che il progetto
  # esista davvero.
  depends_on = [google_project.this]
}

# --- Registro immagini ------------------------------------------------------

resource "google_artifact_registry_repository" "containers" {
  project       = local.project_id
  location      = var.region
  repository_id = "aivot"
  format        = "DOCKER"
  description   = "Immagini container di AIVOT"
  depends_on    = [google_project_service.apis]
}

# --- Cloud SQL (Postgres) ---------------------------------------------------

resource "google_sql_database_instance" "pg" {
  project          = local.project_id
  name             = "aivot-db"
  region           = var.region
  database_version = "POSTGRES_16"

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"
    disk_autoresize   = true

    ip_configuration {
      # Nessun IP autorizzato: l'unica via d'accesso è il Cloud SQL Auth
      # Proxy montato in Cloud Run, autenticato via IAM.
      ipv4_enabled = true
    }
    backup_configuration {
      enabled = true
    }
  }

  # Demo/sviluppo: niente protezione, così `terraform destroy` ripulisce.
  deletion_protection = false
  depends_on          = [google_project_service.apis]
}

resource "google_sql_database" "app" {
  project  = local.project_id
  name     = "solverstore"
  instance = google_sql_database_instance.pg.name
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "google_sql_user" "app" {
  project  = local.project_id
  name     = "solverstore"
  instance = google_sql_database_instance.pg.name
  password = random_password.db.result
}

# --- Segreti ----------------------------------------------------------------

resource "random_password" "secret_key" {
  length  = 50
  special = true
}

# Mappa nome-segreto -> valore. Il segreto Brevo si crea solo se c'è una
# chiave, così non si referenzia una versione inesistente in Cloud Run.
locals {
  secrets = merge(
    {
      "aivot-secret-key"  = random_password.secret_key.result
      "aivot-db-password" = random_password.db.result
    },
    var.brevo_api_key != "" ? { "aivot-brevo-key" = var.brevo_api_key } : {}
  )
}

resource "google_secret_manager_secret" "s" {
  for_each  = local.secrets
  project   = local.project_id
  secret_id = each.key
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "v" {
  for_each    = local.secrets
  secret      = google_secret_manager_secret.s[each.key].id
  secret_data = each.value
}

# Il service account di runtime può leggere i segreti.
resource "google_secret_manager_secret_iam_member" "access" {
  for_each  = google_secret_manager_secret.s
  project   = local.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

# --- Service account di runtime --------------------------------------------

resource "google_service_account" "runtime" {
  project      = local.project_id
  account_id   = "aivot-run"
  display_name = "AIVOT Cloud Run runtime"
  depends_on   = [google_project_service.apis]
}

# Connessione a Cloud SQL via Auth Proxy.
resource "google_project_iam_member" "sql_client" {
  project = local.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

# Può accodare task su Cloud Tasks.
resource "google_project_iam_member" "tasks_enqueuer" {
  project = local.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

# Per accodare un task con token OIDC firmato come SE STESSO, l'identità che
# crea il task deve poter "impersonare" quel service account: actAs su di sé.
resource "google_service_account_iam_member" "act_as_self" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.runtime.email}"
}

# --- Cloud Tasks ------------------------------------------------------------

resource "google_cloud_tasks_queue" "emails" {
  project  = local.project_id
  name     = "emails"
  location = var.region
  rate_limits {
    max_dispatches_per_second = 10
    max_concurrent_dispatches = 20
  }
  retry_config {
    max_attempts = 5
  }
  depends_on = [google_project_service.apis]
}

resource "google_cloud_tasks_queue" "solver" {
  project  = local.project_id
  name     = "solver-runs"
  location = var.region
  rate_limits {
    # Le run sono CPU-bound: tieni la concorrenza in linea con i worker
    # gunicorn (2 di default), così non si accodano dietro al timeout.
    max_dispatches_per_second = 1
    max_concurrent_dispatches = 2
  }
  retry_config {
    # Una run fallita per errore logico è già salvata come ERROR: pochi
    # ritenti, solo per i guasti transitori.
    max_attempts = 2
  }
  depends_on = [google_project_service.apis]
}

# --- Cloud Run (backend) ----------------------------------------------------

resource "google_cloud_run_v2_service" "backend" {
  project  = local.project_id
  name     = "aivot-backend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.runtime.email
    timeout         = "3600s"

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.pg.connection_name]
      }
    }

    containers {
      image = var.image

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      # --- Configurazione applicativa (valori non segreti) ---
      env {
        name  = "DEBUG"
        value = "0"
      }
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = local.project_id
      }
      env {
        name  = "POSTGRES_HOST"
        value = "/cloudsql/${google_sql_database_instance.pg.connection_name}"
      }
      env {
        name  = "POSTGRES_DB"
        value = google_sql_database.app.name
      }
      env {
        name  = "POSTGRES_USER"
        value = google_sql_user.app.name
      }
      env {
        name  = "SERVICE_URL"
        value = var.service_url
      }
      env {
        name  = "CLOUD_TASKS_LOCATION"
        value = var.region
      }
      env {
        name  = "CLOUD_TASKS_INVOKER_SA"
        value = google_service_account.runtime.email
      }
      env {
        name  = "CLOUD_TASKS_QUEUE_EMAILS"
        value = google_cloud_tasks_queue.emails.name
      }
      env {
        name  = "CLOUD_TASKS_QUEUE_SOLVER"
        value = google_cloud_tasks_queue.solver.name
      }
      env {
        name  = "FRONTEND_URL"
        value = local.frontend_url
      }
      env {
        name  = "CORS_ALLOWED_ORIGINS"
        value = local.frontend_url
      }
      env {
        name  = "BREVO_SENDER_EMAIL"
        value = var.brevo_sender_email
      }
      env {
        name  = "BREVO_SENDER_NAME"
        value = var.brevo_sender_name
      }
      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }
      env {
        name  = "ADMIN_EMAIL"
        value = var.admin_email
      }

      # --- Segreti (da Secret Manager) ---
      env {
        name = "SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.s["aivot-secret-key"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "POSTGRES_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.s["aivot-db-password"].secret_id
            version = "latest"
          }
        }
      }
      dynamic "env" {
        for_each = var.brevo_api_key != "" ? [1] : []
        content {
          name = "BREVO_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.s["aivot-brevo-key"].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_secret_manager_secret_version.v,
    google_secret_manager_secret_iam_member.access,
    google_sql_database.app,
    google_project_iam_member.sql_client,
  ]
}

# Servizio pubblico: il browser deve raggiungere /api/. Gli endpoint /tasks/
# sono comunque protetti a livello applicativo dal token OIDC di Cloud Tasks.
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = local.project_id
  location = var.region
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --- Firebase Hosting (predisposizione) ------------------------------------
# Il contenuto del frontend lo carica deploy.sh con la Firebase CLI; qui si
# abilita Firebase sul progetto e si crea il sito di hosting.

resource "google_firebase_project" "this" {
  count    = var.enable_firebase ? 1 : 0
  provider = google-beta
  project  = local.project_id

  depends_on = [google_project_service.apis]
}

resource "google_firebase_hosting_site" "frontend" {
  count    = var.enable_firebase ? 1 : 0
  provider = google-beta
  project  = local.project_id
  site_id  = local.project_id

  depends_on = [google_firebase_project.this]
}
