"""
Esecuzione di una Run del solver, indipendente da come è stata innescata.

`execute_run(run)` costruisce il modello dai dati del dataset, lancia il
motore CP-SAT e salva l'esito. La chiamano due percorsi:

  * il worker `/tasks/solve/` quando la coda Cloud Tasks "solver" è attiva
    (Cloud Run): la solve, potenzialmente lunga, non occupa la richiesta
    utente né rischia il timeout del proxy;
  * direttamente la view `solve` in locale, dove la richiesta resta in
    attesa e torna la Run già completata (comportamento storico).
"""
import logging

from config.translations import tr
from solver.engine import solve
from solver.explain import explain

logger = logging.getLogger(__name__)


def _model_inputs(ds):
    """Trasforma il dataset in dati puri per il motore (nessun oggetto ORM
    oltre questa funzione)."""
    resources = [
        {"id": r.id, "name": r.name, "skills": r.skills}
        for r in ds.resources.all()
    ]
    slots = [
        {"id": s.id, "day": s.day.isoformat(), "code": s.code,
         "start": s.start.strftime("%H:%M") if s.start else "00:00",
         "end": s.end.strftime("%H:%M") if s.end else "00:00"}
        for s in ds.slots.all()
    ]
    constraints = [
        {"id": c.id, "type": c.template.code, "params": c.params,
         "nature": c.nature, "weight": c.weight,
         "label": c.display_label()}
        for c in ds.constraints.filter(enabled=True).select_related("template")
    ]
    return resources, slots, constraints


def execute_run(run):
    """Esegue il solver sulla Run e ne salva l'esito. Non solleva mai: gli
    errori del motore diventano stato ERROR sulla Run."""
    run.status = "RUNNING"
    run.save(update_fields=["status"])

    resources, slots, constraints = _model_inputs(run.dataset)
    try:
        result = solve(resources, slots, constraints, run.time_limit)
        run.status = result["status"]
        run.wall_time = result["wall_time"]
        run.objective = result["objective"]
        run.assignments = result["assignments"]
        run.violations = result["violations"]
        run.conflicts = result["conflicts"]
        run.explanation = explain(result, resources, slots, constraints)
    except Exception as exc:  # parametri malformati, tipo ignoto, ecc.
        logger.exception("solve fallito per dataset %s", run.dataset_id)
        run.status = "ERROR"
        run.error = str(exc)
        run.explanation = tr(
            "Il calcolo si è interrotto per un errore tecnico (vedi "
            "messaggio sotto), non per colpa delle regole.")
    run.save()
    return run


def run_solve_by_id(run_id):
    """Punto d'ingresso del worker: carica la Run e la esegue."""
    from .models import Run
    run = Run.objects.select_related("dataset").get(pk=run_id)
    return execute_run(run)
