"""
Definizioni del catalogo regole: la fonte di verità dei template.

Ogni voce deve avere un handler con lo stesso `code` registrato in
solver/handlers.py (il seed lo verifica). Il comando `manage.py seed`
sincronizza queste definizioni nel database.
"""

CATALOG = [
    {
        "code": "un_turno_al_giorno", "family": "base",
        "name": "Un turno al giorno",
        "description": "Ogni persona copre al massimo un turno per giorno.",
        "param_schema": [], "default_nature": "hard",
    },
    {
        "code": "copertura_minima", "family": "copertura",
        "name": "Copertura minima",
        "description": "Almeno N persone (opzionalmente con una skill) per ogni slot, opzionalmente solo per un codice turno.",
        "param_schema": [
            {"name": "min", "type": "int", "label": "Minimo persone", "required": True, "default": 1},
            {"name": "skill", "type": "string", "label": "Skill richiesta", "required": False},
            {"name": "shift_code", "type": "string", "label": "Solo turno (codice)", "required": False},
        ],
        "default_nature": "hard",
    },
    {
        "code": "capacita_massima", "family": "capacita",
        "name": "Capacità massima",
        "description": "Al massimo N persone per slot, opzionalmente solo per un codice turno (o aula).",
        "param_schema": [
            {"name": "max", "type": "int", "label": "Massimo persone", "required": True, "default": 5},
            {"name": "shift_code", "type": "string", "label": "Solo turno (codice)", "required": False},
        ],
        "default_nature": "hard",
    },
    {
        "code": "max_turni_periodo", "family": "capacita",
        "name": "Massimo turni nel periodo",
        "description": "Ogni persona non supera N turni totali nell'orizzonte di pianificazione.",
        "param_schema": [
            {"name": "max", "type": "int", "label": "Massimo turni", "required": True, "default": 20},
        ],
        "default_nature": "hard",
    },
    {
        "code": "max_giorni_consecutivi", "family": "sequenza",
        "name": "Massimo giorni consecutivi",
        "description": "Nessuno lavora più di N giorni di fila.",
        "param_schema": [
            {"name": "max", "type": "int", "label": "Massimo giorni", "required": True, "default": 5},
        ],
        "default_nature": "hard",
    },
    {
        "code": "riposo_minimo", "family": "sequenza",
        "name": "Riposo minimo tra turni",
        "description": "Tra la fine di un turno e l'inizio del successivo passano almeno N ore.",
        "param_schema": [
            {"name": "ore", "type": "int", "label": "Ore di riposo", "required": True, "default": 11},
        ],
        "default_nature": "hard",
    },
    {
        "code": "equita_distribuzione", "family": "equita",
        "name": "Equità di distribuzione",
        "description": "I turni di un certo tipo (es. notti) sono distribuiti in modo bilanciato: lo scarto tra chi ne fa di più e chi di meno non supera la tolleranza.",
        "param_schema": [
            {"name": "shift_code", "type": "string", "label": "Codice turno", "required": False},
            {"name": "tolleranza", "type": "int", "label": "Tolleranza", "required": True, "default": 1},
        ],
        "default_nature": "soft",
    },
    {
        "code": "indisponibilita", "family": "preferenze",
        "name": "Indisponibilità",
        "description": "Una persona non è disponibile in un giorno e/o per un turno.",
        "param_schema": [
            {"name": "resource_id", "type": "resource", "label": "Persona", "required": True},
            {"name": "day", "type": "date", "label": "Giorno", "required": False},
            {"name": "shift_code", "type": "string", "label": "Turno (codice)", "required": False},
        ],
        "default_nature": "hard",
    },
    {
        "code": "preferenza_assegnazione", "family": "preferenze",
        "name": "Preferenza di assegnazione",
        "description": "Una persona preferisce lavorare in un giorno e/o turno. Sensata come soft.",
        "param_schema": [
            {"name": "resource_id", "type": "resource", "label": "Persona", "required": True},
            {"name": "day", "type": "date", "label": "Giorno", "required": False},
            {"name": "shift_code", "type": "string", "label": "Turno (codice)", "required": False},
        ],
        "default_nature": "soft",
    },
    {
        "code": "copertura_esatta", "family": "copertura",
        "name": "Copertura esatta",
        "description": "Esattamente N persone per slot, né di più né di meno (opzionalmente con una skill o solo per un codice turno). Utile per postazioni a organico fisso: una cassa, un'ambulanza, una cattedra.",
        "param_schema": [
            {"name": "n", "type": "int", "label": "Persone richieste", "required": True, "default": 1},
            {"name": "skill", "type": "string", "label": "Skill richiesta", "required": False},
            {"name": "shift_code", "type": "string", "label": "Solo turno (codice)", "required": False},
        ],
        "default_nature": "hard",
    },
    {
        "code": "min_turni_periodo", "family": "capacita",
        "name": "Minimo turni nel periodo",
        "description": "Ogni persona lavora almeno N turni nell'orizzonte. Utile per garantire il monte ore contrattuale o non lasciare nessuno a zero.",
        "param_schema": [
            {"name": "min", "type": "int", "label": "Minimo turni", "required": True, "default": 1},
        ],
        "default_nature": "hard",
    },
    {
        "code": "max_turni_settimana", "family": "capacita",
        "name": "Massimo turni a settimana",
        "description": "Ogni persona non supera N turni in ciascuna settimana di calendario (lun–dom). Più fine del massimo sul periodo: evita settimane sovraccariche compensate da settimane vuote.",
        "param_schema": [
            {"name": "max", "type": "int", "label": "Massimo a settimana", "required": True, "default": 5},
        ],
        "default_nature": "hard",
    },
    {
        "code": "max_turni_tipo", "family": "capacita",
        "name": "Massimo turni di un tipo",
        "description": "Ogni persona non supera N turni di un certo codice nell'orizzonte (es. non più di 2 notti a testa).",
        "param_schema": [
            {"name": "max", "type": "int", "label": "Massimo turni", "required": True, "default": 2},
            {"name": "shift_code", "type": "string", "label": "Turno (codice)", "required": True},
        ],
        "default_nature": "hard",
    },
    {
        "code": "giorni_riposo_minimi", "family": "sequenza",
        "name": "Giorni di riposo minimi",
        "description": "Ogni persona ha almeno N giorni completamente liberi nell'orizzonte di pianificazione.",
        "param_schema": [
            {"name": "min", "type": "int", "label": "Giorni liberi minimi", "required": True, "default": 1},
        ],
        "default_nature": "hard",
    },
    {
        "code": "weekend_liberi", "family": "sequenza",
        "name": "Weekend liberi minimi",
        "description": "Ogni persona ha almeno N weekend (sabato e domenica) completamente liberi nell'orizzonte. Funziona solo se il periodo include giorni di weekend.",
        "param_schema": [
            {"name": "min", "type": "int", "label": "Weekend liberi minimi", "required": True, "default": 1},
        ],
        "default_nature": "soft",
    },
    {
        "code": "sequenza_vietata", "family": "sequenza",
        "name": "Sequenza vietata tra turni",
        "description": "Dopo un turno di un certo codice, il giorno seguente non si può fare un altro codice (es. dopo la notte, niente mattina).",
        "param_schema": [
            {"name": "dopo", "type": "string", "label": "Dopo il turno (codice)", "required": True,
             "help": "Il turno che viene prima, es. N"},
            {"name": "vietato", "type": "string", "label": "Vietato il giorno dopo (codice)", "required": True,
             "help": "Il turno proibito l'indomani, es. M"},
        ],
        "default_nature": "hard",
    },
    {
        "code": "max_consecutivi_tipo", "family": "sequenza",
        "name": "Massimo giorni consecutivi per tipo",
        "description": "Non più di N giorni di fila con un turno di un certo codice (es. massimo 3 notti consecutive).",
        "param_schema": [
            {"name": "max", "type": "int", "label": "Massimo giorni di fila", "required": True, "default": 3},
            {"name": "shift_code", "type": "string", "label": "Turno (codice)", "required": True},
        ],
        "default_nature": "hard",
    },
    {
        "code": "solo_turni_tipo", "family": "preferenze",
        "name": "Solo certi turni per una persona",
        "description": "Una persona può lavorare solo nei turni di un certo codice (es. part-time solo mattine, studente solo pomeriggi).",
        "param_schema": [
            {"name": "resource_id", "type": "resource", "label": "Persona", "required": True},
            {"name": "shift_code", "type": "string", "label": "Unico turno ammesso (codice)", "required": True},
        ],
        "default_nature": "hard",
    },
    {
        "code": "incompatibilita_persone", "family": "persone",
        "name": "Persone incompatibili",
        "description": "Due persone non lavorano mai nello stesso slot (es. conflitti, coppie da separare, stessa mansione critica).",
        "param_schema": [
            {"name": "resource_id", "type": "resource", "label": "Prima persona", "required": True},
            {"name": "resource_id_2", "type": "resource", "label": "Seconda persona", "required": True},
        ],
        "default_nature": "hard",
    },
    {
        "code": "affinita_persone", "family": "persone",
        "name": "Persone in coppia",
        "description": "Due persone lavorano sempre insieme, negli stessi slot (es. tutor e tirocinante, autista e soccorritore).",
        "param_schema": [
            {"name": "resource_id", "type": "resource", "label": "Prima persona", "required": True},
            {"name": "resource_id_2", "type": "resource", "label": "Seconda persona", "required": True},
        ],
        "default_nature": "hard",
    },
    {
        "code": "regola_personalizzata", "family": "custom",
        "name": "Regola su misura",
        "description": "Costruisci la tua regola: conta le assegnazioni per turno, persona, giorno, settimana o finestra mobile di K giorni, con filtri per codice turno, skill, persona specifica, giorni della settimana e intervallo di date. Es. \"ogni persona al massimo 2 notti a settimana\", \"max 1 turno nel weekend\", \"Carla max 3 turni ad agosto\".",
        "param_schema": [
            {"name": "per", "type": "select", "label": "Per ogni", "required": True, "default": "slot",
             "help": "Su quale insieme si applica il conteggio",
             "options": [
                 {"value": "slot", "label": "Turno (ogni slot)"},
                 {"value": "persona", "label": "Persona (tutto il periodo)"},
                 {"value": "persona_giorno", "label": "Persona, per ogni giorno"},
                 {"value": "persona_settimana", "label": "Persona, per ogni settimana"},
                 {"value": "finestra", "label": "Persona, per ogni finestra di K giorni"},
             ]},
            {"name": "vincolo", "type": "select", "label": "Il conteggio deve essere", "required": True, "default": "<=",
             "options": [
                 {"value": "<=", "label": "al massimo (\u2264)"},
                 {"value": ">=", "label": "almeno (\u2265)"},
                 {"value": "==", "label": "esattamente (=)"},
             ]},
            {"name": "valore", "type": "int", "label": "Valore", "required": True, "default": 1},
            {"name": "finestra_giorni", "type": "int", "label": "K (ampiezza finestra, giorni)", "required": False, "default": 7,
             "help": "Usato solo con l'ambito \"finestra di K giorni\""},
            {"name": "shift_code", "type": "string", "label": "Solo turni (codice)", "required": False,
             "help": "Vuoto = tutti i turni"},
            {"name": "skill", "type": "string", "label": "Solo persone con skill", "required": False,
             "help": "Vuoto = tutte le persone"},
            {"name": "resource_id", "type": "resource", "label": "Solo una persona", "required": False,
             "help": "Se impostata, la regola vale solo per lei"},
            {"name": "giorni", "type": "select", "label": "Solo in certi giorni", "required": False, "default": "",
             "options": [
                 {"value": "", "label": "Tutti i giorni"},
                 {"value": "feriali", "label": "Solo feriali (lun\u2013ven)"},
                 {"value": "weekend", "label": "Solo weekend (sab\u2013dom)"},
                 {"value": "0", "label": "Solo luned\u00ec"},
                 {"value": "1", "label": "Solo marted\u00ec"},
                 {"value": "2", "label": "Solo mercoled\u00ec"},
                 {"value": "3", "label": "Solo gioved\u00ec"},
                 {"value": "4", "label": "Solo venerd\u00ec"},
                 {"value": "5", "label": "Solo sabato"},
                 {"value": "6", "label": "Solo domenica"},
             ]},
            {"name": "dal", "type": "date", "label": "Dal giorno", "required": False},
            {"name": "al", "type": "date", "label": "Al giorno", "required": False},
        ],
        "default_nature": "hard",
    },
]
