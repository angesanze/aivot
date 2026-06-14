from django.contrib import admin
from django.urls import include, path

from . import task_views

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
    # Worker interni di Cloud Tasks (protetti da token OIDC, non pubblici)
    path("tasks/email/", task_views.email_worker),
    path("tasks/solve/", task_views.solve_worker),
]
