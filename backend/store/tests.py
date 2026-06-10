"""Test dello store: pubblicazione, installazione, isolamento, ricerca."""
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from catalog.models import ConstraintTemplate
from scheduling.models import ConstraintInstance, Dataset, Resource

from .models import StoreItem


def auth(client, user):
    token, _ = Token.objects.get_or_create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")


class StoreTests(APITestCase):

    def setUp(self):
        self.alice = User.objects.create_user("alice", password="password123")
        self.bob = User.objects.create_user("bob", password="password123")
        self.tpl_cov = ConstraintTemplate.objects.create(
            code="copertura_minima", name="Copertura minima",
            family="copertura", param_schema=[])
        self.tpl_ind = ConstraintTemplate.objects.create(
            code="indisponibilita", name="Indisponibilità",
            family="preferenze", param_schema=[])
        self.ds = Dataset.objects.create(name="Reparto", owner=self.alice)
        self.person = Resource.objects.create(dataset=self.ds, name="Carla")
        ConstraintInstance.objects.create(
            dataset=self.ds, template=self.tpl_cov, params={"min": 2},
            nature="hard", label="Almeno 2")
        # Regola legata a una persona: NON deve essere pubblicata
        ConstraintInstance.objects.create(
            dataset=self.ds, template=self.tpl_ind,
            params={"resource_id": self.person.id}, nature="hard")
        auth(self.client, self.alice)

    def publish(self, **extra):
        return self.client.post(
            "/api/store/publish/",
            {"dataset": self.ds.id, "title": "Turni reparto",
             "description": "Base ospedaliera", **extra}, format="json")

    def test_publish_strips_person_rules(self):
        r = self.publish()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["rules_count"], 1)
        self.assertEqual(r.data["skipped_person_rules"], 1)
        rule = StoreItem.objects.get().rules[0]
        self.assertEqual(rule["type"], "copertura_minima")
        self.assertEqual(rule["params"], {"min": 2})

    def test_publish_requires_title_and_own_dataset(self):
        self.assertEqual(self.publish(title="").status_code, 400)
        auth(self.client, self.bob)
        self.assertEqual(self.publish().status_code, 400)

    def test_install_into_own_dataset(self):
        self.publish()
        item = StoreItem.objects.get()
        auth(self.client, self.bob)
        target = Dataset.objects.create(name="Mio", owner=self.bob)
        r = self.client.post(f"/api/store/{item.id}/install/",
                             {"dataset": target.id}, format="json")
        self.assertEqual(r.data["installed"], 1)
        self.assertEqual(target.constraints.count(), 1)
        item.refresh_from_db()
        self.assertEqual(item.installs, 1)

    def test_cannot_install_into_foreign_dataset(self):
        self.publish()
        item = StoreItem.objects.get()
        auth(self.client, self.bob)
        r = self.client.post(f"/api/store/{item.id}/install/",
                             {"dataset": self.ds.id}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.ds.constraints.count(), 2)  # invariato

    def test_search_and_moderation(self):
        self.publish()
        StoreItem.objects.create(author=self.bob, title="Nascosta",
                                 approved=False, payload={"rules": []})
        r = self.client.get("/api/store/?q=reparto")
        self.assertEqual(len(r.data), 1)
        r = self.client.get("/api/store/")
        titles = {i["title"] for i in r.data}
        self.assertNotIn("Nascosta", titles)  # non approvata, non mia

    def test_delete_only_own(self):
        self.publish()
        item = StoreItem.objects.get()
        auth(self.client, self.bob)
        self.assertEqual(
            self.client.delete(f"/api/store/{item.id}/").status_code, 403)
        auth(self.client, self.alice)
        self.assertEqual(
            self.client.delete(f"/api/store/{item.id}/").status_code, 204)
