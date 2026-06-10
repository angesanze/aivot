"""
Motore unico CP-SAT.

Riceve dati puri (dict/list), costruisce il modello a runtime leggendo
i vincoli configurati, risolve e restituisce assegnazioni + diagnostica.

Nessuna dipendenza da Django: testabile standalone.

Input:
  resources:   [{"id": 1, "name": "Anna", "skills": ["infermiere"]}]
  slots:       [{"id": 10, "day": "2026-06-01", "code": "M",
                 "start": "06:00", "end": "14:00"}]
  constraints: [{"id": 5, "type": "copertura_minima",
                 "params": {...}, "nature": "hard", "weight": 10}]

Output:
  {"status": "OPTIMAL|FEASIBLE|INFEASIBLE|...",
   "assignments": [{"resource_id":.., "slot_id":..}],
   "objective": float, "violations": [...], "conflicts": [...],
   "wall_time": float}
"""

from datetime import datetime, timedelta
from ortools.sat.python import cp_model

from .handlers import HANDLERS


class SolverContext:
    """Stato condiviso tra gli handler dei vincoli."""

    def __init__(self, model, resources, slots, use_assumptions=False):
        self.model = model
        self.use_assumptions = use_assumptions
        self.resources = resources
        self.slots = slots
        self.r_ids = [r["id"] for r in resources]
        self.s_ids = [s["id"] for s in slots]
        self.r_by_id = {r["id"]: r for r in resources}
        self.s_by_id = {s["id"]: s for s in slots}

        # Variabili di decisione binarie x[risorsa, slot]
        self.x = {
            (r, s): model.NewBoolVar(f"x_r{r}_s{s}")
            for r in self.r_ids
            for s in self.s_ids
        }

        # Slot raggruppati per giorno (per vincoli di sequenza)
        self.days = sorted({s["day"] for s in slots})
        self.slots_by_day = {d: [s for s in slots if s["day"] == d] for d in self.days}

        # Termini di penalità (vincoli soft) e assunzioni (vincoli hard)
        self.penalties = []          # [(var_intera, peso, etichetta)]
        self.assumptions = {}        # literal -> etichetta vincolo hard

    # ---- utilità per gli handler -------------------------------------

    def slot_datetimes(self, slot):
        """(inizio, fine) come datetime; gestisce i turni a cavallo di mezzanotte."""
        day = datetime.strptime(slot["day"], "%Y-%m-%d")
        start = datetime.strptime(slot.get("start", "00:00"), "%H:%M")
        end = datetime.strptime(slot.get("end", "00:00"), "%H:%M")
        s_dt = day.replace(hour=start.hour, minute=start.minute)
        e_dt = day.replace(hour=end.hour, minute=end.minute)
        if e_dt <= s_dt:
            e_dt += timedelta(days=1)
        return s_dt, e_dt

    def eligible_resources(self, skill=None):
        if not skill:
            return self.r_ids
        return [r["id"] for r in self.resources if skill in r.get("skills", [])]

    def matching_slots(self, shift_code=None, day=None):
        out = self.s_ids
        if shift_code:
            out = [s for s in out if self.s_by_id[s].get("code") == shift_code]
        if day:
            out = [s for s in out if self.s_by_id[s]["day"] == day]
        return out

    def add_hard(self, linear_expr_fn, label):
        """Registra un vincolo hard.

        Con use_assumptions=True ogni vincolo finisce sotto un literal di
        assunzione: in caso di infeasibility il solver indica QUALI vincoli
        sono in conflitto. Le assunzioni però azzoppano il presolve (modelli
        banali possono non chiudersi nel tempo limite), quindi la prima
        risoluzione avviene senza e questa modalità si usa solo nella
        seconda passata diagnostica.
        """
        lit = self.model.NewBoolVar(f"assum_{len(self.assumptions)}")
        linear_expr_fn(lit)  # la fn aggiunge i vincoli con OnlyEnforceIf(lit)
        if self.use_assumptions:
            self.assumptions[lit.Index()] = label
            self.model.AddAssumption(lit)
        else:
            self.model.Add(lit == 1)  # literal fisso: il presolve lo elimina

    def add_penalty(self, int_var, weight, label):
        self.penalties.append((int_var, weight, label))

    def limit(self, expr, nature, weight, label, *,
              le=None, ge=None, eq=None, slack=1, name=""):
        """Vincola un'espressione lineare, hard o soft, in un punto solo.

        È l'unico ponte tra gli handler e il modello: ogni regola si
        riduce a "questa espressione deve stare sotto/sopra/su un valore".

        - hard: il vincolo è obbligatorio (registrato via add_hard, così
          la seconda passata diagnostica sa attribuirgli i conflitti).
        - soft: si crea una variabile di scarto in [0, slack] che misura
          la violazione e finisce nell'obiettivo con il peso dato.

        `slack` dimensiona lo scarto massimo possibile; `name` distingue
        le variabili generate dallo stesso vincolo su elementi diversi.
        """
        if nature == "hard":
            def _add(lit, e=expr):
                if le is not None:
                    self.model.Add(e <= le).OnlyEnforceIf(lit)
                if ge is not None:
                    self.model.Add(e >= ge).OnlyEnforceIf(lit)
                if eq is not None:
                    self.model.Add(e == eq).OnlyEnforceIf(lit)
            self.add_hard(_add, label)
        else:
            var = self.model.NewIntVar(0, slack, f"sl_{label}_{name}")
            if le is not None:
                self.model.Add(expr - le <= var)
            if ge is not None:
                self.model.Add(expr + var >= ge)
            if eq is not None:
                self.model.Add(expr - eq <= var)
                self.model.Add(eq - expr <= var)
            self.add_penalty(var, weight, label)


