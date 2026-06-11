"""
Traduzioni dei testi rivolti all'utente generati dal backend (errori API,
spiegazioni del solver, email).

La sorgente nel codice è l'italiano; qui vive la tabella per le altre
lingue, indicizzata sul testo sorgente. La lingua attiva arriva dal
LocaleMiddleware (header Accept-Language inviato dal frontend).

Aggiungere una lingua = aggiungere una tabella e registrarla in _TABLES.
Il catalogo regole ha la sua tabella in catalog/translations.py.
"""
from django.utils.functional import lazy

try:
    from django.utils.translation import get_language
except Exception:  # uso standalone (test del solver senza Django attivo)
    def get_language():
        return "it"

EN = {
    # --- accounts: registrazione e profilo ---------------------------
    "Inserisci nome e cognome.": "Enter your first and last name.",
    "Scegli un nome utente.": "Choose a username.",
    "L'email è obbligatoria.": "Email is required.",
    "Questa email non sembra valida.": "This email doesn't look valid.",
    "La password deve avere almeno 8 caratteri.":
        "The password must be at least 8 characters long.",
    "Nome utente già in uso: scegline un altro.":
        "Username already taken: choose another one.",
    "Email già registrata: prova ad accedere.":
        "Email already registered: try signing in.",
    "Dati non validi.": "Invalid data.",
    "Nome utente o password sbagliati.": "Wrong username or password.",
    "Se l'email è registrata, riceverai a breve il link per reimpostare "
    "la password.":
        "If the email is registered, you'll shortly receive a link to "
        "reset your password.",
    "Link di reset non valido.": "Invalid reset link.",
    "Link di reset scaduto o già usato: richiedine un altro.":
        "Reset link expired or already used: request a new one.",
    "Accesso Google non configurato su questo server.":
        "Google sign-in is not configured on this server.",
    "Google non raggiungibile: riprova tra poco.":
        "Google is unreachable: try again shortly.",
    "Accesso Google non riuscito: riprova.":
        "Google sign-in failed: please try again.",
    "La tua email Google non risulta verificata.":
        "Your Google email is not verified.",
    "Email già usata da un altro account.":
        "Email already used by another account.",
    "La password attuale non è corretta.":
        "The current password is incorrect.",
    "La nuova password deve avere almeno 8 caratteri.":
        "The new password must be at least 8 characters long.",
    "Password aggiornata.": "Password updated.",

    # --- scheduling: progetti, import, widget ------------------------
    "Progetto non trovato.": "Project not found.",
    "Questo progetto non è tuo.": "This project is not yours.",
    "Nessun file caricato.": "No file uploaded.",
    "dataset richiesto": "dataset required",
    "Widget non trovato o revocato.": "Widget not found or revoked.",
    "Pianificazione #{id}": "Schedule #{id}",
    "File troppo grande (massimo 2 MB).": "File too large (2 MB max).",
    "File Excel non leggibile: salvalo come .xlsx e riprova.":
        "Unreadable Excel file: save it as .xlsx and try again.",
    "Il vecchio formato .xls non è supportato: salva il file come .xlsx.":
        "The legacy .xls format is not supported: save the file as .xlsx.",
    "Formato non riconosciuto: carica un file .xlsx o .csv.":
        "Unrecognised format: upload an .xlsx or .csv file.",
    "Troppe righe (massimo {n}).": "Too many rows ({n} max).",
    "Nessuna persona trovata nel file: serve il nome nella prima colonna.":
        "No people found in the file: the name must be in the first column.",

    # --- store ---------------------------------------------------------
    "Dai un titolo alla ricetta.": "Give the recipe a title.",
    "Il progetto non ha regole pubblicabili: quelle legate a persone "
    "specifiche non si possono condividere.":
        "The project has no publishable rules: rules tied to specific "
        "people cannot be shared.",
    "Puoi eliminare solo le tue ricette.":
        "You can only delete your own recipes.",

    # --- explain: spiegazione degli esiti ------------------------------
    "Il calcolo è riuscito, ma la griglia vuota è una soluzione valida: "
    "nessuna regola attiva obbliga ad assegnare qualcuno. Regole come "
    "«capacità massima» o «un turno al giorno» mettono solo un tetto, "
    "non un minimo, quindi con {n_res} persone e {n_slots} turni il "
    "motore può lasciare tutto scoperto senza violare nulla. Aggiungi "
    "una regola «copertura minima» (es. almeno 1 persona per turno) per "
    "riempire la griglia.":
        "The computation succeeded, but the empty grid is a valid "
        "solution: no active rule requires assigning anyone. Rules like "
        "“maximum capacity” or “one shift per day” "
        "only set a ceiling, not a minimum, so with {n_res} people and "
        "{n_slots} shifts the engine can leave everything uncovered "
        "without violating anything. Add a “minimum coverage” "
        "rule (e.g. at least 1 person per shift) to fill the grid.",
    "Le regole che chiedono di assegnare persone ({labels}) sono "
    "preferenze, non obblighi: il motore le ha sacrificate perché "
    "incompatibili con gli obblighi attivi. Rendile obbligatorie per "
    "scoprire quali obblighi le bloccano, oppure allenta gli obblighi "
    "(indisponibilità, capacità, riposi).":
        "The rules that ask to assign people ({labels}) are preferences, "
        "not requirements: the engine sacrificed them because they are "
        "incompatible with the active requirements. Make them mandatory "
        "to discover which requirements block them, or relax the "
        "requirements (unavailability, capacity, rest).",
    "Il calcolo è riuscito ma nessuno è stato assegnato. Controlla che "
    "le regole di copertura abbiano un minimo maggiore di zero e che i "
    "filtri (competenza, codice turno) corrispondano davvero alle "
    "persone e ai turni inseriti: un filtro che non trova nessuno rende "
    "la regola senza effetto.":
        "The computation succeeded but nobody was assigned. Check that "
        "the coverage rules have a minimum greater than zero and that "
        "the filters (skill, shift code) actually match the people and "
        "shifts you entered: a filter that matches nobody makes the rule "
        "ineffective.",
    "Assegnati {n} turni: {p} persone su {tot_p} coprono {c} turni su "
    "{tot_s}.":
        "{n} shifts assigned: {p} of {tot_p} people cover {c} of "
        "{tot_s} shifts.",
    " Per riuscirci sono state sacrificate {v} preferenze (penalità "
    "totale {cost}): non esisteva un piano che rispettasse anche quelle "
    "senza violare un obbligo.":
        " To get there, {v} preferences were sacrificed (total penalty "
        "{cost}): no plan could honour them too without violating a "
        "requirement.",
    " Tutti gli obblighi e tutte le preferenze sono rispettati.":
        " All requirements and all preferences are satisfied.",
    " I turni rimasti scoperti non hanno una regola di copertura che ne "
    "richieda l'assegnazione.":
        " The shifts left uncovered have no coverage rule requiring them "
        "to be assigned.",
    "Nessuna combinazione di {n_res} persone su {n_slots} turni rispetta "
    "tutti gli obblighi insieme.":
        "No combination of {n_res} people across {n_slots} shifts "
        "satisfies all the requirements together.",
    " Il motore ha individuato il gruppo minimo di obblighi in conflitto "
    "(elencati sotto): basta allentarne o trasformarne in preferenza uno "
    "qualsiasi per sbloccare il calcolo.":
        " The engine identified the minimal group of conflicting "
        "requirements (listed below): relaxing any one of them, or "
        "turning it into a preference, unblocks the computation.",
    " Prova a trasformare qualche obbligo in preferenza o ad aggiungere "
    "persone o turni.":
        " Try turning some requirements into preferences, or add people "
        "or shifts.",
    " Nota: le coperture minime richiedono almeno {demand} presenze "
    "totali, ma {n_res} persone con al massimo un turno al giorno ne "
    "offrono {offer} in {days} giorni.":
        " Note: the minimum coverages require at least {demand} total "
        "attendances, but {n_res} people with at most one shift per day "
        "can offer {offer} over {days} days.",
    "Il calcolo si è interrotto per un errore tecnico (vedi messaggio "
    "sotto), non per colpa delle regole.":
        "The computation stopped due to a technical error (see the "
        "message below), not because of your rules.",
    "Il tempo limite è scaduto prima che il motore trovasse una "
    "soluzione o dimostrasse che non esiste. Aumenta il tempo massimo e "
    "riprova.":
        "The time limit expired before the engine could find a solution "
        "or prove that none exists. Increase the time limit and retry.",

    # --- email ----------------------------------------------------------
    "Benvenuto su AIVOT 🎉": "Welcome to AIVOT 🎉",
    "Benvenuto su AIVOT, {name}!": "Welcome to AIVOT, {name}!",
    "Il tuo account è pronto. Da oggi hai un'area personale dove "
    "progetti, regole e pianificazioni restano tuoi: il motore fa i "
    "conti, tu decidi i vincoli.":
        "Your account is ready. From today you have a personal area "
        "where projects, rules and schedules stay yours: the engine does "
        "the math, you set the constraints.",
    "Il tuo nome utente è": "Your username is",
    "La password è quella che hai scelto alla registrazione: se la "
    "dimentichi, usa \"Password dimenticata?\" nella pagina di accesso.":
        "Your password is the one you chose at sign-up: if you forget "
        "it, use \"Forgot your password?\" on the sign-in page.",
    "Entra in AIVOT": "Enter AIVOT",
    "Ogni vincolo, una soluzione.": "Every constraint, a solution.",
    "AIVOT — reimposta la password": "AIVOT — reset your password",
    "Reimposta la tua password": "Reset your password",
    "Ciao {name}, abbiamo ricevuto una richiesta di reset per il tuo "
    "account {username}. Se non sei stato tu, ignora questa email: la "
    "tua password resta quella attuale.":
        "Hi {name}, we received a reset request for your account "
        "{username}. If it wasn't you, ignore this email: your password "
        "stays unchanged.",
    "Scegli una nuova password": "Choose a new password",
    "Il link vale per un solo utilizzo e scade automaticamente.":
        "The link works only once and expires automatically.",
}

_TABLES = {"en": EN}


def tr(text, **vars):
    """Traduce un testo sorgente (italiano) nella lingua attiva della
    richiesta, con interpolazione `{var}`. Lingua ignota -> italiano."""
    lang = (get_language() or "it").split("-")[0].lower()
    out = _TABLES.get(lang, {}).get(text, text)
    return out.format(**vars) if vars else out


# Variante pigra per i punti valutati a import time (es. error_messages
# dei serializer): la lingua si risolve solo quando il testo serve.
tr_lazy = lazy(tr, str)
