#!/usr/bin/env bash
# =============================================================================
# AIVOT — deploy su Google Cloud in un colpo solo.
#
# Pensato per girare in Google Cloud Shell (gcloud, terraform, firebase e
# docker sono già installati e autenticati). Fa tutto:
#   1. raccoglie i parametri (progetto, billing, Brevo, …)
#   2. crea l'infrastruttura con Terraform (prima passata, immagine finta)
#   3. costruisce e pubblica l'immagine del backend con Cloud Build
#   4. seconda passata di Terraform: immagine reale + URL servizio → code attive
#   5. builda il frontend e lo pubblica su Firebase Hosting
#
# Uso interattivo:   ./deploy.sh
# Uso non interattivo (CI): valorizza le variabili PROJECT_ID, BILLING_ACCOUNT,
#   REGION, ecc. nell'ambiente e lancia ./deploy.sh
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

say()  { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✔ %s\033[0m\n" "$*"; }
ask()  { # ask VAR "Domanda" "default"
  local __var="$1" __q="$2" __def="${3:-}" __cur __ans
  __cur="$(eval "printf '%s' \"\${$__var:-}\"")"
  if [ -n "$__cur" ]; then return; fi          # già fornita via ambiente
  if [ ! -t 0 ]; then                          # CI / niente terminale
    eval "$__var=\$__def"; return
  fi
  if [ -n "$__def" ]; then
    read -r -p "$__q [$__def]: " __ans || true; __ans="${__ans:-$__def}"
  else
    read -r -p "$__q: " __ans || true
  fi
  eval "$__var=\$__ans"
}

command -v terraform >/dev/null || { echo "Manca terraform."; exit 1; }
command -v gcloud   >/dev/null || { echo "Manca gcloud.";   exit 1; }

say "Parametri del deploy"
ask PROJECT_ID      "ID progetto Google Cloud (nuovo o esistente)"
ask REGION          "Regione" "europe-west1"
ask CREATE_PROJECT  "Creare un progetto nuovo? (true/false)" "true"
if [ "$CREATE_PROJECT" = "true" ]; then
  if [ -z "${BILLING_ACCOUNT:-}" ]; then
    say "Account di fatturazione disponibili:"
    gcloud billing accounts list 2>/dev/null || true
  fi
  ask BILLING_ACCOUNT "ID account di fatturazione (XXXXXX-XXXXXX-XXXXXX)"
  ask ORG_ID          "ID organizzazione (vuoto = nessuna)" " "
fi
ask BREVO_API_KEY      "Chiave API Brevo (vuoto = email disattivate)" " "
ask BREVO_SENDER_EMAIL "Mittente email validato su Brevo (vuoto = nessuno)" " "
ask GOOGLE_CLIENT_ID   "Google OAuth Client ID (vuoto = login Google nascosto)" " "

# Normalizza i " " (placeholder per "lascia vuoto") in stringa vuota.
for v in ORG_ID BREVO_API_KEY BREVO_SENDER_EMAIL GOOGLE_CLIENT_ID; do
  eval "[ \"\${$v:-}\" = ' ' ] && $v=''" || true
done

# Autenticazione di Terraform: si usano le credenziali AMBIENTALI, che si
# auto-rinnovano. NON un access token statico (scade in 1h e fa fallire le
# operazioni lunghe, es. la creazione di Cloud SQL, con un 401 a metà).
#   - in Cloud Shell: il metadata server fornisce il token dell'utente;
#   - in CI: GOOGLE_APPLICATION_CREDENTIALS (impostata dal workflow).
# Se in Cloud Shell il provider non trovasse credenziali, basta una volta:
#   gcloud auth application-default login
unset GOOGLE_OAUTH_ACCESS_TOKEN

TF_ARGS=(
  -var "project_id=$PROJECT_ID"
  -var "region=$REGION"
  -var "create_project=${CREATE_PROJECT:-false}"
  -var "billing_account=${BILLING_ACCOUNT:-}"
  -var "org_id=${ORG_ID:-}"
  -var "brevo_api_key=${BREVO_API_KEY:-}"
  -var "brevo_sender_email=${BREVO_SENDER_EMAIL:-}"
  -var "google_client_id=${GOOGLE_CLIENT_ID:-}"
)

cd "$HERE"

# Stato Terraform: se TF_STATE_BUCKET è impostato, va su un bucket GCS
# condiviso (indispensabile per la CI/CD: lo stesso stato fra CI e Cloud
# Shell). Senza, resta in locale (uso col bottone "one-shot"). NB: la PRIMA
# migrazione da stato locale a remoto si fa una volta a mano con
# `terraform init -migrate-state` (vedi README) — qui si usa -reconfigure,
# che presuppone lo stato già nel bucket.
TF_INIT_ARGS=""
if [ -n "${TF_STATE_BUCKET:-}" ]; then
  say "Stato Terraform remoto: gs://$TF_STATE_BUCKET (prefix aivot/$PROJECT_ID)"
  printf 'terraform {\n  backend "gcs" {}\n}\n' > backend.tf
  TF_INIT_ARGS="-reconfigure -backend-config=bucket=$TF_STATE_BUCKET -backend-config=prefix=aivot/$PROJECT_ID"
fi

say "1/6 · Terraform — creo l'infrastruttura (prima passata)"
# Lo split di TF_INIT_ARGS in più flag è voluto: niente virgolette (SC2086).
# shellcheck disable=SC2086
terraform init -input=false ${TF_INIT_ARGS}
terraform apply -input=false -auto-approve "${TF_ARGS[@]}"

AR_REPO="$(terraform output -raw artifact_repo)"
BACKEND_URL="$(terraform output -raw backend_url)"
FIREBASE_SITE="$(terraform output -raw firebase_site_id || true)"
IMAGE="$AR_REPO/backend:$(date +%Y%m%d-%H%M%S)"
ok "Infra pronta. Backend (placeholder) su $BACKEND_URL"

say "2/6 · Cloud Build — costruisco l'immagine del backend"
gcloud builds submit "$ROOT/backend" --tag "$IMAGE" --project "$PROJECT_ID" --quiet

say "3/6 · Migrazioni DB — Cloud Run Job (prima che il backend vada online)"
# Porta SOLO il job alla nuova immagine ed eseguilo: lo schema è pronto
# prima che il servizio reale serva traffico. -target è di proposito qui.
terraform apply -input=false -auto-approve "${TF_ARGS[@]}" \
  -var "image=$IMAGE" -var "service_url=$BACKEND_URL" \
  -target=google_cloud_run_v2_job.migrate
gcloud run jobs execute aivot-migrate \
  --region "$REGION" --project "$PROJECT_ID" --wait
ok "Migrazioni applicate"

say "4/6 · Terraform — immagine reale + URL servizio (attiva le code)"
terraform apply -input=false -auto-approve "${TF_ARGS[@]}" \
  -var "image=$IMAGE" \
  -var "service_url=$BACKEND_URL"
ok "Backend live su $BACKEND_URL"

if [ -n "$FIREBASE_SITE" ] && command -v firebase >/dev/null; then
  say "5/6 · Frontend — build"
  ( cd "$ROOT/frontend" && npm install --no-audit --no-fund && npm run build )

  # Riscrive firebase.json con regione e servizio reali (rewrite /api → Cloud Run).
  cat > "$ROOT/frontend/firebase.json" <<JSON
{
  "hosting": {
    "site": "$FIREBASE_SITE",
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/api/**", "run": { "serviceId": "aivot-backend", "region": "$REGION" } },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
JSON

  say "6/6 · Firebase Hosting — pubblico il frontend"
  ( cd "$ROOT/frontend" && firebase deploy --only hosting --project "$PROJECT_ID" --non-interactive )
  FRONTEND_URL="https://$FIREBASE_SITE.web.app"
else
  FRONTEND_URL="(Firebase non configurato: pubblica il frontend manualmente)"
fi

say "Fatto 🎉"
echo "  Frontend : $FRONTEND_URL"
echo "  Backend  : $BACKEND_URL"
echo "  Admin    : $BACKEND_URL/admin/  (utente: admin — cambia subito la password)"
echo
echo "Le code Cloud Tasks 'emails' e 'solver-runs' sono attive: email e calcoli"
echo "girano in background. Buona pianificazione."
