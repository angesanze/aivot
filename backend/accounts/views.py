"""
Autenticazione a token per l'area utente.

Registrazione e login restituiscono un token che il frontend allega a ogni
richiesta (header `Authorization: Token <...>`). Ogni utente vede solo i
propri progetti. Le email transazionali (benvenuto, reset password)
partono via Brevo; il Google Sign-In verifica l'ID token lato server.
"""
import logging
import re

import requests as http
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .emails import send_password_reset, send_welcome
from .models import SiteConfig
from .serializers import RegisterSerializer

logger = logging.getLogger(__name__)


def _user_data(user):
    return {"username": user.username, "email": user.email,
            "first_name": user.first_name, "last_name": user.last_name,
            "has_password": user.has_usable_password()}


def _payload(user):
    token, _ = Token.objects.get_or_create(user=user)
    return {"token": token.key, **_user_data(user)}


def _bad(msg):
    return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([AllowAny])
def config(request):
    """Configurazione pubblica per la pagina di accesso."""
    return Response(
        {"google_client_id": SiteConfig.effective()["google_client_id"]})


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return _bad(serializer.first_error)
    user = serializer.save()
    send_welcome(user)
    return Response(_payload(user), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    user = authenticate(username=(request.data.get("username") or "").strip(),
                        password=request.data.get("password") or "")
    if user is None:
        return _bad("Nome utente o password sbagliati.")
    return Response(_payload(user))


@api_view(["POST"])
@permission_classes([AllowAny])
def forgot_password(request):
    """Invia il link di reset. Risposta sempre identica: non rivela se
    l'email esiste (evita l'enumerazione degli account)."""
    email = (request.data.get("email") or "").strip()
    user = User.objects.filter(email__iexact=email).first()
    if user:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        base = SiteConfig.effective()["frontend_url"].rstrip("/")
        send_password_reset(user, f"{base}/?reset={uid}.{token}")
    return Response({"detail": "Se l'email è registrata, riceverai a breve "
                               "il link per reimpostare la password."})


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password(request):
    code = (request.data.get("code") or "").strip()
    password = request.data.get("password") or ""
    m = re.fullmatch(r"([A-Za-z0-9_-]+)\.(.+)", code)
    if not m:
        return _bad("Link di reset non valido.")
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(m[1])))
    except (User.DoesNotExist, ValueError, OverflowError):
        return _bad("Link di reset non valido.")
    if not default_token_generator.check_token(user, m[2]):
        return _bad("Link di reset scaduto o già usato: richiedine un altro.")
    if len(password) < 8:
        return _bad("La password deve avere almeno 8 caratteri.")
    user.set_password(password)
    user.save(update_fields=["password"])
    Token.objects.filter(user=user).delete()  # invalida le vecchie sessioni
    return Response(_payload(user))


@api_view(["POST"])
@permission_classes([AllowAny])
def google_login(request):
    """Verifica l'ID token di Google Identity Services e apre la sessione,
    creando l'account al primo accesso."""
    client_id = SiteConfig.effective()["google_client_id"]
    if not client_id:
        return _bad("Accesso Google non configurato su questo server.")
    credential = request.data.get("credential") or ""
    try:
        r = http.get("https://oauth2.googleapis.com/tokeninfo",
                     params={"id_token": credential}, timeout=10)
    except http.exceptions.RequestException:
        logger.warning("Google tokeninfo non raggiungibile", exc_info=True)
        return _bad("Google non raggiungibile: riprova tra poco.")
    if r.status_code != 200:
        return _bad("Accesso Google non riuscito: riprova.")
    info = r.json()
    if info.get("aud") != client_id:
        return _bad("Accesso Google non riuscito: riprova.")
    if str(info.get("email_verified")).lower() != "true":
        return _bad("La tua email Google non risulta verificata.")

    email = info["email"]
    user = User.objects.filter(email__iexact=email).first()
    if user is None:
        base = re.sub(r"[^a-z0-9._-]", "", email.split("@")[0].lower())[:24] \
            or "utente"
        username, n = base, 1
        while User.objects.filter(username__iexact=username).exists():
            n += 1
            username = f"{base}{n}"
        user = User.objects.create_user(
            username=username, email=email,
            first_name=info.get("given_name", ""),
            last_name=info.get("family_name", ""))
        user.set_unusable_password()
        user.save(update_fields=["password"])
        send_welcome(user)
    return Response(_payload(user))


@api_view(["POST"])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "PATCH"])
def me(request):
    """Profilo dell'utente: lettura e modifica di nome, cognome, email."""
    user = request.user
    if request.method == "PATCH":
        if "first_name" in request.data:
            user.first_name = (request.data.get("first_name") or "").strip()
        if "last_name" in request.data:
            user.last_name = (request.data.get("last_name") or "").strip()
        if "email" in request.data:
            email = (request.data.get("email") or "").strip()
            if not email:
                return _bad("L'email è obbligatoria.")
            try:
                validate_email(email)
            except ValidationError:
                return _bad("Questa email non sembra valida.")
            if User.objects.filter(email__iexact=email) \
                           .exclude(pk=user.pk).exists():
                return _bad("Email già usata da un altro account.")
            user.email = email
        user.save()
    return Response(_user_data(user))


@api_view(["POST"])
def change_password(request):
    """Cambio password dall'area utente. Chi è entrato con Google (nessuna
    password impostata) può crearne una senza fornire quella attuale.
    Le altre sessioni vengono invalidate; questa riceve un token nuovo."""
    user = request.user
    new = request.data.get("new_password") or ""
    if user.has_usable_password():
        current = request.data.get("current_password") or ""
        if not user.check_password(current):
            return _bad("La password attuale non è corretta.")
    if len(new) < 8:
        return _bad("La nuova password deve avere almeno 8 caratteri.")
    user.set_password(new)
    user.save(update_fields=["password"])
    Token.objects.filter(user=user).delete()
    token = Token.objects.create(user=user)
    return Response({"token": token.key,
                     "detail": "Password aggiornata."})
