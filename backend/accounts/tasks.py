"""
Esecutori delle email transazionali.

`deliver_email` è il punto in cui si parla davvero con Brevo. Viene chiamato
in due modi, con lo stesso payload:

  * dal worker `/tasks/email/` quando le code Cloud Tasks sono attive
    (produzione su Cloud Run);
  * da un thread fire-and-forget quando non lo sono (locale/test).

Il payload contiene SOLO i campi del messaggio, mai la chiave API: il
segreto si legge qui da SiteConfig, così non transita per la coda.
"""
import logging

import requests

logger = logging.getLogger(__name__)

BREVO_API = "https://api.brevo.com/v3/smtp/email"


def deliver_email(payload, cfg=None, reraise=False):
    """Invia una email via Brevo. `payload` = {to_email, to_name, subject,
    html}. `cfg` può essere passata già letta (caso thread locale, dove la
    connessione DB della request è ancora viva); altrimenti la si rilegge
    qui (caso worker, che è una request a sé).

    `reraise=True` (worker) propaga gli errori così Cloud Tasks ritenta;
    in locale resta False e l'errore finisce solo nei log, come oggi."""
    if cfg is None:
        from .models import SiteConfig
        cfg = SiteConfig.effective()
    if not cfg["brevo_api_key"]:
        logger.warning("chiave Brevo assente: salto '%s' a %s",
                       payload.get("subject"), payload.get("to_email"))
        return
    to_email = payload["to_email"]
    try:
        r = requests.post(
            BREVO_API,
            timeout=10,
            headers={"api-key": cfg["brevo_api_key"],
                     "content-type": "application/json"},
            json={
                "sender": {"name": cfg["brevo_sender_name"],
                           "email": cfg["brevo_sender_email"]},
                "to": [{"email": to_email,
                        "name": payload.get("to_name") or to_email}],
                "subject": payload["subject"],
                "htmlContent": payload["html"],
            },
        )
        if r.status_code >= 300:
            logger.error("Brevo %s: %s", r.status_code, r.text[:300])
            r.raise_for_status()
    except requests.RequestException:
        logger.exception("invio email fallito a %s", to_email)
        if reraise:
            raise
