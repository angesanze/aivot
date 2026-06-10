"""
API dello store: pubblica una ricetta dal proprio progetto, sfoglia,
installa in un proprio progetto, elimina le proprie pubblicazioni.
"""
from django.db.models import F, Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from catalog.models import ConstraintTemplate
from scheduling.models import ConstraintInstance, Dataset

from .models import StoreItem
from .serializers import StoreItemSerializer

# Parametri legati a persone del progetto d'origine: non trasferibili
PERSON_PARAMS = {"resource_id", "resource_id_2"}


def _bad(msg):
    return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)


class StoreItemViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin,
                       mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = StoreItem.objects.select_related("author")
    serializer_class = StoreItemSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # In lista solo il contenuto approvato (più, sempre, il proprio)
        qs = qs.filter(Q(approved=True) | Q(author=self.request.user))
        if self.request.query_params.get("mine"):
            qs = qs.filter(author=self.request.user)
        q = self.request.query_params.get("q", "").strip()
        for word in q.split():
            qs = qs.filter(Q(title__icontains=word)
                           | Q(description__icontains=word))
        return qs

    def perform_destroy(self, instance):
        if instance.author != self.request.user \
                and not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Puoi eliminare solo le tue ricette.")
        instance.delete()

    @action(detail=False, methods=["post"])
    def publish(self, request):
        """Fotografa le regole attive di un proprio progetto e le pubblica.
        Le regole legate a persone specifiche vengono scartate."""
        title = (request.data.get("title") or "").strip()
        if not title:
            return _bad("Dai un titolo alla ricetta.")
        ds = Dataset.objects.filter(pk=request.data.get("dataset"),
                                    owner=request.user).first()
        if ds is None:
            return _bad("Progetto non trovato.")

        rules, skipped = [], 0
        for c in ds.constraints.filter(enabled=True) \
                               .select_related("template"):
            if PERSON_PARAMS & set(c.params):
                skipped += 1
                continue
            rules.append({"type": c.template.code, "params": c.params,
                          "nature": c.nature, "weight": c.weight,
                          "label": c.display_label()})
        if not rules:
            return _bad("Il progetto non ha regole pubblicabili: quelle "
                        "legate a persone specifiche non si possono "
                        "condividere.")

        item = StoreItem.objects.create(
            author=request.user, title=title,
            description=(request.data.get("description") or "").strip(),
            payload={"rules": rules})
        data = StoreItemSerializer(item, context={"request": request}).data
        data["skipped_person_rules"] = skipped
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def install(self, request, pk=None):
        """Copia le regole della ricetta in un proprio progetto."""
        item = self.get_object()
        ds = Dataset.objects.filter(pk=request.data.get("dataset"),
                                    owner=request.user).first()
        if ds is None:
            return _bad("Progetto non trovato.")

        templates = {t.code: t for t in ConstraintTemplate.objects.all()}
        created, unknown = 0, []
        for rule in item.rules:
            tpl = templates.get(rule.get("type"))
            if tpl is None:  # ricetta più nuova del catalogo installato
                unknown.append(rule.get("type"))
                continue
            ConstraintInstance.objects.create(
                dataset=ds, template=tpl,
                params=rule.get("params", {}),
                nature=rule.get("nature", tpl.default_nature),
                weight=rule.get("weight", 1),
                label=rule.get("label", ""), enabled=True)
            created += 1

        if created:
            StoreItem.objects.filter(pk=item.pk) \
                             .update(installs=F("installs") + 1)
        return Response({"installed": created, "unknown_types": unknown})
