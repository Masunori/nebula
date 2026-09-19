"""Test suite for standalone deterministic schedule validator."""

import csv
import unittest
from pathlib import Path

from server.app.services.csv_preprocessor import preprocess_directory
from server.app.services.schedule_validator import validate_schedule


class ScheduleValidatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = preprocess_directory()
        output_dir = Path(__file__).resolve().parents[1] / "data" / "actual_output"
        cls.access_rows = []
        with (output_dir / "SCHEDULE_ACCESS.csv").open(encoding="utf-8") as f:
            cls.access_rows = list(csv.DictReader(f))

        cls.occupancy_rows = []
        with (output_dir / "SCHEDULE_OCCUPANCY.csv").open(encoding="utf-8") as f:
            cls.occupancy_rows = list(csv.DictReader(f))

        cls.results_rows = []
        with (output_dir / "RESULTS.csv").open(encoding="utf-8") as f:
            cls.results_rows = list(csv.DictReader(f))

    def test_actual_output_scenario_a_is_feasible(self):
        result = validate_schedule(
            self.data,
            self.access_rows,
            self.occupancy_rows,
            self.results_rows,
            scenario="A",
        )
        self.assertTrue(result["feasible"], msg=f"Violations: {result['hard_violations']}")
        self.assertEqual(len(result["hard_violations"]), 0)
        self.assertEqual(result["soft_scores"]["eclo_nights_total"], 0)
        self.assertEqual(result["soft_scores"]["excess_access_nights_total"], 0)
        self.assertGreater(result["detail"]["nights_scheduled"], 0)

    def test_detects_eclo_violation_in_scenario_a(self):
        # Inject an illegal ECLO access in Scenario A
        tampered_access = [dict(r) for r in self.access_rows]
        tampered_access[0]["eclo"] = 1
        result = validate_schedule(
            self.data,
            tampered_access,
            self.occupancy_rows,
            self.results_rows,
            scenario="A",
        )
        self.assertFalse(result["feasible"])
        rules = [v["rule"] for v in result["hard_violations"]]
        self.assertIn("eclo", rules)

    def test_detects_workfront_violation(self):
        # Stack multiple activities on same night exceeding workfronts
        tampered_access = [dict(r) for r in self.access_rows]
        for row in tampered_access[:10]:
            row["access_night"] = 1
            row["week"] = 10
        result = validate_schedule(
            self.data,
            tampered_access,
            self.occupancy_rows,
            self.results_rows,
            scenario="A",
        )
        self.assertFalse(result["feasible"])
        rules = [v["rule"] for v in result["hard_violations"]]
        self.assertIn("workfront", rules)

    def test_detects_live_closure_violation(self):
        # A074 is Live at H01_H02 in week 21, closing Line Beta at S15/S16.
        # Moving A001 (which operates at S15/S16) to week 21 creates an intrusion into A074's closure.
        tampered_access = [dict(r) for r in self.access_rows]
        for row in tampered_access:
            if row["activity_id"] == "A001":
                row["week"] = 21
        tampered_occ = [dict(r) for r in self.occupancy_rows]
        for row in tampered_occ:
            if row["activity_id"] == "A001":
                row["week"] = 21

        result = validate_schedule(
            self.data,
            tampered_access,
            tampered_occ,
            self.results_rows,
            scenario="A",
        )
        self.assertFalse(result["feasible"])
        rules = [v["rule"] for v in result["hard_violations"]]
        self.assertIn("closure_buffer", rules)


if __name__ == "__main__":
    unittest.main()
