"""
Catalogo dei vincoli: ogni tipo è una funzione che riceve i parametri
e aggiunge espressioni al modello CP-SAT.

Aggiungere una nuova regola = aggiungere un handler qui + una voce in
catalog/data.py. Il motore non si tocca.

Firma di un handler:
    handler(ctx, params, nature, weight, label)

Ogni vincolo si esprime con ctx.limit(expr, nature, weight, label,
le=|ge=|eq=, slack=, name=): il branching hard/soft vive in un punto
solo (engine.SolverContext.limit), gli handler dicono soltanto QUALE
espressione vincolare e CON QUALE soglia.

`requires_assignment=True` marca i tipi che spingono il solver ad
assegnare qualcuno: explain.py li usa per motivare le griglie vuote.
"""
from datetime import datetime, timedelta

HANDLERS = {}
REQUIRING_TYPES = set()  # tipi che obbligano/incentivano ad assegnare


def register(name, requires_assignment=False):
    def deco(fn):
        HANDLERS[name] = fn
        if requires_assignment:
            REQUIRING_TYPES.add(name)
        return fn
    return deco


def constraint_requires_assignment(c):
    """True se il vincolo spinge il solver ad assegnare qualcuno.

    Per i tipi nativi decide il registry; per la regola su misura dipende
    dai parametri (un minimo o un valore esatto > 0 chiede assegnazioni).
    """
    if c["type"] in REQUIRING_TYPES:
        return True
    if c["type"] == "regola_personalizzata":
        params = c.get("params", {})
        return (params.get("vincolo") in (">=", "==")
                and int(params.get("valore", 0) or 0) > 0)
    return False


def _date(day_str):
    return datetime.strptime(day_str, "%Y-%m-%d")


def _weekday(day_str):
    """0=lunedì … 6=domenica."""
    return _date(day_str).weekday()


def _week(day_str):
    """(anno ISO, settimana ISO): per i vincoli settimanali."""
    iso = _date(day_str).isocalendar()
    return (iso[0], iso[1])


def _worked_day_vars(ctx, code=None):
    """worked[r, d] = la persona r lavora nel giorno d (opz. solo turni `code`)."""
    worked = {}
    for r in ctx.r_ids:
        for d, day_slots in ctx.slots_by_day.items():
            xs = [ctx.x[r, s["id"]] for s in day_slots
                  if code is None or s.get("code") == code]
            w = ctx.model.NewBoolVar(f"wd_{r}_{d}_{code or 'all'}")
            if xs:
                ctx.model.AddMaxEquality(w, xs)
            else:
                ctx.model.Add(w == 0)
            worked[r, d] = w
    return worked


# ----------------------------------------------------------------------
# Famiglia: regole di base
# ----------------------------------------------------------------------

@register("un_turno_al_giorno")
def un_turno_al_giorno(ctx, params, nature, weight, label):
    """Max 1 turno per persona per giorno. Quasi sempre hard."""
    for r in ctx.r_ids:
        for d, day_slots in ctx.slots_by_day.items():
            expr = sum(ctx.x[r, s["id"]] for s in day_slots)
            ctx.limit(expr, nature, weight, label,
                      le=1, slack=len(day_slots), name=f"{r}_{d}")


# ----------------------------------------------------------------------
# Famiglia: copertura
# ----------------------------------------------------------------------

@register("copertura_minima", requires_assignment=True)
def copertura_minima(ctx, params, nature, weight, label):
    """Almeno `min` persone (opz. con `skill`) per ogni slot
    (opz. filtrato per `shift_code`)."""
    minimo = int(params["min"])
    eligible = ctx.eligible_resources(params.get("skill"))
    for s in ctx.matching_slots(params.get("shift_code")):
        expr = sum(ctx.x[r, s] for r in eligible)
        ctx.limit(expr, nature, weight, label, ge=minimo, slack=minimo, name=s)


