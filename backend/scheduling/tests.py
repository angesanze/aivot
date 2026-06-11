"""Test dell'area utente: isolamento tra utenti e flusso completo
persone -> turni -> regola -> solve -> gestione run."""
import io
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from catalog.models import ConstraintTemplate
from .models import Dataset


def auth(client, user):
    token, _ = Token.objects.get_or_create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")


class ScopingTests(APITestCase):

    def setUp(self):
        self.alice = User.objects.create_user("alice", password="password123")
        self.bob = User.objects.create_user("bob", password="password123")
        self.ds_bob = Dataset.objects.create(name="Di Bob", owner=self.bob)

    def test_unauthenticated_is_rejected(self):
        self.assertEqual(self.client.get("/api/datasets/").status_code, 401)

    def test_user_sees_only_own_datasets(self):
        auth(self.client, self.alice)
        self.assertEqual(self.client.get("/api/datasets/").data, [])

    def test_cannot_write_into_foreign_dataset(self):
        auth(self.client, self.alice)
        r = self.client.post("/api/resources/",
                             {"dataset": self.ds_bob.id, "name": "Intruso"},
                             format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/resources/bulk/",
                             [{"dataset": self.ds_bob.id, "name": "I2"}],
                             format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post(f"/api/datasets/{self.ds_bob.id}/solve/", {},
                             format="json")
        self.assertEqual(r.status_code, 404)
        r = self.client.post("/api/slots/clear/",
                             {"dataset": self.ds_bob.id}, format="json")
        self.assertEqual(r.data["deleted"], 0)

    def test_create_assigns_owner(self):
        auth(self.client, self.alice)
        r = self.client.post("/api/datasets/", {"name": "Mio"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Dataset.objects.get(pk=r.data["id"]).owner,
                         self.alice)


class ImportPeopleTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user("ange", password="password123")
        auth(self.client, self.user)
        self.ds = Dataset.objects.create(name="Turni", owner=self.user)

    def upload(self, filename, content, ds=None):
        return self.client.post(
            "/api/resources/import/",
            {"dataset": ds or self.ds.id,
             "file": SimpleUploadedFile(filename, content)},
            format="multipart")

    def test_csv_with_header_and_semicolons(self):
        csv = ("Nome;Competenze\n"
               "Anna Rossi;infermiere, senior\n"
               "Bruno Bianchi;infermiere\n"
               "\n"
               ";solo-skill-senza-nome\n").encode()
        r = self.upload("persone.csv", csv)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["created"], 2)
        self.assertEqual(r.data["skipped_rows"], [5])
        anna = self.ds.resources.get(name="Anna Rossi")
        self.assertEqual(anna.skills, ["infermiere", "senior"])

    def test_xlsx(self):
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.append(["nome", "competenze"])
        ws.append(["Carla Verdi", "senior; notturno"])
        ws.append(["Dario Neri", None])
        buf = io.BytesIO()
        wb.save(buf)
        r = self.upload("persone.xlsx", buf.getvalue())
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["created"], 2)
        carla = self.ds.resources.get(name="Carla Verdi")
        self.assertEqual(carla.skills, ["senior", "notturno"])
        self.assertEqual(self.ds.resources.get(name="Dario Neri").skills, [])

    def test_rejects_bad_format_and_empty(self):
        self.assertEqual(self.upload("foto.png", b"xxx").status_code, 400)
        self.assertEqual(self.upload("vuoto.csv", b"\n\n").status_code, 400)
        self.assertEqual(
            self.upload("vecchio.xls", b"xxx").status_code, 400)

    def test_cannot_import_into_foreign_dataset(self):
        other = User.objects.create_user("bob", password="password123")
        ds_bob = Dataset.objects.create(name="Di Bob", owner=other)
        r = self.upload("persone.csv", b"Anna\n", ds=ds_bob.id)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(ds_bob.resources.count(), 0)


class SolveFlowTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user("ange", password="password123")
        auth(self.client, self.user)
        self.tpl_cap = ConstraintTemplate.objects.create(
            code="capacita_massima", name="Capacità massima",
            family="capacita", param_schema=[])
        self.tpl_cov = ConstraintTemplate.objects.create(
            code="copertura_minima", name="Copertura minima",
            family="copertura", param_schema=[])
        self.ds = self.client.post("/api/datasets/", {"name": "Turni"},
                                   format="json").data["id"]
        self.client.post("/api/resources/bulk/",
                         [{"dataset": self.ds, "name": n}
                          for n in ("Ugo", "Vera", "Zoe")], format="json")
        start = date(2026, 6, 1)
        self.client.post("/api/slots/bulk/",
                         [{"dataset": self.ds,
                           "day": (start + timedelta(days=d)).isoformat(),
                           "code": "M"} for d in range(5)], format="json")

    def add_constraint(self, tpl, params, nature="hard"):
        return self.client.post(
            "/api/constraints/",
            {"dataset": self.ds, "template": tpl.id, "params": params,
             "nature": nature, "enabled": True}, format="json")

    def test_empty_result_has_explanation(self):
        self.add_constraint(self.tpl_cap, {"max": 2})
        r = self.client.post(f"/api/datasets/{self.ds}/solve/",
                             {"time_limit": 10}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "OPTIMAL")
        self.assertEqual(r.data["assignments"], [])
        self.assertIn("copertura minima", r.data["explanation"])

    def test_full_solve_and_run_management(self):
        self.add_constraint(self.tpl_cov, {"min": 1})
        r = self.client.post(f"/api/datasets/{self.ds}/solve/",
                             {"time_limit": 10}, format="json")
        self.assertEqual(r.data["status"], "OPTIMAL")
        self.assertEqual(len(r.data["assignments"]), 5)
        run_id = r.data["id"]

        # rinomina e raggruppa
        r = self.client.patch(f"/api/runs/{run_id}/",
                              {"name": "Buona", "group": "Giugno"},
                              format="json")
        self.assertEqual(r.data["name"], "Buona")
        # l'esito è immutabile
        r = self.client.patch(f"/api/runs/{run_id}/", {"status": "ERROR"},
                              format="json")
        self.assertNotEqual(r.data["status"], "ERROR")
        # eliminazione
        self.assertEqual(
            self.client.delete(f"/api/runs/{run_id}/").status_code, 204)

    def test_share_and_embed_flow(self):
        """Genera widget -> endpoint pubblico senza auth -> revoca -> 404."""
        self.add_constraint(self.tpl_cov, {"min": 1})
        run_id = self.client.post(f"/api/datasets/{self.ds}/solve/",
                                  {"time_limit": 10},
                                  format="json").data["id"]
        # genera il token
        r = self.client.post(f"/api/runs/{run_id}/share/")
        token = r.data["share_token"]
        self.assertTrue(token)
        # idempotente: rigenerare non cambia il token
        r = self.client.post(f"/api/runs/{run_id}/share/")
        self.assertEqual(r.data["share_token"], token)

        # endpoint pubblico: niente auth, dati minimi per la griglia
        from rest_framework.test import APIClient
        anon = APIClient()
        r = anon.get(f"/api/embed/runs/{token}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["assignments"]), 5)
        self.assertNotIn("explanation", r.data)  # diagnostica privata
        self.assertNotIn("violations", r.data)

        # token sbagliato -> 404
        self.assertEqual(anon.get("/api/embed/runs/xxxx/").status_code, 404)

        # un altro utente non può condividere run altrui
        other = User.objects.create_user("intruso", password="password123")
        c2 = self.client_class()
        auth(c2, other)
        self.assertEqual(
            c2.post(f"/api/runs/{run_id}/share/").status_code, 404)

        # revoca -> il widget si spegne
        r = self.client.delete(f"/api/runs/{run_id}/share/")
        self.assertEqual(r.data["share_token"], "")
        self.assertEqual(anon.get(f"/api/embed/runs/{token}/").status_code,
                         404)

    def test_explanation_follows_request_language(self):
        self.add_constraint(self.tpl_cap, {"max": 2})
        r = self.client.post(f"/api/datasets/{self.ds}/solve/",
                             {"time_limit": 10}, format="json",
                             HTTP_ACCEPT_LANGUAGE="en")
        self.assertIn("minimum coverage", r.data["explanation"])

    def test_constraint_template_name_translated(self):
        """Il nome del template denormalizzato sui vincoli attivi segue
        la lingua della richiesta (bug: restava in italiano)."""
        self.add_constraint(self.tpl_cov, {"min": 1})
        r = self.client.get(f"/api/constraints/?dataset={self.ds}",
                            HTTP_ACCEPT_LANGUAGE="en")
        self.assertEqual(r.data[0]["template_name"], "Minimum coverage")
        r = self.client.get(f"/api/constraints/?dataset={self.ds}")
        self.assertEqual(r.data[0]["template_name"], "Copertura minima")

    def test_catalog_served_translated(self):
        r = self.client.get("/api/templates/", HTTP_ACCEPT_LANGUAGE="en")
        tpl = next(t for t in r.data if t["code"] == "capacita_massima")
        self.assertEqual(tpl["name"], "Maximum capacity")
        r = self.client.get("/api/templates/")
        tpl = next(t for t in r.data if t["code"] == "capacita_massima")
        self.assertEqual(tpl["name"], "Capacità massima")

    def test_invalid_time_limit_is_clamped(self):
        self.add_constraint(self.tpl_cov, {"min": 1})
        r = self.client.post(f"/api/datasets/{self.ds}/solve/",
                             {"time_limit": "non-un-numero"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertIn(r.data["status"], ("OPTIMAL", "FEASIBLE"))
