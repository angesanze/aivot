"""
Store condiviso: ricette di regole pubblicate dagli utenti.

Una ricetta è SOLO dati (lista di vincoli con tipo, parametri, natura e
peso): mai codice. Le regole legate a persone specifiche del progetto
d'origine vengono scartate alla pubblicazione perché non trasferibili.
"""
from django.conf import settings
from django.db import models


class StoreItem(models.Model):
    author = models.ForeignKey(settings.AUTH_USER_MODEL,
                               related_name="store_items",
                               on_delete=models.CASCADE)
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    # {"rules": [{"type", "params", "nature", "weight", "label"}, ...]}
    payload = models.JSONField(default=dict)
    installs = models.PositiveIntegerField(default=0)
    # Moderazione: il backoffice può nascondere contenuti inappropriati
    approved = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-installs", "-created_at"]
        verbose_name = "Ricetta pubblicata"
        verbose_name_plural = "Ricette pubblicate"

    def __str__(self):
        return self.title

    @property
    def rules(self):
        return self.payload.get("rules", [])
