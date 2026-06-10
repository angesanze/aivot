from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scheduling", "0002_run_explanation"),
    ]

    operations = [
        migrations.AddField(
            model_name="run",
            name="name",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="run",
            name="group",
            field=models.CharField(blank=True, max_length=120),
        ),
    ]
