"""
Test del motore: puro Python, nessun database.

Dataset di riferimento: 6 persone, 14 giorni (2 settimane ISO complete
da lunedì), turni M e N per giorno.
"""
from datetime import date, timedelta

from django.test import SimpleTestCase

from solver.engine import solve
from solver.explain import explain
from solver.handlers import HANDLERS, REQUIRING_TYPES

PEOPLE = [{"id": i, "name": f"P{i}", "skills": ["senior"] if i < 3 else []}
          for i in range(1, 7)]


def make_slots(days=14, codes=(("M", "06:00", "14:00"),
                               ("N", "22:00", "06:00"))):
    slots, sid = [], 0
    for d in range(days):
        day = (date(2026, 6, 1) + timedelta(days=d)).isoformat()  # lunedì
        for code, st, en in codes:
            sid += 1
            slots.append({"id": sid, "day": day, "code": code,
                          "start": st, "end": en})
    return slots


SLOTS = make_slots()
BY_ID = {s["id"]: s for s in SLOTS}

BASE = [
    {"id": 1, "type": "un_turno_al_giorno", "params": {},
     "nature": "hard", "label": "1/giorno"},
    {"id": 2, "type": "copertura_minima", "params": {"min": 2},
     "nature": "hard", "label": "min2"},
]


def run(extra, people=PEOPLE, slots=SLOTS, base=BASE):
    return solve(people, slots, base + extra, time_limit=10)


def assigned(result):
    """{(persona, giorno, codice)} dalle assegnazioni di una run."""
    return {(a["resource_id"], BY_ID[a["slot_id"]]["day"],
             BY_ID[a["slot_id"]]["code"]) for a in result["assignments"]}


class EngineTests(SimpleTestCase):

    def assigned(self, result):
        return assigned(result)

    def test_base_feasible(self):
        r = run([])
        self.assertEqual(r["status"], "OPTIMAL")
        per_slot = {}
        for a in r["assignments"]:
            per_slot[a["slot_id"]] = per_slot.get(a["slot_id"], 0) + 1
        # copertura minima rispettata su ogni slot
        self.assertTrue(all(per_slot.get(s["id"], 0) >= 2 for s in SLOTS))

    def test_empty_grid_is_optimal_without_coverage(self):
        """Solo regole a tetto: la griglia vuota è una soluzione valida."""
        r = solve(PEOPLE, SLOTS, [BASE[0], {
            "id": 9, "type": "capacita_massima", "params": {"max": 2},
            "nature": "hard", "label": "cap2"}], time_limit=10)
        self.assertEqual(r["status"], "OPTIMAL")
        self.assertEqual(r["assignments"], [])

    def test_infeasible_returns_conflict_core(self):
        r = run([{"id": 9, "type": "capacita_massima", "params": {"max": 1},
                  "nature": "hard", "label": "cap1"}])
        self.assertEqual(r["status"], "INFEASIBLE")
        self.assertIn("cap1", r["conflicts"])
        self.assertIn("min2", r["conflicts"])

    def test_counting_infeasibility_is_fast(self):
        """Regressione due fasi: l'infeasibility da conteggio globale
        (domanda > offerta) deve chiudersi, non scadere in UNKNOWN."""
        r = run([{"id": 9, "type": "max_turni_settimana",
                  "params": {"max": 4}, "nature": "hard", "label": "max4"}])
        self.assertEqual(r["status"], "INFEASIBLE")

    def test_soft_violations_are_reported(self):
        r = solve(PEOPLE, SLOTS, [BASE[0], {
            "id": 9, "type": "copertura_esatta", "params": {"n": 10},
            "nature": "soft", "weight": 1, "label": "esatta10"}],
            time_limit=10)
        self.assertIn(r["status"], ("OPTIMAL", "FEASIBLE"))
        self.assertTrue(r["violations"])

    def test_max_turni_tipo(self):
        r = run([{"id": 9, "type": "max_turni_tipo",
                  "params": {"max": 5, "shift_code": "N"},
                  "nature": "hard", "label": "max5N"}])
        self.assertEqual(r["status"], "OPTIMAL")
        per_person = {}
        for p, d, c in assigned(r):
            if c == "N":
                per_person[p] = per_person.get(p, 0) + 1
        self.assertTrue(all(v <= 5 for v in per_person.values()))

    def test_sequenza_vietata(self):
        r = run([{"id": 9, "type": "sequenza_vietata",
                  "params": {"dopo": "N", "vietato": "M"},
                  "nature": "hard", "label": "noNM"}])
        self.assertEqual(r["status"], "OPTIMAL")
        ass = self.assigned(r)
        for p, d, c in ass:
            if c == "N":
                nxt = (date.fromisoformat(d) + timedelta(days=1)).isoformat()
                self.assertNotIn((p, nxt, "M"), ass)

    def test_max_consecutivi_tipo(self):
        r = run([{"id": 9, "type": "max_consecutivi_tipo",
                  "params": {"max": 2, "shift_code": "N"},
                  "nature": "hard", "label": "max2fila"}])
        self.assertEqual(r["status"], "OPTIMAL")
        days = sorted({s["day"] for s in SLOTS})
        nights = {}
        for p, d, c in assigned(r):
            if c == "N":
                nights.setdefault(p, set()).add(d)
        for p, ds in nights.items():
            streak = 0
            for d in days:
                streak = streak + 1 if d in ds else 0
                self.assertLessEqual(streak, 2)

    def test_incompatibilita_e_affinita(self):
        r = run([{"id": 9, "type": "incompatibilita_persone",
                  "params": {"resource_id": 1, "resource_id_2": 2},
                  "nature": "hard", "label": "1vs2"}])
        s1 = {a["slot_id"] for a in r["assignments"] if a["resource_id"] == 1}
        s2 = {a["slot_id"] for a in r["assignments"] if a["resource_id"] == 2}
        self.assertEqual(s1 & s2, set())

        r = run([{"id": 9, "type": "affinita_persone",
                  "params": {"resource_id": 1, "resource_id_2": 2},
                  "nature": "hard", "label": "coppia"}])
        s1 = {a["slot_id"] for a in r["assignments"] if a["resource_id"] == 1}
        s2 = {a["slot_id"] for a in r["assignments"] if a["resource_id"] == 2}
        self.assertEqual(s1, s2)

    def test_solo_turni_tipo(self):
        r = run([{"id": 9, "type": "solo_turni_tipo",
                  "params": {"resource_id": 3, "shift_code": "M"},
                  "nature": "hard", "label": "p3soloM"}])
        for p, d, c in assigned(r):
            if p == 3:
                self.assertEqual(c, "M")

    def test_weekend_liberi_infeasible_con_organico_corto(self):
        """6 persone, copertura 2: un weekend libero a testa è impossibile
        (servono 4 persone disponibili per ogni giorno di weekend)."""
        r = run([{"id": 9, "type": "weekend_liberi", "params": {"min": 1},
                  "nature": "hard", "label": "we1"}])
        self.assertEqual(r["status"], "INFEASIBLE")

    def test_unknown_constraint_type_raises(self):
        with self.assertRaises(ValueError):
            solve(PEOPLE, SLOTS, [{"id": 1, "type": "non_esiste",
                                   "params": {}, "nature": "hard"}], 5)


