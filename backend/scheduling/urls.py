from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (ConstraintInstanceViewSet, DatasetViewSet,
                    ResourceViewSet, RunViewSet, TimeSlotViewSet, embed_run)

router = DefaultRouter()
router.register("datasets", DatasetViewSet)
router.register("resources", ResourceViewSet)
router.register("slots", TimeSlotViewSet)
router.register("constraints", ConstraintInstanceViewSet)
router.register("runs", RunViewSet)

urlpatterns = router.urls + [
    # Pubblico: alimenta il widget embeddabile (iframe)
    path("embed/runs/<str:token>/", embed_run),
]