def _build(resources, slots, constraints, use_assumptions):
    model = cp_model.CpModel()
    ctx = SolverContext(model, resources, slots, use_assumptions)

    # Traduzione automatica: catalogo -> espressioni del modello
    for c in constraints:
        handler = HANDLERS.get(c["type"])
        if handler is None:
            raise ValueError(f"Tipo di vincolo sconosciuto: {c['type']}")
        label = c.get("label") or f"{c['type']}#{c.get('id', '?')}"
        handler(ctx, c.get("params", {}), c.get("nature", "hard"),
                int(c.get("weight", 1)), label)

    # Funzione obiettivo: minimizzare le penalità dei soft
    if ctx.penalties:
        model.Minimize(sum(v * w for v, w, _ in ctx.penalties))
    return model, ctx


def _new_solver(time_limit):
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(time_limit)
    solver.parameters.num_workers = 4
    return solver


def solve(resources, slots, constraints, time_limit=30):
    # Prima passata: vincoli hard diretti, presolve pieno, massima velocità.
    model, ctx = _build(resources, slots, constraints, use_assumptions=False)
    solver = _new_solver(time_limit)
    status = solver.Solve(model)

    result = {
        "status": solver.StatusName(status),
        "wall_time": round(solver.WallTime(), 3),
        "assignments": [],
        "objective": None,
        "violations": [],
        "conflicts": [],
    }

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        result["objective"] = solver.ObjectiveValue() if ctx.penalties else 0
        for (r, s), var in ctx.x.items():
            if solver.Value(var):
                result["assignments"].append({"resource_id": r, "slot_id": s})
        for v, w, label in ctx.penalties:
            val = solver.Value(v)
            if val > 0:
                result["violations"].append(
                    {"constraint": label, "amount": val, "cost": val * w})
    elif status == cp_model.INFEASIBLE:
        # Seconda passata diagnostica: stesso modello sotto assunzioni per
        # individuare QUALI obblighi sono in conflitto. Può essere molto più
        # lenta: se scade il tempo, l'esito resta INFEASIBLE senza dettaglio.
        model2, ctx2 = _build(resources, slots, constraints,
                              use_assumptions=True)
        solver2 = _new_solver(time_limit)
        if solver2.Solve(model2) == cp_model.INFEASIBLE:
            core = solver2.SufficientAssumptionsForInfeasibility()
            result["conflicts"] = sorted(
                {ctx2.assumptions[i] for i in core if i in ctx2.assumptions})
        result["wall_time"] = round(
            result["wall_time"] + solver2.WallTime(), 3)

    return result
