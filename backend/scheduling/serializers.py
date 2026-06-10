from rest_framework import serializers
from .models import ConstraintInstance, Dataset, Resource, Run, TimeSlot


class _OwnedDatasetMixin:
    """Impedisce di scrivere dentro progetti di altri utenti."""
    def validate_dataset(self, ds):
        request = self.context.get("request")
        if request and ds.owner_id != request.user.id:
            raise serializers.ValidationError("Questo progetto non è tuo.")
        return ds


class ResourceSerializer(_OwnedDatasetMixin, serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = "__all__"


class TimeSlotSerializer(_OwnedDatasetMixin, serializers.ModelSerializer):
    class Meta:
        model = TimeSlot
        fields = "__all__"


class ConstraintInstanceSerializer(_OwnedDatasetMixin,
                                   serializers.ModelSerializer):
    template_code = serializers.CharField(source="template.code", read_only=True)
    template_name = serializers.CharField(source="template.name", read_only=True)
    family = serializers.CharField(source="template.family", read_only=True)

    class Meta:
        model = ConstraintInstance
        fields = "__all__"


class RunSerializer(serializers.ModelSerializer):
    class Meta:
        model = Run
        fields = "__all__"
        # L'utente può solo rinominare e raggruppare: l'esito del calcolo
        # è immutabile.
        read_only_fields = ["dataset", "status", "time_limit", "wall_time",
                            "objective", "assignments", "violations",
                            "conflicts", "explanation", "error", "created_at",
                            "share_token"]  # si genera/revoca solo via /share/


class DatasetSerializer(serializers.ModelSerializer):
    """I conteggi arrivano dalle annotazioni del queryset (una query in
    tutto); il fallback su .count() copre l'istanza appena creata."""
    resources_count = serializers.SerializerMethodField()
    slots_count = serializers.SerializerMethodField()
    constraints_count = serializers.SerializerMethodField()

    def _count(self, obj, name):
        value = getattr(obj, f"{name}_count", None)
        return value if value is not None else getattr(obj, name).count()

    def get_resources_count(self, obj):
        return self._count(obj, "resources")

    def get_slots_count(self, obj):
        return self._count(obj, "slots")

    def get_constraints_count(self, obj):
        return self._count(obj, "constraints")

    class Meta:
        model = Dataset
        fields = "__all__"
        read_only_fields = ["owner"]
