from django.contrib.auth.models import User
from rest_framework import serializers


class RegisterSerializer(serializers.Serializer):
    """Validazione della registrazione: tutta qui, le view restano sottili."""
    first_name = serializers.CharField(
        error_messages={"blank": "Inserisci nome e cognome.",
                        "required": "Inserisci nome e cognome."})
    last_name = serializers.CharField(
        error_messages={"blank": "Inserisci nome e cognome.",
                        "required": "Inserisci nome e cognome."})
    username = serializers.CharField(
        error_messages={"blank": "Scegli un nome utente.",
                        "required": "Scegli un nome utente."})
    email = serializers.EmailField(
        error_messages={"blank": "L'email è obbligatoria.",
                        "required": "L'email è obbligatoria.",
                        "invalid": "Questa email non sembra valida."})
    password = serializers.CharField(
        min_length=8,
        error_messages={
            "min_length": "La password deve avere almeno 8 caratteri.",
            "blank": "La password deve avere almeno 8 caratteri.",
            "required": "La password deve avere almeno 8 caratteri."})

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "Nome utente già in uso: scegline un altro.")
        return value

    def validate_email(self, value):
        # Email unica: è il canale per le comunicazioni (benvenuto,
        # reset, mailing) e va tenuta pulita da subito.
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "Email già registrata: prova ad accedere.")
        return value

    def create(self, validated):
        return User.objects.create_user(**validated)

    @property
    def first_error(self):
        """Il primo messaggio, per risposte {"detail": ...} coerenti col
        resto delle API."""
        for msgs in self.errors.values():
            return str(msgs[0])
        return "Dati non validi."
