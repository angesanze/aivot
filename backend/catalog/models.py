from django.db import models


class ConstraintTemplate(models.Model):
    """Un template parametrico del catalogo.

    `code` deve corrispondere a un handler registrato in solver/handlers.py.
    `param_schema` descrive i parametri esposti all'utente (il frontend
    genera il form da qui): lista di campi {name, type, label, required,
    options?, default?}.
    """
    FAMILIES = [
        ("base", "Regole di base"),
        ("copertura", "Copertura"),
        ("capacita", "Capacità"),
        ("sequenza", "Sequenza"),
        ("equita", "Equità"),
        ("preferenze", "Preferenze"),
        ("persone", "Persone e coppie"),
        ("custom", "Su misura"),
    ]
    code = models.SlugField(unique=True)
    name = models.CharField(max_length=120)
    family = models.CharField(max_length=20, choices=FAMILIES)
    description = models.TextField(blank=True)
    param_schema = models.JSONField(default=list)
    default_nature = models.CharField(
        max_length=4, choices=[("hard", "Hard"), ("soft", "Soft")], default="hard")
    supports_soft = models.BooleanField(default=True)

    class Meta:
        ordering = ["family", "name"]

    def __str__(self):
        return self.name
