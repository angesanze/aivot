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
#   6. (opzionale) prepara la pipeline CI/CD push-to-deploy su GitHub Actions
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
ask CUSTOM_DOMAIN      "Dominio personalizzato (es. aivot.rocks; vuoto = nessuno)" " "

# Pipeline CI/CD (push-to-deploy): opzionale. Se sì, lo stato Terraform va
# SUBITO su un bucket remoto (così non serve nessuna migrazione dopo) e a
# fine deploy lo script prepara il service account e stampa le istruzioni
# per accendere GitHub Actions.
ask SETUP_PIPELINE "Configurare anche la pipeline CI/CD push-to-deploy? (true/false)" "false"
if [ "$SETUP_PIPELINE" = "true" ] && [ -z "${TF_STATE_BUCKET:-}" ]; then
  ask TF_STATE_BUCKET "Nome del bucket GCS per lo stato Terraform" "$PROJECT_ID-tfstate"
fi

# Normalizza i " " (placeholder per "lascia vuoto") in stringa vuota.
for v in ORG_ID BREVO_API_KEY BREVO_SENDER_EMAIL GOOGLE_CLIENT_ID CUSTOM_DOMAIN; do
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

# Modalità pipeline: il progetto NON viene gestito da Terraform (la CI gira
# con create_project=false). Se va creato, lo facciamo QUI con gcloud — prima
# di tutto — così esiste già quando creiamo il bucket di stato al suo interno
# e quando Terraform ci lavora dentro. Niente uovo-e-gallina, niente state rm.
if [ "${SETUP_PIPELINE:-false}" = "true" ] && [ "${CREATE_PROJECT:-true}" = "true" ]; then
  if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
    say "Creo il progetto $PROJECT_ID (per la pipeline)"
    # shellcheck disable=SC2086
    gcloud projects create "$PROJECT_ID" ${ORG_ID:+--organization=$ORG_ID}
    gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
    # Servono subito: lo storage per il bucket di stato; il resto lo abilita
    # Terraform.
    gcloud services enable storage.googleapis.com cloudresourcemanager.googleapis.com \
      --project "$PROJECT_ID"
  fi
  CREATE_PROJECT="false"
fi

