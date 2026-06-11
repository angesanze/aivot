"""
Traduzioni del catalogo regole.

Il database conserva sempre la fonte italiana (vedi `data.py`): la
traduzione avviene al momento della serializzazione, sovrapponendo ai
testi originali quelli della tabella della lingua richiesta. Per
aggiungere una nuova lingua basta definire qui una nuova tabella (es.
`TEMPLATES_FR`) e registrarla in `_TABLES`; per le lingue senza tabella
si restituisce l'originale italiano.

Questo modulo non importa Django: deve restare utilizzabile anche da
script e test fuori dal contesto dell'applicazione.
"""

# Tabella inglese: una voce per ogni `code` del CATALOG.
# Struttura di ogni voce:
#   name / description : testi del template
#   params  : per nome parametro -> {"label": ..., "help": ...}
#             ("help" presente solo se la fonte lo prevede)
#   options : solo per i parametri di tipo "select",
#             per nome parametro -> {valore opzione: etichetta}
TEMPLATES_EN = {
    "un_turno_al_giorno": {
        "name": "One shift per day",
        "description": "Each person covers at most one shift per day.",
        "params": {},
        "options": {},
    },
    "copertura_minima": {
        "name": "Minimum coverage",
        "description": (
            "At least N people (optionally with a skill) for every "
            "slot, optionally only for a given shift code."
        ),
        "params": {
            "min": {"label": "Minimum people"},
            "skill": {"label": "Required skill"},
            "shift_code": {"label": "Only shift (code)"},
        },
        "options": {},
    },
    "capacita_massima": {
        "name": "Maximum capacity",
        "description": (
            "At most N people per slot, optionally only for a given "
            "shift code (or room)."
        ),
        "params": {
            "max": {"label": "Maximum people"},
            "shift_code": {"label": "Only shift (code)"},
        },
        "options": {},
    },
    "max_turni_periodo": {
        "name": "Maximum shifts in the period",
        "description": (
            "No person exceeds N total shifts over the planning "
            "horizon."
        ),
        "params": {
            "max": {"label": "Maximum shifts"},
        },
        "options": {},
    },
    "max_giorni_consecutivi": {
        "name": "Maximum consecutive days",
        "description": "Nobody works more than N days in a row.",
        "params": {
            "max": {"label": "Maximum days"},
        },
        "options": {},
    },
    "riposo_minimo": {
        "name": "Minimum rest between shifts",
        "description": (
            "At least N hours pass between the end of one shift and "
            "the start of the next."
        ),
        "params": {
            "ore": {"label": "Rest hours"},
        },
        "options": {},
    },
    "equita_distribuzione": {
        "name": "Fair distribution",
        "description": (
            "Shifts of a given type (e.g. nights) are distributed "
            "evenly: the gap between whoever works the most and the "
            "least does not exceed the tolerance."
        ),
        "params": {
            "shift_code": {"label": "Shift code"},
            "tolleranza": {"label": "Tolerance"},
        },
        "options": {},
    },
    "indisponibilita": {
        "name": "Unavailability",
        "description": (
            "A person is not available on a day and/or for a shift."
        ),
        "params": {
            "resource_id": {"label": "Person"},
            "day": {"label": "Day"},
            "shift_code": {"label": "Shift (code)"},
        },
        "options": {},
    },
    "preferenza_assegnazione": {
        "name": "Assignment preference",
        "description": (
            "A person prefers to work on a day and/or shift. Makes "
            "sense as a soft rule."
        ),
        "params": {
            "resource_id": {"label": "Person"},
            "day": {"label": "Day"},
            "shift_code": {"label": "Shift (code)"},
        },
        "options": {},
    },
    "copertura_esatta": {
        "name": "Exact coverage",
        "description": (
            "Exactly N people per slot, no more and no fewer "
            "(optionally with a skill or only for a given shift "
            "code). Useful for fixed-staffing posts: a checkout "
            "counter, an ambulance, a teaching post."
        ),
        "params": {
            "n": {"label": "People required"},
            "skill": {"label": "Required skill"},
            "shift_code": {"label": "Only shift (code)"},
        },
        "options": {},
    },
    "min_turni_periodo": {
        "name": "Minimum shifts in the period",
        "description": (
            "Each person works at least N shifts over the horizon. "
            "Useful to guarantee contractual hours or to leave "
            "nobody at zero."
        ),
        "params": {
            "min": {"label": "Minimum shifts"},
        },
        "options": {},
    },
    "max_turni_settimana": {
        "name": "Maximum shifts per week",
        "description": (
            "No person exceeds N shifts in any calendar week "
            "(Mon-Sun). Finer-grained than the period maximum: it "
            "prevents overloaded weeks offset by empty ones."
        ),
        "params": {
            "max": {"label": "Maximum per week"},
        },
        "options": {},
    },
    "max_turni_tipo": {
        "name": "Maximum shifts of one type",
        "description": (
            "No person exceeds N shifts of a given code over the "
            "horizon (e.g. no more than 2 nights each)."
        ),
        "params": {
            "max": {"label": "Maximum shifts"},
            "shift_code": {"label": "Shift (code)"},
        },
        "options": {},
    },
    "giorni_riposo_minimi": {
        "name": "Minimum rest days",
        "description": (
            "Each person has at least N completely free days over "
            "the planning horizon."
        ),
        "params": {
            "min": {"label": "Minimum free days"},
        },
        "options": {},
    },
    "weekend_liberi": {
        "name": "Minimum free weekends",
        "description": (
            "Each person has at least N weekends (Saturday and "
            "Sunday) completely free over the horizon. Only works "
            "if the period includes weekend days."
        ),
        "params": {
            "min": {"label": "Minimum free weekends"},
        },
        "options": {},
    },
    "sequenza_vietata": {
        "name": "Forbidden shift sequence",
        "description": (
            "After a shift of a given code, a certain other code "
            "cannot be worked the following day (e.g. no morning "
            "after a night)."
        ),
        "params": {
            "dopo": {
                "label": "After shift (code)",
                "help": "The shift that comes first, e.g. N",
            },
            "vietato": {
                "label": "Forbidden the next day (code)",
                "help": "The shift forbidden the day after, e.g. M",
            },
        },
        "options": {},
    },
    "max_consecutivi_tipo": {
        "name": "Maximum consecutive days per type",
        "description": (
            "No more than N days in a row with a shift of a given "
            "code (e.g. at most 3 consecutive nights)."
        ),
        "params": {
            "max": {"label": "Maximum days in a row"},
            "shift_code": {"label": "Shift (code)"},
        },
        "options": {},
    },
    "solo_turni_tipo": {
        "name": "Only certain shifts for a person",
        "description": (
            "A person can only work shifts of a given code (e.g. "
            "part-timer mornings only, student afternoons only)."
        ),
        "params": {
            "resource_id": {"label": "Person"},
            "shift_code": {"label": "Only allowed shift (code)"},
        },
        "options": {},
    },
    "incompatibilita_persone": {
        "name": "Incompatible people",
        "description": (
            "Two people never work in the same slot (e.g. "
            "conflicts, pairs to keep apart, same critical duty)."
        ),
        "params": {
            "resource_id": {"label": "First person"},
            "resource_id_2": {"label": "Second person"},
        },
        "options": {},
    },
    "affinita_persone": {
        "name": "Paired people",
        "description": (
            "Two people always work together, in the same slots "
            "(e.g. tutor and trainee, driver and paramedic)."
        ),
        "params": {
            "resource_id": {"label": "First person"},
            "resource_id_2": {"label": "Second person"},
        },
        "options": {},
    },
    "regola_personalizzata": {
        "name": "Custom rule",
        "description": (
            "Build your own rule: count assignments per shift, "
            "person, day, week or sliding window of K days, with "
            "filters by shift code, skill, specific person, days of "
            "the week and date range. E.g. \"each person at most 2 "
            "nights per week\", \"max 1 shift on weekends\", "
            "\"Carla max 3 shifts in August\"."
        ),
        "params": {
            "per": {
                "label": "For each",
                "help": "The set the count is applied to",
            },
            "vincolo": {"label": "The count must be"},
            "valore": {"label": "Value"},
            "finestra_giorni": {
                "label": "K (window width, days)",
                "help": (
                    "Only used with the \"window of K days\" scope"
                ),
            },
            "shift_code": {
                "label": "Only shifts (code)",
                "help": "Empty = all shifts",
            },
            "skill": {
                "label": "Only people with skill",
                "help": "Empty = all people",
            },
            "resource_id": {
                "label": "Only one person",
                "help": (
                    "If set, the rule applies to that person only"
                ),
            },
            "giorni": {"label": "Only on certain days"},
            "dal": {"label": "From day"},
            "al": {"label": "To day"},
        },
        "options": {
            "per": {
                "slot": "Shift (each slot)",
                "persona": "Person (whole period)",
                "persona_giorno": "Person, for each day",
                "persona_settimana": "Person, for each week",
                "finestra": "Person, for each window of K days",
            },
            "vincolo": {
                "<=": "at most (≤)",
                ">=": "at least (≥)",
                "==": "exactly (=)",
            },
            "giorni": {
                "": "Every day",
                "feriali": "Weekdays only (Mon–Fri)",
                "weekend": "Weekends only (Sat–Sun)",
                "0": "Mondays only",
                "1": "Tuesdays only",
                "2": "Wednesdays only",
                "3": "Thursdays only",
                "4": "Fridays only",
                "5": "Saturdays only",
                "6": "Sundays only",
            },
        },
    },
}

