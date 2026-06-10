from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="constrainttemplate",
            name="family",
            field=models.CharField(
                choices=[
                    ("base", "Regole di base"),
                    ("copertura", "Copertura"),
                    ("capacita", "Capacità"),
                    ("sequenza", "Sequenza"),
                    ("equita", "Equità"),
                    ("preferenze", "Preferenze"),
                    ("persone", "Persone e coppie"),
                ],
                max_length=20,
            ),
        ),
    ]
