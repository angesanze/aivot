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
    _pg_host = os.environ["POSTGRES_HOST"]
    # Su Cloud Run la connessione a Cloud SQL passa da un socket unix
    # (/cloudsql/PROGETTO:REGIONE:ISTANZA): in quel caso HOST è la cartella
    # del socket e la porta non si usa.
    _pg_socket = _pg_host.startswith("/")
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "solverstore"),
        "USER": os.environ.get("POSTGRES_USER", "solverstore"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "solverstore"),
        "HOST": _pg_host,
        "PORT": "" if _pg_socket else os.environ.get("POSTGRES_PORT", "5432"),
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

# Firebase Hosting (CDN) davanti a Cloud Run inoltra al backend SOLO il cookie
# chiamato "__session": ogni altro (sessionid, csrftoken) viene scartato.
# Quindi la sessione dell'admin usa quel nome, e il token CSRF vive DENTRO la
# sessione (niente cookie csrftoken separato): così l'unico cookie necessario
# è "__session", che Firebase lascia passare, e il login admin regge via
# dominio. Trasparente in locale e per l'API DRF (token auth, non sessione).
SESSION_COOKIE_NAME = "__session"
CSRF_USE_SESSIONS = True

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

# --- Cloud Run / Cloud Tasks ---------------------------------------------
# URL pubblico di QUESTO servizio backend (es. https://aivot-xxx.run.app).
# Serve sia come destinazione dei task sia come audience del token OIDC.
# Vuoto in locale: le code si disattivano e tutto gira inline/in thread.
SERVICE_URL = (os.environ.get("SERVICE_URL") or "").rstrip("/")

# Cloud Tasks: progetto, regione, code e service account che firma i task.
# Se uno qualunque manca, `config.cloud_tasks.enabled()` è False ovunque.
CLOUD_TASKS_PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT") or ""
CLOUD_TASKS_LOCATION = os.environ.get("CLOUD_TASKS_LOCATION") or ""
CLOUD_TASKS_SERVICE_URL = SERVICE_URL
CLOUD_TASKS_INVOKER_SA = os.environ.get("CLOUD_TASKS_INVOKER_SA") or ""
CLOUD_TASKS_QUEUE_EMAILS = os.environ.get("CLOUD_TASKS_QUEUE_EMAILS") or ""
CLOUD_TASKS_QUEUE_SOLVER = os.environ.get("CLOUD_TASKS_QUEUE_SOLVER") or ""

# Dietro il proxy di Cloud Run l'header X-Forwarded-Proto dice "https":
# senza questo Django costruisce URL assoluti in http e i redirect rompono.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# L'host del servizio (xxx.run.app) va ammesso e dichiarato CSRF-trusted.
if SERVICE_URL:
    # ALLOWED_HOSTS vuole il solo host, senza schema né porta (se per caso
    # SERVICE_URL ne avesse una, es. in test). CSRF_TRUSTED_ORIGINS invece
    # vuole l'origine completa di schema (e porta).
    _service_host = SERVICE_URL.split("://", 1)[-1].split(":", 1)[0]
    if _service_host not in ALLOWED_HOSTS and "*" not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_service_host)
    if SERVICE_URL not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(SERVICE_URL)

# Origini extra fidate per il CSRF (es. il vecchio URL Firebase quando si passa
# a un dominio custom): così l'admin resta usabile su entrambi durante la
# transizione. Lista separata da virgole di origini complete (con schema).
for _origin in (os.environ.get("EXTRA_CSRF_ORIGINS") or "").split(","):
    _origin = _origin.strip()
    if _origin and _origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(_origin)