@register("copertura_esatta", requires_assignment=True)
def copertura_esatta(ctx, params, nature, weight, label):
    """Esattamente `n` persone (opz. con `skill`) per slot
    (opz. filtrato per `shift_code`): né di più né di meno."""
    n = int(params["n"])
    eligible = ctx.eligible_resources(params.get("skill"))
    for s in ctx.matching_slots(params.get("shift_code")):
        expr = sum(ctx.x[r, s] for r in eligible)
        ctx.limit(expr, nature, weight, label,
                  eq=n, slack=max(n, len(eligible)), name=s)


# ----------------------------------------------------------------------
# Famiglia: capacità / carico di lavoro
# ----------------------------------------------------------------------

@register("capacita_massima")
def capacita_massima(ctx, params, nature, weight, label):
    """Al massimo `max` persone per slot (opz. filtrato per `shift_code`)."""
    massimo = int(params["max"])
    for s in ctx.matching_slots(params.get("shift_code")):
        expr = sum(ctx.x[r, s] for r in ctx.r_ids)
        ctx.limit(expr, nature, weight, label,
                  le=massimo, slack=len(ctx.r_ids), name=s)


@register("max_turni_periodo")
def max_turni_periodo(ctx, params, nature, weight, label):
    """Al massimo `max` turni totali per persona nell'orizzonte."""
    massimo = int(params["max"])
    for r in ctx.r_ids:
        expr = sum(ctx.x[r, s] for s in ctx.s_ids)
        ctx.limit(expr, nature, weight, label,
                  le=massimo, slack=len(ctx.s_ids), name=r)


@register("min_turni_periodo", requires_assignment=True)
def min_turni_periodo(ctx, params, nature, weight, label):
    """Almeno `min` turni totali per persona nell'orizzonte
    (es. monte ore contrattuale)."""
    minimo = int(params["min"])
    for r in ctx.r_ids:
        expr = sum(ctx.x[r, s] for s in ctx.s_ids)
        ctx.limit(expr, nature, weight, label, ge=minimo, slack=minimo, name=r)


@register("max_turni_settimana")
def max_turni_settimana(ctx, params, nature, weight, label):
    """Al massimo `max` turni per persona in ogni settimana di calendario."""
    massimo = int(params["max"])
    weeks = {}
    for s in ctx.slots:
        weeks.setdefault(_week(s["day"]), []).append(s["id"])
    for r in ctx.r_ids:
        for wk, slot_ids in weeks.items():
            expr = sum(ctx.x[r, s] for s in slot_ids)
            ctx.limit(expr, nature, weight, label, le=massimo,
                      slack=len(slot_ids), name=f"{r}_{wk[0]}_{wk[1]}")


@register("max_turni_tipo")
def max_turni_tipo(ctx, params, nature, weight, label):
    """Al massimo `max` turni di tipo `shift_code` per persona
    nell'orizzonte (es. non più di 2 notti a testa)."""
    massimo = int(params["max"])
    targets = ctx.matching_slots(params["shift_code"])
    for r in ctx.r_ids:
        expr = sum(ctx.x[r, s] for s in targets)
        ctx.limit(expr, nature, weight, label,
                  le=massimo, slack=len(targets), name=r)


# ----------------------------------------------------------------------
# Famiglia: sequenza
# ----------------------------------------------------------------------

@register("max_giorni_consecutivi")
def max_giorni_consecutivi(ctx, params, nature, weight, label):
    """Non più di `max` giorni lavorati di fila."""
    massimo = int(params["max"])
    worked = _worked_day_vars(ctx)
    for r in ctx.r_ids:
        for i in range(len(ctx.days) - massimo):
            window = [worked[r, ctx.days[j]] for j in range(i, i + massimo + 1)]
            ctx.limit(sum(window), nature, weight, label,
                      le=massimo, slack=len(window), name=f"{r}_{i}")


