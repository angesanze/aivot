import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# `or`: una variabile presente ma VUOTA (es. `${SECRET_KEY:-}` nel
# compose senza .env) deve ricadere sul default come se mancasse.
SECRET_KEY = os.environ.get("SECRET_KEY") or "dev-only-change-me"
DEBUG = (os.environ.get("DEBUG") or "1") == "1"
ALLOWED_HOSTS = (os.environ.get("ALLOWED_HOSTS") or "*").split(",")

# Fuori da DEBUG la chiave di sviluppo non è ammessa: meglio non partire
# che partire firmando sessioni con un segreto pubblico.
if not DEBUG and SECRET_KEY == "dev-only-change-me":
    raise RuntimeError(
        "SECRET_KEY mancante: impostala nell'ambiente per la produzione.")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "accounts",
    "catalog",
    "scheduling",
    "store",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # statici admin sotto gunicorn
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",  # lingua da Accept-Language
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [], "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]

# Postgres di default; sqlite come fallback per sviluppo rapido senza container
if os.environ.get("POSTGRES_HOST"):
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "solverstore"),
        "USER": os.environ.get("POSTGRES_USER", "solverstore"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "solverstore"),
        "HOST": os.environ["POSTGRES_HOST"],
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }}
else:
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "dev.sqlite3",
    }}

REST_FRAMEWORK = {
    # Solo token: niente SessionAuthentication, altrimenti il cookie di
    # sessione dell'admin (condiviso tra porte su localhost) fa scattare
    # il controllo CSRF anche sulle API.
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# Per l'admin dietro proxy/origini diverse
CSRF_TRUSTED_ORIGINS = [
    o for o in {
        os.environ.get("FRONTEND_URL", "http://localhost:5173"),
        "http://localhost:5173",
        "http://localhost:8001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8001",
    } if o
]

# In sviluppo qualunque origine; in produzione solo quelle dichiarate
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = [
    o for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o
]

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {
        "format": "{levelname} {asctime} {name} {message}", "style": "{"}},
    "handlers": {"console": {"class": "logging.StreamHandler",
                             "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}

LANGUAGE_CODE = "it"
LANGUAGES = [("it", "Italiano"), ("en", "English")]
TIME_ZONE = "Europe/Rome"
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SOLVER_TIME_LIMIT_DEFAULT = int(os.environ.get("SOLVER_TIME_LIMIT", "30"))

# --- Integrazioni esterne ------------------------------------------------
# Email transazionali (Brevo) — la chiave vive SOLO nell'ambiente
BREVO_API_KEY = os.environ.get("BREVO_API_KEY") or ""
BREVO_SENDER_EMAIL = os.environ.get("BREVO_SENDER_EMAIL") or ""
BREVO_SENDER_NAME = os.environ.get("BREVO_SENDER_NAME") or "AIVOT"

# Google Sign-In (OAuth client ID, da Google Cloud Console)
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID") or ""

# URL pubblico del frontend, usato nei link delle email (reset password)
FRONTEND_URL = os.environ.get("FRONTEND_URL") or "http://localhost:5173"
