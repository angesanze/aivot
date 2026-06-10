from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scheduling", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="run",
            name="explanation",
            field=models.TextField(blank=True),
        ),
    ]
