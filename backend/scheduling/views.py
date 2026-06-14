import logging
import secrets

from django.conf import settings
from django.db.models import Count
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from config.cloud_tasks import enqueue
from config.translations import tr
from .importers import ImportError_, parse_people_file
from .models import ConstraintInstance, Dataset, Resource, Run, TimeSlot
from .tasks import execute_run
from .serializers import (ConstraintInstanceSerializer, DatasetSerializer,
                          ResourceSerializer, RunSerializer, TimeSlotSerializer)

logger = logging.getLogger(__name__)


def _clamp_time_limit(raw):
    """time_limit dell'utente: intero tra 1 e 600 secondi, qualunque
    cosa arrivi nel payload."""
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = settings.SOLVER_TIME_LIMIT_DEFAULT
    return max(1, min(value, 600))


class DatasetViewSet(viewsets.ModelViewSet):
    queryset = Dataset.objects.all()
    serializer_class = DatasetSerializer

    def get_queryset(self):
        # Area utente: ognuno vede solo i propri progetti. I conteggi
        # arrivano annotati in un'unica query (niente COUNT per riga).
        return (super().get_queryset()
                .filter(owner=self.request.user)
                .annotate(resources_count=Count("resources", distinct=True),
                          slots_count=Count("slots", distinct=True),
                          constraints_count=Count("constraints",
                                                  distinct=True)))

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def solve(self, request, pk=None):
        """Avvia il motore sul dataset. Se la coda Cloud Tasks "solver" è
        attiva (Cloud Run) la Run nasce PENDING e il calcolo lo fa il worker
        in background: si risponde 202 e il frontend fa polling sullo stato.
        In locale (niente code) il calcolo gira inline e si torna la Run
        già completata (201), come da sempre."""
        ds = self.get_object()
        time_limit = _clamp_time_limit(request.data.get("time_limit"))
        run = Run.objects.create(dataset=ds, status="PENDING",
                                 time_limit=time_limit)

        if enqueue("solver", "/tasks/solve/", {"run_id": run.id}):
            return Response(RunSerializer(run).data,
                            status=status.HTTP_202_ACCEPTED)

        execute_run(run)
        return Response(RunSerializer(run).data,
                        status=status.HTTP_201_CREATED)


class _DatasetScopedMixin:
    """Limita ai dataset dell'utente; filtra per ?dataset=<id> se presente."""
    def get_queryset(self):
        qs = super().get_queryset().filter(dataset__owner=self.request.user)
        ds = self.request.query_params.get("dataset")
        return qs.filter(dataset_id=ds) if ds else qs


class _BulkCreateMixin:
    """POST /bulk/ con una lista di oggetti: creazione multipla in una chiamata."""
    @action(detail=False, methods=["post"])
    def bulk(self, request):
        serializer = self.get_serializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ResourceViewSet(_BulkCreateMixin, _DatasetScopedMixin, viewsets.ModelViewSet):
    queryset = Resource.objects.all()
    serializer_class = ResourceSerializer

    @action(detail=False, methods=["post"], url_path="import")
    def import_file(self, request):
        """Import massivo da Excel (.xlsx) o CSV: colonna 1 = nome,
        colonna 2 = competenze (separate da virgola)."""
        ds = Dataset.objects.filter(pk=request.data.get("dataset"),
                                    owner=request.user).first()
        if ds is None:
            return Response({"detail": tr("Progetto non trovato.")},
                            status=status.HTTP_400_BAD_REQUEST)
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"detail": tr("Nessun file caricato.")},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            people, skipped = parse_people_file(upload.name, upload.read())
        except ImportError_ as exc:
            return Response({"detail": str(exc)},
                            status=status.HTTP_400_BAD_REQUEST)

        Resource.objects.bulk_create([
            Resource(dataset=ds, name=name, skills=skills)
            for name, skills in people])
        return Response({"created": len(people), "skipped_rows": skipped},
                        status=status.HTTP_201_CREATED)


class TimeSlotViewSet(_BulkCreateMixin, _DatasetScopedMixin, viewsets.ModelViewSet):
    queryset = TimeSlot.objects.all()
    serializer_class = TimeSlotSerializer

    @action(detail=False, methods=["post"])
    def clear(self, request):
        """Svuota tutti gli slot di un dataset."""
        ds = request.data.get("dataset")
        if not ds:
            return Response({"detail": tr("dataset richiesto")},
                            status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = TimeSlot.objects.filter(
            dataset_id=ds, dataset__owner=request.user).delete()
        return Response({"deleted": deleted})


class ConstraintInstanceViewSet(_DatasetScopedMixin, viewsets.ModelViewSet):
    queryset = ConstraintInstance.objects.select_related("template")
    serializer_class = ConstraintInstanceSerializer


class _RunPagination(PageNumberPagination):
    """Le run crescono senza limite e ogni riga porta il JSON delle
    assegnazioni: la lista va a pagine."""
    page_size = 100


class RunViewSet(_DatasetScopedMixin,
                 mixins.ListModelMixin, mixins.RetrieveModelMixin,
                 mixins.UpdateModelMixin, mixins.DestroyModelMixin,
                 viewsets.GenericViewSet):
    """Le run si creano solo via solve(); qui si consultano, rinominano,
    raggruppano ed eliminano."""
    queryset = Run.objects.all()
    serializer_class = RunSerializer
    pagination_class = _RunPagination

    @action(detail=True, methods=["post", "delete"])
    def share(self, request, pk=None):
        """Attiva (POST) o revoca (DELETE) il widget pubblico della run."""
        run = self.get_object()
        if request.method == "DELETE":
            run.share_token = ""
        elif not run.share_token:
            run.share_token = secrets.token_urlsafe(16)
        run.save(update_fields=["share_token"])
        return Response({"share_token": run.share_token})


@api_view(["GET"])
@permission_classes([AllowAny])
def embed_run(request, token):
    """Dati pubblici del widget: solo ciò che serve alla griglia
    (nomi, turni, assegnazioni), mai diagnostica o dati del proprietario."""
    run = (Run.objects.exclude(share_token="")
           .filter(share_token=token).select_related("dataset").first())
    if run is None:
        return Response({"detail": tr("Widget non trovato o revocato.")},
                        status=status.HTTP_404_NOT_FOUND)
    ds = run.dataset
    return Response({
        "name": run.name or tr("Pianificazione #{id}", id=run.pk),
        "created_at": run.created_at,
        "assignments": run.assignments,
        "resources": [{"id": r.id, "name": r.name}
                      for r in ds.resources.all()],
        "slots": [{"id": s.id, "day": s.day.isoformat(), "code": s.code,
                   "label": s.label,
                   "start": s.start.strftime("%H:%M") if s.start else None,
                   "end": s.end.strftime("%H:%M") if s.end else None}
                  for s in ds.slots.all()],
    })
