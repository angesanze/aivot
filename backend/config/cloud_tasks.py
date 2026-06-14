"""
Astrazione minimale su Google Cloud Tasks.

Filosofia: il codice applicativo non sa se sta girando su Cloud Run con le
code attive o in locale dentro `docker-compose`. Chiama `enqueue(...)`:

  * in produzione (variabili CLOUD_TASKS_* presenti) viene creato un task
    HTTP che Cloud Tasks consegnerà all'endpoint-worker `/tasks/...` del
    servizio, firmato con un token OIDC del service account invoker;
  * in locale `enqueue` ritorna False e il chiamante esegue il lavoro come
    ha sempre fatto (thread per le email, inline per il solve). Così lo
    sviluppo e i test non dipendono da alcun servizio Google.

Verso il worker la fiducia è zero: `verify_task_request` valida il token
OIDC (firma Google, audience = URL del servizio, email = SA invoker) prima
di eseguire qualsiasi cosa.
"""
import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

# Mappa nome-logico -> nome reale della coda su Cloud Tasks.
_QUEUES = {
    "emails": lambda: settings.CLOUD_TASKS_QUEUE_EMAILS,
    "solver": lambda: settings.CLOUD_TASKS_QUEUE_SOLVER,
}


def _queue_name(key):
    getter = _QUEUES.get(key)
    return getter() if getter else ""


def enabled(queue_key):
    """True se Cloud Tasks è configurato per questa coda. Servono progetto,
    location, URL del servizio (target + audience OIDC), SA invoker e il
    nome della coda: se manca anche solo uno, si ricade sul percorso locale."""
    return all([
        settings.CLOUD_TASKS_PROJECT,
        settings.CLOUD_TASKS_LOCATION,
        settings.CLOUD_TASKS_SERVICE_URL,
        settings.CLOUD_TASKS_INVOKER_SA,
        _queue_name(queue_key),
    ])


# Il client è pesante da costruire: una sola istanza per processo.
_client = None


def _get_client():
    global _client
    if _client is None:
        from google.cloud import tasks_v2
        _client = tasks_v2.CloudTasksClient()
    return _client


def enqueue(queue_key, path, payload):
    """Crea un task HTTP sulla coda `queue_key` verso `path` (es.
    "/tasks/email/") con corpo JSON `payload`. Ritorna True se accodato,
    False se Cloud Tasks non è configurato (il chiamante esegue in locale).

    Un errore nella creazione del task NON deve propagarsi al chiamante:
    si logga e si ritorna False, così si attiva comunque il fallback locale
    e l'operazione utente (registrazione, solve) non fallisce."""
    if not enabled(queue_key):
        return False
    try:
        from google.cloud import tasks_v2
        client = _get_client()
        parent = client.queue_path(
            settings.CLOUD_TASKS_PROJECT,
            settings.CLOUD_TASKS_LOCATION,
            _queue_name(queue_key),
        )
        url = settings.CLOUD_TASKS_SERVICE_URL.rstrip("/") + path
        client.create_task(parent=parent, task={
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": url,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps(payload).encode("utf-8"),
                "oidc_token": {
                    "service_account_email": settings.CLOUD_TASKS_INVOKER_SA,
                    # L'audience deve coincidere con quella che il worker
                    # pretende in verify_task_request: l'URL del servizio.
                    "audience": settings.CLOUD_TASKS_SERVICE_URL,
                },
            },
        })
        return True
    except Exception:
        logger.exception("creazione task Cloud Tasks fallita (%s %s): "
                         "eseguo in locale", queue_key, path)
        return False


def verify_task_request(request):
    """Valida un token OIDC di Cloud Tasks sull'header Authorization.

    Vero solo se la firma è di Google, l'audience è l'URL del servizio e
    l'email del token è il service account invoker atteso. In locale (code
    non configurate) il worker non è mai raggiunto via HTTP, ma se lo fosse
    lo si accetta solo sotto DEBUG, mai in produzione."""
    if not (settings.CLOUD_TASKS_SERVICE_URL and settings.CLOUD_TASKS_INVOKER_SA):
        return settings.DEBUG

    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth.startswith("Bearer "):
        return False
    token = auth.split(None, 1)[1]
    try:
        from google.auth.transport import requests as g_requests
        from google.oauth2 import id_token
        claims = id_token.verify_oauth2_token(
            token, g_requests.Request(),
            audience=settings.CLOUD_TASKS_SERVICE_URL)
    except Exception:
        logger.warning("token OIDC del task non valido")
        return False
    return (claims.get("email") == settings.CLOUD_TASKS_INVOKER_SA
            and claims.get("email_verified", False))
