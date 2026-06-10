from rest_framework import viewsets
from .models import ConstraintTemplate
from .serializers import ConstraintTemplateSerializer


class ConstraintTemplateViewSet(viewsets.ModelViewSet):
    queryset = ConstraintTemplate.objects.all()
    serializer_class = ConstraintTemplateSerializer