class CustomRuleTests(SimpleTestCase):
    """La regola su misura deve coprire le forme "conta e limita"."""

    def test_per_slot_minimo_equivale_a_copertura(self):
        r = solve(PEOPLE, SLOTS, [BASE[0], {
            "id": 9, "type": "regola_personalizzata",
            "params": {"per": "slot", "vincolo": ">=", "valore": 2},
            "nature": "hard", "label": "min2custom"}], time_limit=10)
        self.assertEqual(r["status"], "OPTIMAL")
        per_slot = {}
        for a in r["assignments"]:
            per_slot[a["slot_id"]] = per_slot.get(a["slot_id"], 0) + 1
        self.assertTrue(all(v >= 2 for v in per_slot.values()))

    def test_per_persona_settimana_con_filtro(self):
        """Max 2 notti a settimana a testa: il caso d'uso da manuale."""
        r = run([{"id": 9, "type": "regola_personalizzata",
                  "params": {"per": "persona_settimana", "vincolo": "<=",
                             "valore": 2, "shift_code": "N"},
                  "nature": "hard", "label": "max2Nsett"}])
        self.assertEqual(r["status"], "INFEASIBLE")  # 14 notti, 6x2x2=24...
        # ricontrollo: 2 notti/sett x 6 persone x 2 settimane = 24 >= 28? no:
        # servono 2 persone x 14 notti = 28 presenze, disponibili 24 -> giusto

    def test_per_persona_giorno(self):
        r = run([{"id": 9, "type": "regola_personalizzata",
                  "params": {"per": "persona_giorno", "vincolo": "<=",
                             "valore": 1},
                  "nature": "hard", "label": "1algiorno"}])
        self.assertEqual(r["status"], "OPTIMAL")

    def test_soft_custom_rule_reports_violations(self):
        r = solve(PEOPLE, SLOTS, [BASE[0], {
            "id": 9, "type": "regola_personalizzata",
            "params": {"per": "slot", "vincolo": ">=", "valore": 10},
            "nature": "soft", "weight": 1, "label": "irrealistica"}],
            time_limit=10)
        self.assertIn(r["status"], ("OPTIMAL", "FEASIBLE"))
        self.assertTrue(r["violations"])

    def test_requires_assignment_depends_on_params(self):
        from solver.handlers import constraint_requires_assignment as req
        ge = {"type": "regola_personalizzata",
              "params": {"vincolo": ">=", "valore": 1}}
        le = {"type": "regola_personalizzata",
              "params": {"vincolo": "<=", "valore": 2}}
        self.assertTrue(req(ge))
        self.assertFalse(req(le))

    def test_invalid_spec_raises(self):
        for params in ({"per": "marziani", "vincolo": "<=", "valore": 1},
                       {"per": "slot", "vincolo": "!=", "valore": 1}):
            with self.assertRaises(ValueError):
                solve(PEOPLE, SLOTS, [{
                    "id": 1, "type": "regola_personalizzata",
                    "params": params, "nature": "hard"}], 5)

    def test_filtro_persona_specifica(self):
        """Solo la persona 1 ha il tetto: gli altri restano liberi."""
        r = run([{"id": 9, "type": "regola_personalizzata",
                  "params": {"per": "persona", "vincolo": "<=", "valore": 3,
                             "resource_id": 1},
                  "nature": "hard", "label": "p1max3"}])
        self.assertEqual(r["status"], "OPTIMAL")
        counts = {}
        for a in r["assignments"]:
            counts[a["resource_id"]] = counts.get(a["resource_id"], 0) + 1
        self.assertLessEqual(counts.get(1, 0), 3)
        # con copertura min2 su 28 slot qualcun altro deve superare 3
        self.assertTrue(any(v > 3 for p, v in counts.items() if p != 1))

    def test_filtro_weekend(self):
        """Max 1 turno nel weekend a testa."""
        r = run([{"id": 9, "type": "regola_personalizzata",
                  "params": {"per": "persona", "vincolo": "<=", "valore": 1,
                             "giorni": "weekend"},
                  "nature": "soft", "weight": 5, "label": "we1"}])
        self.assertIn(r["status"], ("OPTIMAL", "FEASIBLE"))
        we_days = {s["day"] for s in SLOTS
                   if date.fromisoformat(s["day"]).weekday() >= 5}
        counts = {}
        for a in assigned(r):
            if a[1] in we_days:
                counts[a[0]] = counts.get(a[0], 0) + 1
        # 4 giorni di weekend x 2 slot x min2 = 16 presenze, 6 persone:
        # qualcuno deve sforare -> la soft riporta violazioni
        self.assertTrue(r["violations"])

    def test_filtro_intervallo_date(self):
        """Capacità 2 solo nella prima settimana: la seconda resta libera."""
        r = run([{"id": 9, "type": "regola_personalizzata",
                  "params": {"per": "slot", "vincolo": "<=", "valore": 2,
                             "dal": "2026-06-01", "al": "2026-06-07"},
                  "nature": "hard", "label": "cap2sett1"}])
        self.assertEqual(r["status"], "OPTIMAL")
        per_slot = {}
        for a in r["assignments"]:
            day = BY_ID[a["slot_id"]]["day"]
            if day <= "2026-06-07":
                per_slot[a["slot_id"]] = per_slot.get(a["slot_id"], 0) + 1
        self.assertTrue(all(v <= 2 for v in per_slot.values()))

    def test_finestra_mobile(self):
        """Max 2 notti in qualsiasi finestra di 4 giorni."""
        r = run([{"id": 9, "type": "regola_personalizzata",
                  "params": {"per": "finestra", "vincolo": "<=", "valore": 2,
                             "finestra_giorni": 4, "shift_code": "N"},
                  "nature": "hard", "label": "max2N4gg"}])
        self.assertEqual(r["status"], "OPTIMAL")
        days = sorted({s["day"] for s in SLOTS})
        nights = {}
        for p, d, c in assigned(r):
            if c == "N":
                nights.setdefault(p, set()).add(d)
        for p, ds in nights.items():
            for i, d in enumerate(days):
                end = (date.fromisoformat(d) + timedelta(days=3)).isoformat()
                in_win = sum(1 for dd in ds if d <= dd <= end)
                self.assertLessEqual(in_win, 2, f"persona {p} finestra {d}")


