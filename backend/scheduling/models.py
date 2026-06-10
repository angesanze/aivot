from django.conf import settings
from django.db import models

from catalog.models import ConstraintTemplate


class Dataset(models.Model):
    """Un problema da organizzare: l'insieme di risorse, slot e vincoli.

    Appartiene a un utente: ognuno vede e gestisce solo i propri progetti.
    """
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="datasets",
                              on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Resource(models.Model):
    """Persona, aula, mezzo: qualunque cosa vada assegnata agli slot."""
    dataset = models.ForeignKey(Dataset, related_name="resources",
                                on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    skills = models.JSONField(default=list, blank=True)
    attrs = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return self.name


class TimeSlot(models.Model):
    """Uno slot assegnabile: giorno + codice turno + orario."""
    dataset = models.ForeignKey(Dataset, related_name="slots",
                                on_delete=models.CASCADE)
    day = models.DateField()
    code = models.CharField(max_length=20, help_text="es. M, P, N, Aula-3")
    label = models.CharField(max_length=120, blank=True)
    start = models.TimeField(null=True, blank=True)
    end = models.TimeField(null=True, blank=True)

    class Meta:
        ordering = ["day", "start"]


class ConstraintInstance(models.Model):
    """Un vincolo composto dall'utente: template + parametri + natura.

    È un dato, non codice. Il motore lo legge e costruisce il modello
    a runtime.
    """
    dataset = models.ForeignKey(Dataset, related_name="constraints",
                                on_delete=models.CASCADE)
    template = models.ForeignKey(ConstraintTemplate, on_delete=models.PROTECT)
    params = models.JSONField(default=dict)
    nature = models.CharField(
        max_length=4, choices=[("hard", "Hard"), ("soft", "Soft")], default="hard")
    weight = models.PositiveIntegerField(default=1)
    enabled = models.BooleanField(default=True)
    label = models.CharField(max_length=200, blank=True)

    def display_label(self):
        return self.label or f"{self.template.name} #{self.pk}"


class Run(models.Model):
    """Un'esecuzione del solver su un dataset, con esito e diagnostica."""
    STATUSES = [
        ("PENDING", "In coda"), ("RUNNING", "In esecuzione"),
        ("OPTIMAL", "Ottima"), ("FEASIBLE", "Fattibile"),
        ("INFEASIBLE", "Impossibile"), ("ERROR", "Errore"),
        ("UNKNOWN", "Tempo scaduto senza soluzione"),
    ]
    dataset = models.ForeignKey(Dataset, related_name="runs",
                                on_delete=models.CASCADE)
    name = models.CharField(max_length=120, blank=True)
    group = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=12, choices=STATUSES, default="PENDING")
    time_limit = models.PositiveIntegerField(default=30)
    wall_time = models.FloatField(null=True, blank=True)
    objective = models.FloatField(null=True, blank=True)
    assignments = models.JSONField(default=list, blank=True)
    violations = models.JSONField(default=list, blank=True)
    conflicts = models.JSONField(default=list, blank=True)
    explanation = models.TextField(blank=True)
    error = models.TextField(blank=True)
    # Condivisione come widget: token pubblico non indovinabile,
    # vuoto = condivisione disattivata. Revocabile in ogni momento.
    share_token = models.CharField(max_length=64, blank=True, default="",
                                   db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
