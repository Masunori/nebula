"""Report and export checks using a tiny, real CP-SAT solve."""

import csv
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ortools.sat.python import cp_model

from server.app.services.sat_solver_service import SatSolverService
from server.app.services.solve_results import (
    build_result,
    write_result_csvs,
    CSV_FIELDS,
)
from server.tests.test_sat_solver_service import small_problem, with_resource_defaults


class SolveResultTests(unittest.TestCase):
    def service(self):
        data = with_resource_defaults(small_problem(workload=2, release=1))
        data.objective_scale = 10
        data.week_end_dates = {
            str(w): (date(2027, 1, 3) + timedelta(weeks=w)).isoformat()
            for w in data.weeks
        }
        data.contracts = {
            "C1": SimpleNamespace(
                planned_completion_date="2027-01-10", contract_priority=2
            )
        }
        data.activities_by_contract = {"C1": ["A"]}
        data.activities["A"].contract_number = "C1"
        data.activities["A"].delay_weight_scaled = 120
        with patch(
            "server.app.services.sat_solver_service.preprocess_directory",
            return_value=data,
        ):
            service = SatSolverService("A")
        # Force exactly one access in week 2: seven days late, weighted cost 84.
        for (a, w, n), variable in service.variables.activity_access_vars.items():
            service.model.add(variable == int(w == 2 and n == 1))
        return service

    def test_report_and_csv_schemas(self):
        service = self.service()
        self.assertTrue(service.solve())
        report, tables = build_result(service)
        self.assertEqual(report["soft_scores"]["priority_weighted_score"], 84)
        self.assertEqual(report["soft_scores"]["overrun_days_total"], 7)
        self.assertEqual(report["soft_scores"]["contracts_overrunning"], 1)
        self.assertEqual(
            tables["RESULTS.csv"][0]["simulated_completion_date"], "2027-01-17"
        )
        self.assertEqual(tables["SCHEDULE_ACCESS.csv"][0]["access_seq"], 1)
        with tempfile.TemporaryDirectory() as directory:
            write_result_csvs(tables, Path(directory))
            for name, fields in CSV_FIELDS.items():
                with (Path(directory) / name).open() as stream:
                    reader = csv.DictReader(stream)
                    self.assertEqual(reader.fieldnames, fields)
                    self.assertEqual(len(list(reader)), len(tables[name]))
                with (Path("server/data/sample_output") / name).open() as stream:
                    self.assertEqual(next(csv.reader(stream)), fields)

    def test_infeasible_has_no_export_rows(self):
        service = self.service()
        service.model.add(False)
        self.assertFalse(service.solve())
        self.assertEqual(service.status, cp_model.INFEASIBLE)
        report, tables = build_result(service)
        self.assertFalse(report["feasible"])
        self.assertEqual(tables, {})
        self.assertFalse(report["detail"]["csv_written"])

    def test_unknown_is_not_reported_as_proven_infeasible(self):
        service = self.service()
        service.solve(max_time_seconds=0.000001)
        self.assertEqual(service.status, cp_model.UNKNOWN)
        report, tables = build_result(service)
        self.assertIn("not proven", report["detail"]["message"])
        self.assertEqual(tables, {})

    def test_unsolved_result_rejected(self):
        with self.assertRaises(ValueError):
            build_result(self.service())