@register("max_consecutivi_tipo")
def max_consecutivi_tipo(ctx, params, nature, weight, label):
    """Non più di `max` giorni di fila con un turno `shift_code`
    (es. massimo 3 notti consecutive)."""
    massimo = int(params["max"])
    worked = _worked_day_vars(ctx, params["shift_code"])
    for r in ctx.r_ids:
        for i in range(len(ctx.days) - massimo):
            window = [worked[r, ctx.days[j]] for j in range(i, i + massimo + 1)]
            ctx.limit(sum(window), nature, weight, label,
                      le=massimo, slack=len(window), name=f"{r}_{i}")


@register("riposo_minimo")
def riposo_minimo(ctx, params, nature, weight, label):
    """Almeno `ore` di riposo tra la fine di un turno e l'inizio del successivo."""
    ore = float(params["ore"])
    gap = timedelta(hours=ore)
    # Coppie di slot incompatibili (fine s1 + riposo > inizio s2)
    incompatible = []
    for s1 in ctx.slots:
        _, end1 = ctx.slot_datetimes(s1)
        for s2 in ctx.slots:
            if s1["id"] == s2["id"]:
                continue
            start2, _ = ctx.slot_datetimes(s2)
            if end1 <= start2 < end1 + gap:
                incompatible.append((s1["id"], s2["id"]))

    for r in ctx.r_ids:
        for s1, s2 in incompatible:
            ctx.limit(ctx.x[r, s1] + ctx.x[r, s2], nature, weight, label,
                      le=1, name=f"{r}_{s1}_{s2}")


@register("sequenza_vietata")
def sequenza_vietata(ctx, params, nature, weight, label):
    """Dopo un turno `dopo` non si può fare un turno `vietato` il giorno
    seguente (es. dopo la notte, niente mattina)."""
    dopo, vietato = params["dopo"], params["vietato"]
    for d in ctx.days:
        nxt = (_date(d) + timedelta(days=1)).strftime("%Y-%m-%d")
        if nxt not in ctx.slots_by_day:
            continue
        a_slots = [s["id"] for s in ctx.slots_by_day[d]
                   if s.get("code") == dopo]
        b_slots = [s["id"] for s in ctx.slots_by_day[nxt]
                   if s.get("code") == vietato]
        for r in ctx.r_ids:
            for sa in a_slots:
                for sb in b_slots:
                    ctx.limit(ctx.x[r, sa] + ctx.x[r, sb], nature, weight,
                              label, le=1, name=f"{r}_{sa}_{sb}")


@register("giorni_riposo_minimi")
def giorni_riposo_minimi(ctx, params, nature, weight, label):
    """Almeno `min` giorni completamente liberi per persona nell'orizzonte."""
    minimo = int(params["min"])
    worked = _worked_day_vars(ctx)
    n_days = len(ctx.days)
    allowed = n_days - minimo  # giorni lavorabili al massimo
    for r in ctx.r_ids:
        expr = sum(worked[r, d] for d in ctx.days)
        ctx.limit(expr, nature, weight, label,
                  le=allowed, slack=n_days, name=r)


@register("weekend_liberi")
def weekend_liberi(ctx, params, nature, weight, label):
    """Almeno `min` weekend (sabato+domenica) completamente liberi
    per persona nell'orizzonte."""
    minimo = int(params["min"])
    # Giorni di weekend raggruppati per settimana ISO
    weekends = {}
    for d in ctx.days:
        if _weekday(d) >= 5:
            weekends.setdefault(_week(d), []).append(d)
    if not weekends:
        return
    for r in ctx.r_ids:
        frees = []
        for wk, w_days in weekends.items():
            xs = [ctx.x[r, s["id"]] for d in w_days
                  for s in ctx.slots_by_day[d]]
            busy = ctx.model.NewBoolVar(f"we_{label}_{r}_{wk[0]}_{wk[1]}")
            ctx.model.AddMaxEquality(busy, xs)
            frees.append(busy.Not())
        ctx.limit(sum(frees), nature, weight, label,
                  ge=minimo, slack=minimo, name=r)


# ----------------------------------------------------------------------
# Famiglia: equità
# ----------------------------------------------------------------------

