from rest_framework import serializers
from .models import ConstraintTemplate


class ConstraintTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConstraintTemplate
        fields = "__all__"
