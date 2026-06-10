from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scheduling", "0004_dataset_owner"),
    ]

    operations = [
        migrations.AddField(
            model_name="run",
            name="share_token",
            field=models.CharField(blank=True, db_index=True, default="",
                                   max_length=64),
        ),
    ]
