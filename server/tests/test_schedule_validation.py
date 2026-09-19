"""CSV validation catches malformed and inconsistent submissions independently."""

import copy
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from server.app.services.solve_results import build_result, write_result_csvs
from server.app.services.schedule_validation import (
    InvalidScheduleError, score_directory, validate_schedule,
)
from server.tests.test_solver_objectives import objective_problem, service_for


class ScheduleValidationTests(unittest.TestCase):
    def fixture(self, scenario="A"):
        data = objective_problem(deadline="2027-01-24" if scenario == "B" else "2027-01-12")
        data.locations = {"L": SimpleNamespace()}
        service = service_for(copy.deepcopy(data), scenario)
        for (_, w, n), x in service.variables.activity_access_vars.items():
            service.model.add(x == int(w == 2 and n == 1))
        for e in service.variables.eclo_vars.values():
            service.model.add(e == 0)
        self.assertTrue(service.solve(workers=1))
        report, tables = build_result(service)
        return data, tables, report

    def validate(self, data, tables, scenario=None):
        with tempfile.TemporaryDirectory() as directory:
            write_result_csvs(tables, Path(directory))
            return validate_schedule(directory, data, scenario)

    def test_solver_exports_match_independent_scores_all_scenarios(self):
        for scenario in ("A", "B", "C"):
            with self.subTest(scenario=scenario):
                data, tables, expected = self.fixture(scenario)
                actual = self.validate(data, tables)
                self.assertTrue(actual["feasible"], actual)
                self.assertEqual(actual["soft_scores"], expected["soft_scores"])

    def test_corrupted_submission_rejected(self):
        cases = [
            ("workload", lambda d, t: t["SCHEDULE_ACCESS.csv"].clear()),
            ("weekly_access", lambda d, t: t["SCHEDULE_ACCESS.csv"].append(dict(t["SCHEDULE_ACCESS.csv"][0]))),
            ("access_seq", lambda d, t: t["SCHEDULE_ACCESS.csv"][0].update(access_seq=2)),
            ("access_night", lambda d, t: t["SCHEDULE_ACCESS.csv"][0].update(access_night=99)),
            ("planned_start", lambda d, t: setattr(d.activities["A"], "planned_start_week", 3)),
            ("eclo", lambda d, t: t["SCHEDULE_ACCESS.csv"][0].update(eclo=1)),
            ("occupancy", lambda d, t: t["SCHEDULE_OCCUPANCY.csv"].clear()),
            ("occupancy", lambda d, t: t["SCHEDULE_OCCUPANCY.csv"].append(dict(t["SCHEDULE_OCCUPANCY.csv"][0]))),
            ("capacity", lambda d, t: d.location_capacity.update(L=0)),
            ("results", lambda d, t: t["RESULTS.csv"][0].update(overrun_days=999)),
            ("results", lambda d, t: t["RESULTS.csv"].append(dict(t["RESULTS.csv"][0]))),
            ("reference", lambda d, t: t["SCHEDULE_ACCESS.csv"][0].update(activity_id="missing")),
            ("week", lambda d, t: t["SCHEDULE_ACCESS.csv"][0].update(week=99)),
            ("value", lambda d, t: t["SCHEDULE_ACCESS.csv"][0].update(eclo=2)),
            ("value", lambda d, t: t["SCHEDULE_ACCESS.csv"][0].update(week="2.5")),
            ("scenario", lambda d, t: t["RESULTS.csv"].append(dict(t["RESULTS.csv"][0], scenario="B"))),
        ]
        data, tables, _ = self.fixture()
        for tag, mutate in cases:
            with self.subTest(tag=tag, mutation=mutate):
                d, t = copy.deepcopy(data), copy.deepcopy(tables)
                mutate(d, t)
                report = self.validate(d, t)
                self.assertFalse(report["feasible"])
                self.assertEqual(report["soft_scores"], {})
                self.assertIn(tag, {v["tag"] for v in report["hard_violations"]})

    def test_pairwise_conflict_sharing_and_illegal_mix(self):
        data, tables, _ = self.fixture()
        data.activities["B"] = copy.deepcopy(data.activities["A"])
        data.activities_by_contract["C1"].append("B")
        tables["SCHEDULE_ACCESS.csv"].append(dict(tables["SCHEDULE_ACCESS.csv"][0], activity_id="B"))
        tables["SCHEDULE_OCCUPANCY.csv"].append(dict(tables["SCHEDULE_OCCUPANCY.csv"][0], activity_id="B"))
        data.conflicts = [SimpleNamespace(activities=["A", "B"], locations=["L"])]
        self.assertTrue(self.validate(data, tables)["feasible"])
        tables["SCHEDULE_OCCUPANCY.csv"][1]["co_share_group"] = "separate"
        report = self.validate(data, tables)
        self.assertIn("closure_buffer", {v["tag"] for v in report["hard_violations"]})
        tables["SCHEDULE_OCCUPANCY.csv"][1]["co_share_group"] = tables["SCHEDULE_OCCUPANCY.csv"][0]["co_share_group"]
        data.activities["B"].access_type = "PM"
        report = self.validate(data, tables)
        self.assertIn("possession_mix", {v["tag"] for v in report["hard_violations"]})
        data.activities["B"].predecessor_activity_id = "A"
        data.groups["h1"].number_of_workfronts = 1
        report = self.validate(data, tables)
        self.assertTrue({"predecessor", "workfronts"} <= {v["tag"] for v in report["hard_violations"]})

    def test_deadline_and_eclo_window(self):
        data, tables, _ = self.fixture("B")
        data.activities["A"].deadline_week = 1
        self.assertIn("planned_date", {v["tag"] for v in self.validate(data, tables)["hard_violations"]})
        data, tables, _ = self.fixture("C")
        first = tables["SCHEDULE_ACCESS.csv"][0]
        first.update(week=1, eclo=1)
        tables["SCHEDULE_ACCESS.csv"].append(dict(first, access_seq=2, week=3))
        self.assertIn("eclo_window", {v["tag"] for v in self.validate(data, tables)["hard_violations"]})

    def test_missing_file_bad_header_and_score_rejection(self):
        data, tables, _ = self.fixture()
        with tempfile.TemporaryDirectory() as directory:
            self.assertFalse(validate_schedule(directory, data)["feasible"])
            write_result_csvs(tables, Path(directory))
            (Path(directory) / "RESULTS.csv").write_text("wrong,header\n")
            report = validate_schedule(directory, data)
            self.assertEqual(report["hard_violations"][0]["tag"], "schema")
            with patch("server.app.services.schedule_validation.preprocess_directory", return_value=data):
                with self.assertRaises(InvalidScheduleError):
                    score_directory(directory)

    def test_expected_scenario_must_match(self):
        data, tables, _ = self.fixture()
        self.assertFalse(self.validate(data, tables, "B")["feasible"])
