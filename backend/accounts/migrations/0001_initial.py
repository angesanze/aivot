from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="SiteConfig",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True,
                                           serialize=False, verbose_name="ID")),
                ("brevo_api_key", models.CharField(
                    blank=True,
                    help_text="Vuoto = usa la variabile d'ambiente BREVO_API_KEY.",
                    max_length=200, verbose_name="Chiave API Brevo")),
                ("brevo_sender_email", models.EmailField(
                    blank=True,
                    help_text="Deve essere un mittente validato su Brevo (o "
                              "dominio autenticato). Vuoto = variabile "
                              "d'ambiente.",
                    max_length=254, verbose_name="Email mittente")),
                ("brevo_sender_name", models.CharField(
                    blank=True,
                    help_text="Il nome che appare nelle email, es. AIVOT.",
                    max_length=80, verbose_name="Nome mittente")),
                ("send_welcome_email", models.BooleanField(
                    default=True,
                    help_text="Email di benvenuto alla registrazione (anche "
                              "via Google).",
                    verbose_name="Invia email di benvenuto")),
                ("google_client_id", models.CharField(
                    blank=True,
                    help_text="OAuth Client ID per il Google Sign-In; se "
                              "vuoto qui e nell'ambiente, il bottone Google "
                              "non compare.",
                    max_length=200, verbose_name="Google Client ID")),
                ("frontend_url", models.URLField(
                    blank=True,
                    help_text="Usato nei link delle email (es. reset "
                              "password). Vuoto = variabile d'ambiente.",
                    verbose_name="URL pubblico del frontend")),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Configurazione piattaforma",
                "verbose_name_plural": "Configurazione piattaforma",
            },
        ),
    ]
