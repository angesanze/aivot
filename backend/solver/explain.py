"""
Spiegazione in linguaggio naturale dell'esito di una run.

Riceve gli stessi dati puri del motore (resources, slots, constraints)
più il risultato di solve(); restituisce un testo che motiva l'esito,
in particolare i risultati vuoti che altrimenti sembrano errori.

Il testo viene generato nella lingua attiva della richiesta (tr):
la spiegazione salvata sulla Run è quindi nella lingua di chi ha
lanciato il calcolo.
"""
from config.translations import tr

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
        return tr("Il tempo limite è scaduto prima che il motore trovasse "
                  "una soluzione o dimostrasse che non esiste. Aumenta il "
                  "tempo massimo e riprova.")
    return ""


def _explain_empty(result, resources, slots, constraints):
    n_res, n_slots = len(resources), len(slots)
    requiring = [c for c in constraints if constraint_requires_assignment(c)]

    if not requiring:
        return tr(
            "Il calcolo è riuscito, ma la griglia vuota è una soluzione "
            "valida: nessuna regola attiva obbliga ad assegnare qualcuno. "
            "Regole come «capacità massima» o «un turno al giorno» mettono "
            "solo un tetto, non un minimo, quindi con {n_res} persone e "
            "{n_slots} turni il motore può lasciare tutto scoperto senza "
            "violare nulla. Aggiungi una regola «copertura minima» (es. "
            "almeno 1 persona per turno) per riempire la griglia.",
            n_res=n_res, n_slots=n_slots)

    violated = {v["constraint"] for v in result["violations"]}
    soft_sacrificed = [c for c in requiring
                       if c.get("nature") == "soft"
                       and c.get("label") in violated]
    if soft_sacrificed:
        labels = ", ".join(f"«{c['label']}»" for c in soft_sacrificed)
        return tr(
            "Le regole che chiedono di assegnare persone ({labels}) sono "
            "preferenze, non obblighi: il motore le ha sacrificate perché "
            "incompatibili con gli obblighi attivi. Rendile obbligatorie "
            "per scoprire quali obblighi le bloccano, oppure allenta gli "
            "obblighi (indisponibilità, capacità, riposi).", labels=labels)

    return tr(
        "Il calcolo è riuscito ma nessuno è stato assegnato. Controlla che "
        "le regole di copertura abbiano un minimo maggiore di zero e che i "
        "filtri (competenza, codice turno) corrispondano davvero alle "
        "persone e ai turni inseriti: un filtro che non trova nessuno "
        "rende la regola senza effetto.")


def _explain_filled(result, resources, slots):
    assigned_res = {a["resource_id"] for a in result["assignments"]}
    covered = {a["slot_id"] for a in result["assignments"]}
    n_res, n_slots = len(resources), len(slots)
    text = tr("Assegnati {n} turni: {p} persone su {tot_p} coprono {c} "
              "turni su {tot_s}.",
              n=len(result["assignments"]), p=len(assigned_res),
              tot_p=n_res, c=len(covered), tot_s=n_slots)
    if result["violations"]:
        cost = sum(v["cost"] for v in result["violations"])
        text += tr(" Per riuscirci sono state sacrificate {v} preferenze "
                   "(penalità totale {cost}): non esisteva un piano che "
                   "rispettasse anche quelle senza violare un obbligo.",
                   v=len(result["violations"]), cost=cost)
    else:
        text += tr(" Tutti gli obblighi e tutte le preferenze sono "
                   "rispettati.")
    if n_slots > len(covered) and not result["violations"]:
        text += tr(" I turni rimasti scoperti non hanno una regola di "
                   "copertura che ne richieda l'assegnazione.")
    return text


def _explain_infeasible(result, resources, slots, constraints):
    n_res, n_slots = len(resources), len(slots)
    text = tr("Nessuna combinazione di {n_res} persone su {n_slots} turni "
              "rispetta tutti gli obblighi insieme.",
              n_res=n_res, n_slots=n_slots)
    if result["conflicts"]:
        text += tr(" Il motore ha individuato il gruppo minimo di obblighi "
                   "in conflitto (elencati sotto): basta allentarne o "
                   "trasformarne in preferenza uno qualsiasi per sbloccare "
                   "il calcolo.")
    else:
        text += tr(" Prova a trasformare qualche obbligo in preferenza o "
                   "ad aggiungere persone o turni.")
    one_per_day = any(c["type"] == "un_turno_al_giorno"
                      and c.get("nature") == "hard" for c in constraints)
    demand = _min_coverage_demand(constraints, slots)
    days = len({s["day"] for s in slots})
    if one_per_day and demand and demand > n_res * days:
        text += tr(" Nota: le coperture minime richiedono almeno {demand} "
                   "presenze totali, ma {n_res} persone con al massimo un "
                   "turno al giorno ne offrono {offer} in {days} giorni.",
                   demand=demand, n_res=n_res, offer=n_res * days,
                   days=days)
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
