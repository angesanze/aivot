"""Sincronizza il catalogo regole, crea gli utenti di servizio e un
dataset demo (reparto infermieri). Idempotente: si può rilanciare.

Uso: python manage.py seed
"""
import os
from datetime import date, time, timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from accounts.models import SiteConfig
from catalog.data import CATALOG
from catalog.models import ConstraintTemplate
from scheduling.models import ConstraintInstance, Dataset, Resource, TimeSlot
from solver.handlers import HANDLERS


class Command(BaseCommand):
    help = "Sincronizza catalogo vincoli, utenti di servizio e dataset demo"

    def handle(self, *args, **opts):
        self._sync_catalog()
        SiteConfig.load()  # riga di configurazione visibile nel backoffice
        self._ensure_superadmin()
        demo = self._ensure_demo_user()
        self._adopt_orphan_datasets(demo)
        self._ensure_demo_dataset(demo)

    # ------------------------------------------------------------------
    def _sync_catalog(self):
        """Catalogo a DB allineato a catalog/data.py, con la garanzia che
        ogni template abbia il suo handler nel motore."""
        missing = {t["code"] for t in CATALOG} - set(HANDLERS)
        if missing:
            raise SystemExit(
                f"Template senza handler nel motore: {sorted(missing)}")
        for t in CATALOG:
            ConstraintTemplate.objects.update_or_create(
                code=t["code"], defaults=t)
        self.stdout.write(f"Catalogo: {len(CATALOG)} template")

    def _ensure_superadmin(self):
        """Superadmin per la plancia di backoffice (/admin/).
        Credenziali via env (ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL),
        con default di sviluppo da cambiare in produzione."""
        if User.objects.filter(is_superuser=True).exists():
            return
        admin_user = os.environ.get("ADMIN_USERNAME", "admin")
        admin_pass = os.environ.get("ADMIN_PASSWORD", "aivot-admin")
        User.objects.create_superuser(
            username=admin_user, password=admin_pass,
            email=os.environ.get("ADMIN_EMAIL", "admin@aivot.local"))
        self.stdout.write(self.style.WARNING(
            f"Superadmin creato ({admin_user} / {admin_pass}): "
            f"cambia la password in produzione."))

    def _ensure_demo_user(self):
        """Utente demo: accesso di prova con il dataset d'esempio."""
        demo, created = User.objects.get_or_create(username="demo")
        if created:
            demo.set_password("demo1234")
            demo.save()
            self.stdout.write("Utente demo creato (demo / demo1234)")
        return demo

    def _adopt_orphan_datasets(self, demo):
        """I dataset creati prima dell'introduzione del login non hanno
        proprietario: li adotta l'utente demo, così restano raggiungibili."""
        orphans = Dataset.objects.filter(owner__isnull=True).update(owner=demo)
        if orphans:
            self.stdout.write(
                f"{orphans} dataset senza proprietario assegnati a demo.")

    def _ensure_demo_dataset(self, demo):
        if Dataset.objects.filter(name="Demo reparto infermieri").exists():
            self.stdout.write("Dataset demo già presente, salto.")
            return

        ds = Dataset.objects.create(
            name="Demo reparto infermieri", owner=demo,
            description="9 infermieri, 7 giorni, turni M/P/N")

        names = ["Anna", "Bruno", "Carla", "Dario", "Elena",
                 "Fabio", "Giulia", "Hamid", "Irene"]
        people = {}
        for i, n in enumerate(names):
            people[n] = Resource.objects.create(
                dataset=ds, name=n,
                skills=["infermiere"] + (["senior"] if i < 3 else []))

        start = date.today()
        shifts = [("M", time(6), time(14)), ("P", time(14), time(22)),
                  ("N", time(22), time(6))]
        for d in range(7):
            day = start + timedelta(days=d)
            for code, st, en in shifts:
                TimeSlot.objects.create(dataset=ds, day=day, code=code,
                                        start=st, end=en, label=code)

        def add(code, params, nature, weight=1, label=""):
            ConstraintInstance.objects.create(
                dataset=ds,
                template=ConstraintTemplate.objects.get(code=code),
                params=params, nature=nature, weight=weight, label=label)

        add("un_turno_al_giorno", {}, "hard", label="Un turno al giorno")
        add("copertura_minima", {"min": 2}, "hard",
            label="Almeno 2 persone per turno")
        add("copertura_minima", {"min": 1, "skill": "senior", "shift_code": "N"},
            "soft", 5, "Un senior di notte")
        add("max_giorni_consecutivi", {"max": 5}, "hard",
            label="Max 5 giorni consecutivi")
        add("riposo_minimo", {"ore": 11}, "hard", label="Riposo minimo 11 ore")
        add("equita_distribuzione", {"shift_code": "N", "tolleranza": 1},
            "soft", 3, "Notti distribuite equamente")
        add("indisponibilita",
            {"resource_id": people["Carla"].id,
             "day": (start + timedelta(days=2)).isoformat()},
            "hard", label="Carla assente giorno 3")

        self.stdout.write(self.style.SUCCESS("Dataset demo creato."))
