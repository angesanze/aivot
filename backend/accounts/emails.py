"""
Email transazionali via Brevo (https://developers.brevo.com).

Chiave, mittente e interruttori arrivano da SiteConfig (modificabile dal
backoffice /admin/), con le variabili d'ambiente come fallback. L'invio è
asincrono (thread) e non blocca mai la richiesta: se Brevo è
irraggiungibile o la chiave manca, la registrazione va comunque a buon
fine e l'errore finisce nei log.
"""
import logging
import threading

import requests

from config.translations import tr

logger = logging.getLogger(__name__)

BREVO_API = "https://api.brevo.com/v3/smtp/email"

_STYLE = (
    "font-family:Inter,Arial,sans-serif;color:#111827;line-height:1.6;"
    "max-width:520px;margin:0 auto;padding:24px"
)
_BADGE = (
    "display:inline-block;background:linear-gradient(135deg,#34d399,#0d9488);"
    "color:#fff;font-weight:800;font-size:20px;border-radius:12px;"
    "padding:10px 16px"
)
_BTN = (
    "display:inline-block;background:linear-gradient(90deg,#059669,#14b8a6);"
    "color:#fff;text-decoration:none;font-weight:600;border-radius:10px;"
    "padding:12px 22px"
)


def _config():
    from .models import SiteConfig
    return SiteConfig.effective()


def send_raw(to_email, to_name, subject, html, cfg=None):
    """Invio asincrono: la config si legge ORA (thread principale, con la
    connessione DB della richiesta), il thread fa solo la chiamata HTTP."""
    cfg = cfg or _config()
    if not cfg["brevo_api_key"]:
        logger.warning("chiave Brevo assente: salto '%s' a %s",
                       subject, to_email)
        return

    def _task():
        try:
            r = requests.post(
                BREVO_API,
                timeout=10,
                headers={"api-key": cfg["brevo_api_key"],
                         "content-type": "application/json"},
                json={
                    "sender": {"name": cfg["brevo_sender_name"],
                               "email": cfg["brevo_sender_email"]},
                    "to": [{"email": to_email, "name": to_name or to_email}],
                    "subject": subject,
                    "htmlContent": html,
                },
            )
            if r.status_code >= 300:
                logger.error("Brevo %s: %s", r.status_code, r.text[:300])
        except requests.RequestException:
            logger.exception("invio email fallito a %s", to_email)

    threading.Thread(target=_task, daemon=True).start()


def send_welcome(user):
    """Benvenuto + promemoria delle credenziali di accesso (lo username:
    la password non si spedisce mai in chiaro, si recupera col reset)."""
    cfg = _config()
    if not cfg["send_welcome_email"]:
        return
    name = user.first_name or user.username
    html = f"""
    <div style="{_STYLE}">
      <p><span style="{_BADGE}">A</span></p>
      <h2 style="margin:18px 0 6px">{tr("Benvenuto su AIVOT, {name}!", name=name)}</h2>
      <p>{tr("Il tuo account è pronto. Da oggi hai un'area personale dove "
             "progetti, regole e pianificazioni restano tuoi: il motore fa "
             "i conti, tu decidi i vincoli.")}</p>
      <p style="background:#f4f5f7;border-radius:10px;padding:12px 16px">
        {tr("Il tuo nome utente è")} <b>{user.username}</b><br/>
        {tr('La password è quella che hai scelto alla registrazione: se la '
            'dimentichi, usa "Password dimenticata?" nella pagina di '
            'accesso.')}
      </p>
      <p><a style="{_BTN}" href="{cfg['frontend_url']}">{tr("Entra in AIVOT")}</a></p>
      <p style="color:#6b7280;font-size:13px">{tr("Ogni vincolo, una soluzione.")}</p>
    </div>"""
    send_raw(user.email, name, tr("Benvenuto su AIVOT 🎉"), html, cfg=cfg)


def send_password_reset(user, reset_url):
    cfg = _config()
    name = user.first_name or user.username
    body = tr("Ciao {name}, abbiamo ricevuto una richiesta di reset per il "
              "tuo account {username}. Se non sei stato tu, ignora questa "
              "email: la tua password resta quella attuale.",
              name=name, username=f"<b>{user.username}</b>")
    html = f"""
    <div style="{_STYLE}">
      <p><span style="{_BADGE}">A</span></p>
      <h2 style="margin:18px 0 6px">{tr("Reimposta la tua password")}</h2>
      <p>{body}</p>
      <p><a style="{_BTN}" href="{reset_url}">{tr("Scegli una nuova password")}</a></p>
      <p style="color:#6b7280;font-size:13px">{tr("Il link vale per un solo "
                                                  "utilizzo e scade "
                                                  "automaticamente.")}</p>
    </div>"""
    send_raw(user.email, name, tr("AIVOT — reimposta la password"), html,
             cfg=cfg)