@register("equita_distribuzione")
def equita_distribuzione(ctx, params, nature, weight, label):
    """Distribuzione bilanciata dei turni `shift_code` (es. notti):
    lo scarto max-min tra persone non supera `tolleranza`."""
    tol = int(params.get("tolleranza", 1))
    target_slots = ctx.matching_slots(params.get("shift_code"))
    n = len(target_slots)
    counts = []
    for r in ctx.r_ids:
        c = ctx.model.NewIntVar(0, n, f"cnt_{label}_{r}")
        ctx.model.Add(c == sum(ctx.x[r, s] for s in target_slots))
        counts.append(c)
    cmax = ctx.model.NewIntVar(0, n, f"cmax_{label}")
    cmin = ctx.model.NewIntVar(0, n, f"cmin_{label}")
    ctx.model.AddMaxEquality(cmax, counts)
    ctx.model.AddMinEquality(cmin, counts)
    ctx.limit(cmax - cmin, nature, weight, label, le=tol, slack=n)


# ----------------------------------------------------------------------
# Famiglia: preferenze / disponibilità
# ----------------------------------------------------------------------

@register("indisponibilita")
def indisponibilita(ctx, params, nature, weight, label):
    """La persona `resource_id` non è disponibile (opz. in `day` e/o `shift_code`)."""
    r = int(params["resource_id"])
    for s in ctx.matching_slots(params.get("shift_code"), params.get("day")):
        ctx.limit(ctx.x[r, s], nature, weight, label, le=0, name=f"{r}_{s}")


@register("preferenza_assegnazione", requires_assignment=True)
def preferenza_assegnazione(ctx, params, nature, weight, label):
    """La persona `resource_id` preferisce lavorare in `day`/`shift_code`.
    Sensata solo come soft: penalizza la NON assegnazione."""
    r = int(params["resource_id"])
    targets = ctx.matching_slots(params.get("shift_code"), params.get("day"))
    if not targets:
        return
    assigned = ctx.model.NewBoolVar(f"pref_{label}_{r}")
    ctx.model.AddMaxEquality(assigned, [ctx.x[r, s] for s in targets])
    ctx.limit(assigned, nature, weight, label, ge=1, name=r)


@register("solo_turni_tipo")
def solo_turni_tipo(ctx, params, nature, weight, label):
    """La persona `resource_id` può lavorare solo nei turni `shift_code`
    (es. part-time solo mattine). Tutti gli altri turni le sono vietati."""
    r = int(params["resource_id"])
    allowed = set(ctx.matching_slots(params["shift_code"]))
    for s in ctx.s_ids:
        if s not in allowed:
            ctx.limit(ctx.x[r, s], nature, weight, label, le=0,
                      name=f"{r}_{s}")


# ----------------------------------------------------------------------
# Famiglia: su misura
# ----------------------------------------------------------------------

def _custom_people(ctx, params):
    """Persone interessate dalla regola su misura: una specifica,
    quelle con una skill, o tutte."""
    rid = params.get("resource_id")
    if rid:
        rid = int(rid)
        return [rid] if rid in ctx.r_by_id else []
    return ctx.eligible_resources(params.get("skill") or None)


def _custom_slots(ctx, params):
    """Slot interessati: filtro per codice turno, giorni della settimana
    (weekend/feriali/giorno specifico) e intervallo di date."""
    ids = ctx.matching_slots(params.get("shift_code") or None)
    giorni = params.get("giorni") or ""
    dal = params.get("dal") or None
    al = params.get("al") or None
    out = []
    for s in ids:
        day = ctx.s_by_id[s]["day"]
        if dal and day < dal:
            continue
        if al and day > al:
            continue
        if giorni:
            wd = _weekday(day)
            if giorni == "weekend" and wd < 5:
                continue
            if giorni == "feriali" and wd >= 5:
                continue
            if giorni not in ("weekend", "feriali") and wd != int(giorni):
                continue
        out.append(s)
    return out


