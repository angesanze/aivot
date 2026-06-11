from django.utils.translation import get_language
from rest_framework import serializers

from .models import ConstraintTemplate
from .translations import translate_template


class ConstraintTemplateSerializer(serializers.ModelSerializer):
    """Il DB conserva la sorgente italiana; la traduzione avviene qui,
    al momento della serializzazione, nella lingua della richiesta."""
    class Meta:
        model = ConstraintTemplate
        fields = "__all__"

    def to_representation(self, instance):
        return translate_template(super().to_representation(instance),
                                  get_language())
