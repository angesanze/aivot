from rest_framework import serializers

from .models import StoreItem


class StoreItemSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username",
                                            read_only=True)
    rules_count = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = StoreItem
        fields = ["id", "title", "description", "payload", "installs",
                  "created_at", "author_username", "rules_count", "is_mine"]
        read_only_fields = ["payload", "installs", "created_at"]

    def get_rules_count(self, obj):
        return len(obj.rules)

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and obj.author_id == request.user.id)
