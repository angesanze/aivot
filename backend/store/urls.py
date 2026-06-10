from rest_framework.routers import DefaultRouter

from .views import StoreItemViewSet

router = DefaultRouter()
router.register("store", StoreItemViewSet)
urlpatterns = router.urls