# Registro delle lingue disponibili: prefisso a due lettere -> tabella.
_TABLES = {
    "en": TEMPLATES_EN,
}


def translate_template(data, lang):
    """Ritorna il dict serializzato del template tradotto nella lingua
    richiesta; per lingue senza tabella restituisce l'originale."""
    lang = (lang or "")[:2].lower()
    table = _TABLES.get(lang)
    if table is None:
        return data

    tr = table.get(data.get("code"))
    if tr is None:
        return data

    # Copia superficiale del template + copia profonda dello schema
    # parametri: l'input non viene mai mutato.
    out = dict(data)
    if tr.get("name"):
        out["name"] = tr["name"]
    if tr.get("description"):
        out["description"] = tr["description"]

    params_tr = tr.get("params", {})
    options_tr = tr.get("options", {})
    schema = []
    for param in data.get("param_schema") or []:
        param = dict(param)
        p_tr = params_tr.get(param.get("name"), {})
        if p_tr.get("label"):
            param["label"] = p_tr["label"]
        if p_tr.get("help") and "help" in param:
            param["help"] = p_tr["help"]
        # Per i parametri "select" traduciamo le etichette delle
        # opzioni, abbinandole per valore.
        o_tr = options_tr.get(param.get("name"), {})
        if param.get("options"):
            options = []
            for opt in param["options"]:
                opt = dict(opt)
                label = o_tr.get(opt.get("value"))
                if label:
                    opt["label"] = label
                options.append(opt)
            param["options"] = options
        schema.append(param)
    if "param_schema" in data:
        out["param_schema"] = schema
    return out


def translate_template_name(code, default, lang):
    """Solo il nome del template, per i serializer che lo denormalizzano
    (es. la lista dei vincoli attivi di un progetto)."""
    lang = (lang or "")[:2].lower()
    return (_TABLES.get(lang, {}).get(code, {}) or {}).get("name", default)
