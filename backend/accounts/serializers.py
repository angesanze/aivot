from django.contrib.auth.models import User
from rest_framework import serializers

from config.translations import tr, tr_lazy


class RegisterSerializer(serializers.Serializer):
    """Validazione della registrazione: tutta qui, le view restano sottili."""
    first_name = serializers.CharField(
        error_messages={"blank": tr_lazy("Inserisci nome e cognome."),
                        "required": tr_lazy("Inserisci nome e cognome.")})
    last_name = serializers.CharField(
        error_messages={"blank": tr_lazy("Inserisci nome e cognome."),
                        "required": tr_lazy("Inserisci nome e cognome.")})
    username = serializers.CharField(
        error_messages={"blank": tr_lazy("Scegli un nome utente."),
                        "required": tr_lazy("Scegli un nome utente.")})
    email = serializers.EmailField(
        error_messages={"blank": tr_lazy("L'email è obbligatoria."),
                        "required": tr_lazy("L'email è obbligatoria."),
                        "invalid": tr_lazy("Questa email non sembra valida.")})
    password = serializers.CharField(
        min_length=8,
        error_messages={
            "min_length": tr_lazy("La password deve avere almeno 8 caratteri."),
            "blank": tr_lazy("La password deve avere almeno 8 caratteri."),
            "required": tr_lazy("La password deve avere almeno 8 caratteri.")})

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                tr("Nome utente già in uso: scegline un altro."))
        return value

    def validate_email(self, value):
        # Email unica: è il canale per le comunicazioni (benvenuto,
        # reset, mailing) e va tenuta pulita da subito.
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                tr("Email già registrata: prova ad accedere."))
        return value

    def create(self, validated):
        return User.objects.create_user(**validated)

    @property
    def first_error(self):
        """Il primo messaggio, per risposte {"detail": ...} coerenti col
        resto delle API."""
        for msgs in self.errors.values():
            return str(msgs[0])
        return tr("Dati non validi.")
