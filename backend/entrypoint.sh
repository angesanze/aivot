#!/bin/sh
# Avvio del backend su Cloud Run.
#
# Cloud Run NON usa il `command:` di docker-compose (quello vale solo in
# locale): l'immagine deve sapersi avviare da sola. Qui prepariamo il DB e
# i file statici, poi cediamo il processo a gunicorn sulla porta che Cloud
# Run inietta in $PORT (8080 di default).
#
# Il timeout di gunicorn è alto di proposito: l'endpoint-worker
# /tasks/solve/ esegue il solver in modo sincrono e può durare fino al
# time limit della run (max 600s). Su Cloud Run la richiesta è coperta dal
# timeout del servizio (impostato a 3600s dal Terraform).
set -e

python manage.py migrate --no-input
python manage.py collectstatic --no-input
# seed è idempotente: ripopola il catalogo se manca, altrimenti non tocca nulla
python manage.py seed || true

exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --timeout "${GUNICORN_TIMEOUT:-3600}" \
  --workers "${GUNICORN_WORKERS:-2}"
