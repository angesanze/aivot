"""Test del flusso di autenticazione e della configurazione piattaforma."""
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APITestCase

from .models import SiteConfig

GOOD = {"username": "mrossi", "password": "password123",
        "email": "mario@rossi.it", "first_name": "Mario",
        "last_name": "Rossi"}


class RegisterTests(APITestCase):

    def test_full_registration(self):
        r = self.client.post("/api/auth/register/", GOOD, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["token"])
        u = User.objects.get(username="mrossi")
        self.assertEqual((u.first_name, u.last_name), ("Mario", "Rossi"))

    def test_requires_names(self):
        bad = {**GOOD, "first_name": ""}
        r = self.client.post("/api/auth/register/", bad, format="json")
        self.assertEqual(r.status_code, 400)

    def test_requires_valid_unique_email(self):
        self.client.post("/api/auth/register/", GOOD, format="json")
        for email in ("", "non-valida", "MARIO@ROSSI.IT"):
            r = self.client.post(
                "/api/auth/register/",
                {**GOOD, "username": "altro", "email": email}, format="json")
            self.assertEqual(r.status_code, 400, email)

    def test_rejects_short_password_and_dup_username(self):
        self.client.post("/api/auth/register/", GOOD, format="json")
        r = self.client.post("/api/auth/register/",
                             {**GOOD, "email": "x@y.it", "password": "corta"},
                             format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/auth/register/",
                             {**GOOD, "username": "MROSSI", "email": "x@y.it"},
                             format="json")
        self.assertEqual(r.status_code, 400)


class LoginResetTests(APITestCase):

    def setUp(self):
        self.client.post("/api/auth/register/", GOOD, format="json")
        self.user = User.objects.get(username="mrossi")

    def test_login_and_wrong_password(self):
        r = self.client.post("/api/auth/login/",
                             {"username": "mrossi",
                              "password": "password123"}, format="json")
        self.assertEqual(r.status_code, 200)
        r = self.client.post("/api/auth/login/",
                             {"username": "mrossi", "password": "no"},
                             format="json")
        self.assertEqual(r.status_code, 400)

    def test_forgot_no_account_enumeration(self):
        r1 = self.client.post("/api/auth/forgot/",
                              {"email": "mario@rossi.it"}, format="json")
        r2 = self.client.post("/api/auth/forgot/",
                              {"email": "nessuno@mai.it"}, format="json")
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.data, r2.data)

    def test_reset_single_use(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        code = f"{uid}.{token}"
        r = self.client.post("/api/auth/reset/",
                             {"code": code, "password": "nuovapassword1"},
                             format="json")
        self.assertEqual(r.status_code, 200)
        # riuso -> rifiutato
        r = self.client.post("/api/auth/reset/",
                             {"code": code, "password": "altrapassword1"},
                             format="json")
        self.assertEqual(r.status_code, 400)
        # la nuova password funziona
        r = self.client.post("/api/auth/login/",
                             {"username": "mrossi",
                              "password": "nuovapassword1"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_reset_malformed_code(self):
        r = self.client.post("/api/auth/reset/",
                             {"code": "garbage", "password": "password123"},
                             format="json")
        self.assertEqual(r.status_code, 400)

    def test_logout_revokes_token(self):
        token = self.client.post(
            "/api/auth/login/", {"username": "mrossi",
                                 "password": "password123"},
            format="json").data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        self.assertEqual(self.client.post("/api/auth/logout/").status_code,
                         204)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)


class ProfileTests(APITestCase):

    def setUp(self):
        self.client.post("/api/auth/register/", GOOD, format="json")
        self.user = User.objects.get(username="mrossi")
        token = self.client.post(
            "/api/auth/login/",
            {"username": "mrossi", "password": "password123"},
            format="json").data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")

    def test_update_own_data(self):
        r = self.client.patch("/api/auth/me/",
                              {"first_name": "Maria", "email": "m2@r.it"},
                              format="json")
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Maria")
        self.assertEqual(self.user.email, "m2@r.it")
        # cognome non toccato se non inviato
        self.assertEqual(self.user.last_name, "Rossi")

    def test_email_must_be_valid_and_unique(self):
        User.objects.create_user("altro", email="presa@x.it",
                                 password="password123")
        for email in ("", "non-valida", "PRESA@X.IT"):
            r = self.client.patch("/api/auth/me/", {"email": email},
                                  format="json")
            self.assertEqual(r.status_code, 400, email)
        # la propria email attuale resta valida
        r = self.client.patch("/api/auth/me/",
                              {"email": "mario@rossi.it"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_change_password_rotates_token(self):
        old_token = self.client._credentials["HTTP_AUTHORIZATION"]
        r = self.client.post("/api/auth/password/",
                             {"current_password": "password123",
                              "new_password": "nuovissima1"}, format="json")
        self.assertEqual(r.status_code, 200)
        new_token = r.data["token"]
        # il vecchio token è morto, il nuovo funziona
        self.client.credentials(HTTP_AUTHORIZATION=old_token)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {new_token}")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)

    def test_change_password_requires_current(self):
        r = self.client.post("/api/auth/password/",
                             {"current_password": "sbagliata",
                              "new_password": "nuovissima1"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/auth/password/",
                             {"current_password": "password123",
                              "new_password": "corta"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_google_user_sets_password_without_current(self):
        guser = User.objects.create_user("googler", email="g@g.it")
        guser.set_unusable_password()
        guser.save()
        from rest_framework.authtoken.models import Token
        token = Token.objects.create(user=guser)
        c = self.client_class()
        c.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        r = c.post("/api/auth/password/",
                   {"new_password": "lamiaprima1"}, format="json")
        self.assertEqual(r.status_code, 200)
        guser.refresh_from_db()
        self.assertTrue(guser.check_password("lamiaprima1"))


class SiteConfigTests(APITestCase):

    def test_singleton_and_env_fallback(self):
        SiteConfig.load()
        SiteConfig.load()
        self.assertEqual(SiteConfig.objects.count(), 1)
        eff = SiteConfig.effective()
        self.assertIn("brevo_api_key", eff)

    def test_db_overrides_env(self):
        cfg = SiteConfig.load()
        cfg.google_client_id = "db-id"
        cfg.save()
        r = self.client.get("/api/auth/config/")
        self.assertEqual(r.data["google_client_id"], "db-id")

    def test_google_login_unconfigured(self):
        r = self.client.post("/api/auth/google/", {"credential": "x"},
                             format="json")
        self.assertEqual(r.status_code, 400)
