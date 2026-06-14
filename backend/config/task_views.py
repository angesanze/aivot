"""
Endpoint-worker chiamati da Cloud Tasks.

Non sono API pubbliche: ricevono i task accodati altrove e li eseguono.
L'accesso è consentito solo a richieste con un token OIDC valido del
service account invoker (vedi `verify_task_request`). Una risposta non-2xx
fa ritentare il task da Cloud Tasks; quindi si risponde 200 quando il
lavoro è gestito (anche se "gestito" significa Run in ERROR) e si lascia
salire l'eccezione solo per i guasti transitori che vale la pena ritentare.
"""
import json
import logging

from django.http import HttpResponseForbidden, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .cloud_tasks import verify_task_request

logger = logging.getLogger(__name__)


def _payload(request):
    return json.loads(request.body.decode("utf-8") or "{}")


@csrf_exempt
@require_POST
def email_worker(request):
    if not verify_task_request(request):
        return HttpResponseForbidden("token del task mancante o non valido")
    from accounts.tasks import deliver_email
    # reraise=True: un errore Brevo diventa 500 e Cloud Tasks ritenta.
    deliver_email(_payload(request), reraise=True)
    return JsonResponse({"ok": True})


@csrf_exempt
@require_POST
def solve_worker(request):
    if not verify_task_request(request):
        return HttpResponseForbidden("token del task mancante o non valido")
    from scheduling.tasks import run_solve_by_id
    run_solve_by_id(_payload(request)["run_id"])
    return JsonResponse({"ok": True})
