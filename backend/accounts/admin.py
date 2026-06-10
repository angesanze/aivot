from django import forms
from django.contrib import admin

from .emails import send_raw
from .models import SiteConfig


class SiteConfigForm(forms.ModelForm):
    class Meta:
        model = SiteConfig
        fields = "__all__"
        widgets = {
            # Mascherata a video ma reinviata al salvataggio
            "brevo_api_key": forms.PasswordInput(render_value=True),
        }


@admin.register(SiteConfig)
class SiteConfigAdmin(admin.ModelAdmin):
    form = SiteConfigForm
    list_display = ("__str__", "brevo_sender_email", "send_welcome_email",
                    "updated_at")
    actions = ["send_test_email"]

    fieldsets = (
        ("Email transazionali (Brevo)", {
            "fields": ("brevo_api_key", "brevo_sender_email",
                       "brevo_sender_name", "send_welcome_email"),
            "description": "I campi vuoti usano le variabili d'ambiente del "
                           "container. Il mittente deve essere validato su "
                           "Brevo, altrimenti Brevo accetta la richiesta ma "
                           "scarta la consegna.",
        }),
        ("Accesso con Google", {"fields": ("google_client_id",)}),
        ("Piattaforma", {"fields": ("frontend_url",)}),
    )

    # Singleton: niente aggiunte oltre la prima riga, niente cancellazione
    def has_add_permission(self, request):
        return not SiteConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.action(description="Invia un'email di prova al tuo indirizzo")
    def send_test_email(self, request, queryset):
        if not request.user.email:
            self.message_user(
                request, "Il tuo utente non ha un'email impostata.",
                level="error")
            return
        send_raw(request.user.email, request.user.username,
                 "AIVOT — email di prova dal backoffice",
                 "<p>La configurazione email di AIVOT funziona. ✔</p>")
        self.message_user(
            request,
            f"Email di prova inviata a {request.user.email}: controlla la "
            f"casella (e i log del backend in caso di errore).")