TF_ARGS=(
  -var "project_id=$PROJECT_ID"
  -var "region=$REGION"
  -var "create_project=${CREATE_PROJECT:-false}"
  -var "billing_account=${BILLING_ACCOUNT:-}"
  -var "org_id=${ORG_ID:-}"
  -var "brevo_api_key=${BREVO_API_KEY:-}"
  -var "brevo_sender_email=${BREVO_SENDER_EMAIL:-}"
  -var "google_client_id=${GOOGLE_CLIENT_ID:-}"
  -var "custom_domain=${CUSTOM_DOMAIN:-}"
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
  # Crea il bucket se non esiste (idempotente): così non serve prepararlo a mano.
  if ! gcloud storage buckets describe "gs://$TF_STATE_BUCKET" >/dev/null 2>&1; then
    gcloud storage buckets create "gs://$TF_STATE_BUCKET" \
      --project "$PROJECT_ID" --location "$REGION"
  fi
  # Versioning best-effort (storia dello stato): se GCS fa i capricci, non bloccare.
  gcloud storage buckets update "gs://$TF_STATE_BUCKET" --versioning 2>/dev/null || true
  printf 'terraform {\n  backend "gcs" {}\n}\n' > backend.tf
  TF_INIT_ARGS="-reconfigure -backend-config=bucket=$TF_STATE_BUCKET -backend-config=prefix=aivot/$PROJECT_ID"
fi

say "1/6 · Terraform — creo l'infrastruttura (prima passata)"
# Lo split di TF_INIT_ARGS in più flag è voluto: niente virgolette (SC2086).
# shellcheck disable=SC2086
terraform init -input=false ${TF_INIT_ARGS}

# Su un REDEPLOY il servizio esiste già: mantieni immagine e URL attuali nella
# prima passata, altrimenti Terraform riporterebbe il servizio all'immagine
# placeholder (downtime a ogni deploy, e rotto se il deploy fallisce a metà).
# Al primo deploy il servizio non esiste → resta il default (placeholder),
# corretto perché l'immagine reale non è ancora stata costruita.
PLACEHOLDER="us-docker.pkg.dev/cloudrun/container/hello"
CUR_IMAGE="$(gcloud run services describe aivot-backend --region "$REGION" \
  --project "$PROJECT_ID" \
  --format='value(spec.template.spec.containers[0].image)' 2>/dev/null || true)"
CUR_URL="$(gcloud run services describe aivot-backend --region "$REGION" \
  --project "$PROJECT_ID" --format='value(status.url)' 2>/dev/null || true)"
PASS1_ARGS=()
if [ -n "$CUR_IMAGE" ] && [ "$CUR_IMAGE" != "$PLACEHOLDER" ]; then
  PASS1_ARGS+=(-var "image=$CUR_IMAGE")
fi
if [ -n "$CUR_URL" ]; then
  PASS1_ARGS+=(-var "service_url=$CUR_URL")
fi

terraform apply -input=false -auto-approve "${TF_ARGS[@]}" "${PASS1_ARGS[@]}"

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

  # Riscrive firebase.json con regione e servizio reali. /api, /admin e gli
  # statici dell'admin (/static) vanno a Cloud Run (Django); tutto il resto
  # alla SPA. Così <dominio>/admin apre il backoffice Django.
  cat > "$ROOT/frontend/firebase.json" <<JSON
{
  "hosting": {
    "site": "$FIREBASE_SITE",
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/api/**", "run": { "serviceId": "aivot-backend", "region": "$REGION" } },
      { "source": "/admin/**", "run": { "serviceId": "aivot-backend", "region": "$REGION" } },
      { "source": "/static/**", "run": { "serviceId": "aivot-backend", "region": "$REGION" } },
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

# --- Pipeline CI/CD: prepara l'accesso per GitHub Actions --------------------
if [ "${SETUP_PIPELINE:-false}" = "true" ]; then
  say "Pipeline CI/CD — preparo l'accesso per GitHub Actions"

  DEPLOYER="aivot-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
  if ! gcloud iam service-accounts describe "$DEPLOYER" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam service-accounts create aivot-deployer --project "$PROJECT_ID" \
      --display-name "AIVOT GitHub deployer"
  fi
  # Un SA appena creato può non essere ancora visibile a IAM: ritenta finché
  # la propagazione non è completa (di solito pochi secondi).
  for _ in 1 2 3 4 5 6; do
    if gcloud projects add-iam-policy-binding "$PROJECT_ID" \
         --member "serviceAccount:$DEPLOYER" --role roles/owner \
         --condition=None >/dev/null 2>&1; then
      break
    fi
    sleep 5
  done
  KEY_FILE="$HERE/aivot-deployer-key.json"
  gcloud iam service-accounts keys create "$KEY_FILE" --iam-account "$DEPLOYER"

  # Repo GitHub dedotto dal remote della clone (così funziona su un fork
  # qualunque, non solo sull'originale).
  REPO="$(git -C "$ROOT" remote get-url origin 2>/dev/null \
    | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')"

  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1 && [ -n "$REPO" ]; then
    # gh disponibile e autenticato: imposto io segreti e variabili.
    say "Configuro segreti e variabili su GitHub ($REPO)"
    gh secret   set GCP_CREDENTIALS --repo "$REPO" < "$KEY_FILE"
    gh variable set GCP_PROJECT_ID  --repo "$REPO" --body "$PROJECT_ID"
    gh variable set GCP_REGION      --repo "$REPO" --body "$REGION"
    gh variable set TF_STATE_BUCKET --repo "$REPO" --body "$TF_STATE_BUCKET"
    if [ -n "${BREVO_API_KEY:-}" ]; then
      printf '%s' "$BREVO_API_KEY" | gh secret set BREVO_API_KEY --repo "$REPO"
    fi
    if [ -n "${BREVO_SENDER_EMAIL:-}" ]; then
      gh variable set BREVO_SENDER_EMAIL --repo "$REPO" --body "$BREVO_SENDER_EMAIL"
    fi
    if [ -n "${GOOGLE_CLIENT_ID:-}" ]; then
      gh variable set GOOGLE_CLIENT_ID --repo "$REPO" --body "$GOOGLE_CLIENT_ID"
    fi
    rm -f "$KEY_FILE"
    ok "Segreti GitHub impostati su $REPO"
    cat <<EOF

================  PIPELINE CONFIGURATA 🎉  ================
Tutto pronto. Per deployare in automatico, d'ora in poi:

    git push origin main:production

Ogni push sul branch 'production' farà partire il deploy su GitHub Actions.
==========================================================
EOF
  else
    # gh assente o non autenticato: stampo le istruzioni (con il repo giusto).
    REPO_FLAG=""
    [ -n "$REPO" ] && REPO_FLAG=" --repo $REPO"
    cat <<EOF

================  ATTIVA LA PIPELINE (3 passi)  ================
'gh' non risulta autenticato: esegui 'gh auth login', poi questi comandi.

1) Segreti/variabili su GitHub:
   gh secret   set GCP_CREDENTIALS$REPO_FLAG < "$KEY_FILE"
   gh variable set GCP_PROJECT_ID$REPO_FLAG  --body "$PROJECT_ID"
   gh variable set GCP_REGION$REPO_FLAG      --body "$REGION"
   gh variable set TF_STATE_BUCKET$REPO_FLAG --body "$TF_STATE_BUCKET"
   (in alternativa via UI: Settings -> Secrets and variables -> Actions)

2) Cancella la chiave dal disco:
   rm "$KEY_FILE"

3) Accendi la pipeline (ogni push su 'production' deploya):
   git push origin main:production
===============================================================
EOF
  fi
fi
