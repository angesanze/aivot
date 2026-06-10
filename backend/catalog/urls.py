from rest_framework.routers import DefaultRouter
from .views import ConstraintTemplateViewSet

router = DefaultRouter()
router.register("templates", ConstraintTemplateViewSet)
urlpatterns = router.urls
