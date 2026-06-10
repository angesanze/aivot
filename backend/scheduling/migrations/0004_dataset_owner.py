from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("scheduling", "0003_run_name_group"),
    ]

    operations = [
        migrations.AddField(
            model_name="dataset",
            name="owner",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="datasets",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
