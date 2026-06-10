from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="StoreItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True,
                                           serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=120)),
                ("description", models.TextField(blank=True)),
                ("payload", models.JSONField(default=dict)),
                ("installs", models.PositiveIntegerField(default=0)),
                ("approved", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("author", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="store_items",
                    to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-installs", "-created_at"],
                "verbose_name": "Ricetta pubblicata",
                "verbose_name_plural": "Ricette pubblicate",
            },
        ),
    ]