class ExplainTests(SimpleTestCase):

    def test_empty_without_requiring_rules(self):
        result = {"status": "OPTIMAL", "assignments": [],
                  "violations": [], "conflicts": []}
        text = explain(result, PEOPLE, SLOTS, [
            {"type": "capacita_massima", "nature": "hard", "params": {}}])
        self.assertIn("copertura minima", text)

    def test_empty_with_sacrificed_soft_coverage(self):
        result = {"status": "FEASIBLE", "assignments": [],
                  "violations": [{"constraint": "cmin", "amount": 1,
                                  "cost": 1}], "conflicts": []}
        text = explain(result, PEOPLE, SLOTS, [
            {"type": "copertura_minima", "nature": "soft", "label": "cmin",
             "params": {"min": 1}}])
        self.assertIn("preferenze", text)

    def test_filled_reports_stats(self):
        result = {"status": "OPTIMAL",
                  "assignments": [{"resource_id": 1, "slot_id": 1}],
                  "violations": [], "conflicts": []}
        text = explain(result, PEOPLE, SLOTS, [])
        self.assertIn("1 turni", text)

    def test_registry_marks_requiring_types(self):
        for t in ("copertura_minima", "copertura_esatta",
                  "min_turni_periodo", "preferenza_assegnazione"):
            self.assertIn(t, REQUIRING_TYPES)
        self.assertNotIn("capacita_massima", REQUIRING_TYPES)


class CatalogConsistencyTests(SimpleTestCase):

    def test_every_template_has_a_handler(self):
        from catalog.data import CATALOG
        codes = {t["code"] for t in CATALOG}
        self.assertEqual(codes - set(HANDLERS), set())
        self.assertEqual(set(HANDLERS) - codes, set())
