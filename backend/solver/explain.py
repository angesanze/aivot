"""
Spiegazione in linguaggio naturale dell'esito di una run.

Riceve gli stessi dati puri del motore (resources, slots, constraints)
più il risultato di solve(); restituisce un testo che motiva l'esito,
in particolare i risultati vuoti che altrimenti sembrano errori.

Nessuna dipendenza da Django né da OR-Tools: testabile standalone.
"""

# La conoscenza di quali vincoli "spingono" ad assegnare vive sul
# registry degli handler: qui si interroga, non si duplica.
from .handlers import constraint_requires_assignment


def explain(result, resources, slots, constraints):
    status = result["status"]
    if status in ("OPTIMAL", "FEASIBLE"):
        if not result["assignments"]:
            return _explain_empty(result, resources, slots, constraints)
        return _explain_filled(result, resources, slots)
    if status == "INFEASIBLE":
        return _explain_infeasible(result, resources, slots, constraints)
    if status == "UNKNOWN":
        return ("Il tempo limite è scaduto prima che il motore trovasse "
                "una soluzione o dimostrasse che non esiste. "
                "Aumenta il tempo massimo e riprova.")
    return ""


def _explain_empty(result, resources, slots, constraints):
    n_res, n_slots = len(resources), len(slots)
    requiring = [c for c in constraints if constraint_requires_assignment(c)]

    if not requiring:
        return (
            f"Il calcolo è riuscito, ma la griglia vuota è una soluzione "
            f"valida: nessuna regola attiva obbliga ad assegnare qualcuno. "
            f"Regole come «capacità massima» o «un turno al giorno» mettono "
            f"solo un tetto, non un minimo, quindi con {n_res} persone e "
            f"{n_slots} turni il motore può lasciare tutto scoperto senza "
            f"violare nulla. Aggiungi una regola «copertura minima» "
            f"(es. almeno 1 persona per turno) per riempire la griglia."
        )

    violated = {v["constraint"] for v in result["violations"]}
    soft_sacrificed = [c for c in requiring
                       if c.get("nature") == "soft"
                       and c.get("label") in violated]
    if soft_sacrificed:
        labels = ", ".join(f"«{c['label']}»" for c in soft_sacrificed)
        return (
            f"Le regole che chiedono di assegnare persone ({labels}) sono "
            f"preferenze, non obblighi: il motore le ha sacrificate perché "
            f"incompatibili con gli obblighi attivi. Rendile obbligatorie "
            f"per scoprire quali obblighi le bloccano, oppure allenta "
            f"gli obblighi (indisponibilità, capacità, riposi)."
        )

    return (
        "Il calcolo è riuscito ma nessuno è stato assegnato. Controlla che "
        "le regole di copertura abbiano un minimo maggiore di zero e che i "
        "filtri (competenza, codice turno) corrispondano davvero alle "
        "persone e ai turni inseriti: un filtro che non trova nessuno "
        "rende la regola senza effetto."
    )


def _explain_filled(result, resources, slots):
    assigned_res = {a["resource_id"] for a in result["assignments"]}
    covered = {a["slot_id"] for a in result["assignments"]}
    n_res, n_slots = len(resources), len(slots)
    text = (f"Assegnati {len(result['assignments'])} turni: "
            f"{len(assigned_res)} persone su {n_res} coprono "
            f"{len(covered)} turni su {n_slots}.")
    if result["violations"]:
        cost = sum(v["cost"] for v in result["violations"])
        text += (f" Per riuscirci sono state sacrificate "
                 f"{len(result['violations'])} preferenze "
                 f"(penalità totale {cost}): non esisteva un piano che "
                 f"rispettasse anche quelle senza violare un obbligo.")
    else:
        text += " Tutti gli obblighi e tutte le preferenze sono rispettati."
    if n_slots > len(covered) and not result["violations"]:
        text += (" I turni rimasti scoperti non hanno una regola di "
                 "copertura che ne richieda l'assegnazione.")
    return text


def _explain_infeasible(result, resources, slots, constraints):
    n_res, n_slots = len(resources), len(slots)
    text = (f"Nessuna combinazione di {n_res} persone su {n_slots} turni "
            f"rispetta tutti gli obblighi insieme.")
    if result["conflicts"]:
        text += (" Il motore ha individuato il gruppo minimo di obblighi "
                 "in conflitto (elencati sotto): basta allentarne o "
                 "trasformarne in preferenza uno qualsiasi per sbloccare "
                 "il calcolo.")
    else:
        text += (" Prova a trasformare qualche obbligo in preferenza o ad "
                 "aggiungere persone o turni.")
    one_per_day = any(c["type"] == "un_turno_al_giorno"
                      and c.get("nature") == "hard" for c in constraints)
    demand = _min_coverage_demand(constraints, slots)
    if one_per_day and demand and demand > n_res * len({s["day"] for s in slots}):
        days = len({s["day"] for s in slots})
        text += (f" Nota: le coperture minime richiedono almeno {demand} "
                 f"presenze totali, ma {n_res} persone con al massimo un "
                 f"turno al giorno ne offrono {n_res * days} in {days} "
                 f"giorni.")
    return text


def _min_coverage_demand(constraints, slots):
    """Presenze totali richieste dalle coperture (minime o esatte) hard."""
    total = 0
    for c in constraints:
        if c["type"] not in ("copertura_minima", "copertura_esatta") \
                or c.get("nature") != "hard":
            continue
        params = c.get("params", {})
        code = params.get("shift_code")
        n = sum(1 for s in slots if not code or s.get("code") == code)
        total += int(params.get("min") or params.get("n") or 0) * n
    return total
