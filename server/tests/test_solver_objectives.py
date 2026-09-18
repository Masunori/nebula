"""Objective checks against known schedules and independently reported scores."""

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from ortools.sat.python import cp_model

from server.app.services.sat_solver_service import SatSolverService, add_scenario_objective
from server.app.services.solve_results import build_result
from server.tests.test_sat_solver_service import small_problem, with_resource_defaults


def objective_problem(deadline="2027-01-12", capacity=1):
    data = with_resource_defaults(small_problem(workload=2, release=1))
    data.objective_scale = 10
    data.week_end_dates = {"1": "2027-01-10", "2": "2027-01-17", "3": "2027-01-24"}
    data.contracts = {"C1": SimpleNamespace(planned_completion_date=deadline, contract_priority=2)}
    data.activities_by_contract = {"C1": ["A"]}
    data.activities["A"].contract_number = "C1"
    data.activities["A"].delay_weight_scaled = 120
    data.location_capacity["L"] = capacity
    return data


def service_for(data, scenario):
    with patch("server.app.services.sat_solver_service.preprocess_directory", return_value=data):
        return SatSolverService(scenario)


class ObjectiveTests(unittest.TestCase):
    def test_fixed_assignments_match_report_in_every_scenario(self):
        for scenario, expected in [("A", 144), ("B", 24), ("C", 168)]:
            with self.subTest(scenario=scenario):
                data = objective_problem(
                    deadline="2027-01-24" if scenario == "B" else "2027-01-12",
                    capacity=1 if scenario == "A" else 0,
                )
                service = service_for(data, scenario)
                # Two late weeks: charge final lateness (12 days), not 5 + 12.
                for (_, week, night), x in service.variables.activity_access_vars.items():
                    service.model.add(x == int(week in (2, 3) and night == 1))
                for (_, week, night), e in service.variables.eclo_vars.items():
                    service.model.add(e == int(scenario != "A" and week in (2, 3) and night == 1))
                self.assertTrue(service.solve(workers=1))
                self.assertEqual(service.status, cp_model.OPTIMAL)
                report, _ = build_result(service)
                self.assertAlmostEqual(service.solver.objective_value / data.objective_scale, expected)
                self.assertEqual(report["soft_scores"]["objective_score"], expected)
                self.assertTrue(report["detail"]["objective_optimized"])

    def test_a_selects_on_time_completion(self):
        service = service_for(objective_problem(), "A")
        self.assertTrue(service.solve(workers=1))
        self.assertEqual(service.solver.objective_value, 0)
        self.assertEqual(service.get_value(service.variables.activity_week_access_vars["A", 1]), 1)
        for week in (2, 3):
            self.assertEqual(service.get_value(service.variables.activity_week_access_vars["A", week]), 0)

    def test_b_trades_extra_accesses_for_eclo(self):
        data = objective_problem(deadline="2027-01-24", capacity=0)
        data.activities["A"].workload_units = 6
        service = service_for(data, "B")
        self.assertTrue(service.solve(workers=1))
        # Three normal accesses cost 21; two ECLO accesses cost 14 + 10 = 24.
        self.assertEqual(service.solver.objective_value / 10, 21)
        self.assertEqual(sum(service.get_value(e) for e in service.variables.eclo_vars.values()), 0)

    def test_c_pays_for_eclo_to_avoid_weighted_delay(self):
        data = objective_problem(deadline="2027-01-17")
        data.activities["A"].workload_units = 6
        service = service_for(data, "C")
        self.assertTrue(service.solve(workers=1))
        # Two ECLO accesses finish in week 2 for 10; normal work finishes 7 days late for 84.
        self.assertEqual(service.solver.objective_value / 10, 10)
        report, _ = build_result(service)
        self.assertEqual(report["soft_scores"]["objective_score"], 10)

    def test_invalid_scenario_rejected(self):
        with self.assertRaises(ValueError):
            add_scenario_objective(cp_model.CpModel(), objective_problem(), None, "D")
