from django.contrib import admin

from .models import StoreItem


@admin.register(StoreItem)
class StoreItemAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "rules_count", "installs",
                    "approved", "created_at")
    list_filter = ("approved", "author")
    list_editable = ("approved",)
    search_fields = ("title", "description", "author__username")
    date_hierarchy = "created_at"

    @admin.display(description="Regole")
    def rules_count(self, obj):
        return len(obj.rules)
