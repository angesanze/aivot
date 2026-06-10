from django.contrib import admin
from django.urls import include, path

# Branding del backoffice
admin.site.site_header = "AIVOT — Backoffice"
admin.site.site_title = "AIVOT admin"
admin.site.index_title = "Gestione piattaforma"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("accounts.urls")),
    path("api/", include("catalog.urls")),
    path("api/", include("scheduling.urls")),
    path("api/", include("store.urls")),
]