@register("regola_personalizzata")
def regola_personalizzata(ctx, params, nature, weight, label):
    """Regola costruita dall'utente, descritta da dati (mai da codice):

      per ogni <per: slot | persona | persona_giorno | persona_settimana
                | finestra di K giorni>,
      il conteggio delle assegnazioni (filtrate per codice turno, skill,
      persona specifica, giorni della settimana, intervallo di date)
      deve essere <vincolo: <= | >= | ==> <valore>.

    Copre la forma "conta e limita" che accomuna gran parte dei vincoli
    di pianificazione; le forme speciali restano handler nativi.
    """
    people = _custom_people(ctx, params)
    slot_ids = _custom_slots(ctx, params)
    slot_set = set(slot_ids)
    op = params["vincolo"]
    value = int(params["valore"])
    if op not in ("<=", ">=", "=="):
        raise ValueError(f"Vincolo sconosciuto nella regola su misura: {op}")
    kw = {"<=": "le", ">=": "ge", "==": "eq"}[op]

    def lim(expr, slack, name):
        ctx.limit(expr, nature, weight, label,
                  **{kw: value}, slack=max(value, slack, 1), name=name)

    per = params.get("per", "slot")
    if per == "slot":
        for s in slot_ids:
            lim(sum(ctx.x[r, s] for r in people), len(people), s)
    elif per == "persona":
        for r in people:
            lim(sum(ctx.x[r, s] for s in slot_ids), len(slot_ids), r)
    elif per == "persona_giorno":
        for r in people:
            for d, day_slots in ctx.slots_by_day.items():
                xs = [ctx.x[r, s["id"]] for s in day_slots
                      if s["id"] in slot_set]
                if xs:
                    lim(sum(xs), len(xs), f"{r}_{d}")
    elif per == "persona_settimana":
        weeks = {}
        for s in ctx.slots:
            if s["id"] in slot_set:
                weeks.setdefault(_week(s["day"]), []).append(s["id"])
        for r in people:
            for wk, ids in weeks.items():
                lim(sum(ctx.x[r, s] for s in ids), len(ids),
                    f"{r}_{wk[0]}_{wk[1]}")
    elif per == "finestra":
        # Finestra mobile di K giorni di calendario: si considerano solo
        # le finestre intere dentro l'orizzonte (quelle parziali in coda
        # renderebbero i minimi più severi del dichiarato).
        k = int(params.get("finestra_giorni") or 7)
        by_day = {}
        for s in slot_ids:
            by_day.setdefault(ctx.s_by_id[s]["day"], []).append(s)
        days_sorted = sorted(by_day)
        if days_sorted:
            last = days_sorted[-1]
            for r in people:
                for i, d in enumerate(days_sorted):
                    end = (_date(d) + timedelta(days=k - 1)) \
                        .strftime("%Y-%m-%d")
                    if end > last:
                        break
                    win = [s for dd in days_sorted[i:] if dd <= end
                           for s in by_day[dd]]
                    lim(sum(ctx.x[r, s] for s in win), len(win), f"{r}_{i}")
    else:
        raise ValueError(f"Ambito sconosciuto nella regola su misura: {per}")


# ----------------------------------------------------------------------
# Famiglia: persone e coppie
# ----------------------------------------------------------------------

@register("incompatibilita_persone")
def incompatibilita_persone(ctx, params, nature, weight, label):
    """Le persone `resource_id` e `resource_id_2` non lavorano mai
    nello stesso slot."""
    r1, r2 = int(params["resource_id"]), int(params["resource_id_2"])
    for s in ctx.s_ids:
        ctx.limit(ctx.x[r1, s] + ctx.x[r2, s], nature, weight, label,
                  le=1, name=s)


@register("affinita_persone")
def affinita_persone(ctx, params, nature, weight, label):
    """Le persone `resource_id` e `resource_id_2` lavorano sempre insieme:
    stessi slot per entrambe (es. tutor e tirocinante)."""
    r1, r2 = int(params["resource_id"]), int(params["resource_id_2"])
    for s in ctx.s_ids:
        ctx.limit(ctx.x[r1, s] - ctx.x[r2, s], nature, weight, label,
                  eq=0, name=s)
