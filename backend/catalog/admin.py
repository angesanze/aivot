from django.contrib import admin

from .models import ConstraintTemplate


@admin.register(ConstraintTemplate)
class ConstraintTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "family", "default_nature",
                    "supports_soft")
    list_filter = ("family", "default_nature")
    search_fields = ("name", "code", "description")
