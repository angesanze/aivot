from django.contrib import admin
from django.db.models import Count

from .models import ConstraintInstance, Dataset, Resource, Run, TimeSlot


@admin.register(Dataset)
class DatasetAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "resources_count", "slots_count",
                    "constraints_count", "created_at")
    list_filter = ("owner",)
    search_fields = ("name", "description", "owner__username")
    date_hierarchy = "created_at"

    def get_queryset(self, request):
        # Conteggi annotati: niente COUNT per riga nella changelist
        return (super().get_queryset(request)
                .annotate(_resources=Count("resources", distinct=True),
                          _slots=Count("slots", distinct=True),
                          _constraints=Count("constraints", distinct=True)))

    @admin.display(description="Persone", ordering="_resources")
    def resources_count(self, obj):
        return obj._resources

    @admin.display(description="Turni", ordering="_slots")
    def slots_count(self, obj):
        return obj._slots

    @admin.display(description="Regole", ordering="_constraints")
    def constraints_count(self, obj):
        return obj._constraints


@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    list_display = ("name", "dataset", "skills")
    list_filter = ("dataset",)
    search_fields = ("name", "dataset__name")


@admin.register(TimeSlot)
class TimeSlotAdmin(admin.ModelAdmin):
    list_display = ("day", "code", "label", "start", "end", "dataset")
    list_filter = ("dataset", "code")
    date_hierarchy = "day"


@admin.register(ConstraintInstance)
class ConstraintInstanceAdmin(admin.ModelAdmin):
    list_display = ("display_label", "template", "nature", "weight",
                    "enabled", "dataset")
    list_filter = ("nature", "enabled", "template", "dataset")
    search_fields = ("label", "template__name", "dataset__name")

    @admin.display(description="Etichetta")
    def display_label(self, obj):
        return obj.display_label()


@admin.register(Run)
class RunAdmin(admin.ModelAdmin):
    list_display = ("__str__", "name", "group", "status", "dataset",
                    "assignments_count", "wall_time", "created_at")
    list_filter = ("status", "dataset", "group")
    search_fields = ("name", "group", "dataset__name")
    date_hierarchy = "created_at"
    readonly_fields = ("status", "time_limit", "wall_time", "objective",
                       "assignments", "violations", "conflicts",
                       "explanation", "error", "created_at")

    @admin.display(description="Assegnazioni")
    def assignments_count(self, obj):
        return len(obj.assignments)
