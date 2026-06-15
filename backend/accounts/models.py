"""
Configurazione della piattaforma modificabile da backoffice.

Riga singola (pk=1): i campi compilati qui hanno la precedenza, quelli
lasciati vuoti ricadono sulle variabili d'ambiente. Così l'admin gestisce
mittenti, chiavi e integrazioni senza toccare i container.
"""
from django.conf import settings
from django.db import models


class SiteConfig(models.Model):
    brevo_api_key = models.CharField(
        "Chiave API Brevo", max_length=200, blank=True,
        help_text="Vuoto = usa la variabile d'ambiente BREVO_API_KEY.")
    brevo_sender_email = models.EmailField(
        "Email mittente", blank=True,
        help_text="Deve essere un mittente validato su Brevo (o dominio "
                  "autenticato). Vuoto = variabile d'ambiente.")
    brevo_sender_name = models.CharField(
        "Nome mittente", max_length=80, blank=True,
        help_text="Il nome che appare nelle email, es. AIVOT.")
    send_welcome_email = models.BooleanField(
        "Invia email di benvenuto", default=True,
        help_text="Email di benvenuto alla registrazione (anche via Google).")
    google_client_id = models.CharField(
        "Google Client ID", max_length=200, blank=True,
        help_text="OAuth Client ID per il Google Sign-In; se vuoto qui e "
                  "nell'ambiente, il bottone Google non compare.")
    frontend_url = models.URLField(
        "URL pubblico del frontend", blank=True,
        help_text="Usato nei link delle email (es. reset password). "
                  "Vuoto = variabile d'ambiente.")
    kofi_handle = models.CharField(
        "Handle Ko-fi", max_length=80, blank=True,
        help_text="Nome utente Ko-fi (es. 'angelosanzeri' per "
                  "ko-fi.com/angelosanzeri). Compilato = mostra il bottone "
                  "di supporto nel frontend; vuoto = nessun bottone.")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configurazione piattaforma"
        verbose_name_plural = "Configurazione piattaforma"

    def __str__(self):
        return "Configurazione piattaforma"

    def save(self, *args, **kwargs):
        self.pk = 1  # singleton: esiste una sola riga
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @classmethod
    def effective(cls):
        """Valori effettivi: prima il DB, poi l'ambiente."""
        cfg = cls.load()
        return {
            "brevo_api_key": cfg.brevo_api_key or settings.BREVO_API_KEY,
            "brevo_sender_email": (cfg.brevo_sender_email
                                   or settings.BREVO_SENDER_EMAIL),
            "brevo_sender_name": (cfg.brevo_sender_name
                                  or settings.BREVO_SENDER_NAME),
            "send_welcome_email": cfg.send_welcome_email,
            "google_client_id": (cfg.google_client_id
                                 or settings.GOOGLE_CLIENT_ID),
            "frontend_url": cfg.frontend_url or settings.FRONTEND_URL,
            "kofi_handle": cfg.kofi_handle.strip(),
        }
