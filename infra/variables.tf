# --- Identità del progetto -------------------------------------------------

variable "project_id" {
  type        = string
  description = "ID del progetto Google Cloud (minuscole, numeri, trattini; globale e univoco). Es. 'aivot-acme'."
}

variable "create_project" {
  type        = bool
  default     = true
  description = "true: crea un progetto nuovo e lo collega al billing. false: usa un progetto già esistente."
}

variable "billing_account" {
  type        = string
  default     = ""
  description = "ID dell'account di fatturazione (es. 'XXXXXX-XXXXXX-XXXXXX'). Obbligatorio se create_project=true."
}

variable "org_id" {
  type        = string
  default     = ""
  description = "ID dell'organizzazione a cui agganciare il nuovo progetto (vuoto = nessuna organizzazione)."
}

variable "region" {
  type        = string
  default     = "europe-west1"
  description = "Regione per Cloud Run, Cloud SQL e le code Cloud Tasks."
}

# --- Backend (Cloud Run) ---------------------------------------------------

variable "image" {
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
  description = "Immagine container del backend. Al primo apply resta il placeholder pubblico (così Cloud Run parte e crea l'Artifact Registry); deploy.sh costruisce l'immagine reale e rilancia l'apply passandola qui."
}

variable "service_url" {
  type        = string
  default     = ""
  description = "URL pubblico del servizio Cloud Run. Vuoto al primo apply (le code restano inattive, il backend gira inline); valorizzato al secondo apply da deploy.sh per attivare Cloud Tasks."
}

variable "db_tier" {
  type        = string
  default     = "db-f1-micro"
  description = "Taglia dell'istanza Cloud SQL. db-f1-micro per demo/sviluppo."
}

variable "min_instances" {
  type        = number
  default     = 0
  description = "Istanze minime di Cloud Run (0 = scala a zero, possibili cold start)."
}

variable "max_instances" {
  type        = number
  default     = 4
  description = "Istanze massime di Cloud Run."
}

# --- Integrazioni applicative ---------------------------------------------

variable "brevo_api_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Chiave API Brevo per le email transazionali (vuoto = email disattivate, annotate nei log)."
}

variable "brevo_sender_email" {
  type        = string
  default     = ""
  description = "Mittente validato su Brevo (SPF/DKIM)."
}

variable "brevo_sender_name" {
  type        = string
  default     = "AIVOT"
  description = "Nome mostrato come mittente delle email."
}

variable "google_client_id" {
  type        = string
  default     = ""
  description = "OAuth Client ID per l'accesso con Google (vuoto = bottone Google nascosto)."
}

variable "admin_email" {
  type        = string
  default     = "admin@aivot.local"
  description = "Email del superadmin creato al primo avvio."
}

variable "enable_firebase" {
  type        = bool
  default     = true
  description = "true: predispone Firebase Hosting per il frontend. false: salta Firebase (lo deployi a mano)."
}
