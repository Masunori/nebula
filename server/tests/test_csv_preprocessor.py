import csv
import io
import json
import unittest

from pydantic import ValidationError
from server.app.models.preprocessed_data import PreparedProblem, ActivityData

from server.app.services.csv_preprocessor import (
    DEFAULT_DATA_DIR,
    SCHEMAS,
    DatasetValidationError,
    preprocess_csv_files,
    preprocess_directory,
)


class PreprocessingTests(unittest.TestCase):
    def setUp(self):
        self.files = {name: (DEFAULT_DATA_DIR / name).read_text() for name in SCHEMAS}

    def edit(self, filename, row_number, **changes):
        reader = csv.DictReader(io.StringIO(self.files[filename]))
        rows = list(reader)
        rows[row_number].update(changes)
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=reader.fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        self.files[filename] = output.getvalue()

    def test_current_dataset_and_json_roundtrip(self):
        data = preprocess_directory()
        self.assertEqual(
            (len(data.activities), len(data.contracts), len(data.locations)),
            (54, 14, 76),
        )
        self.assertIsInstance(data, PreparedProblem)
        self.assertIsInstance(data.activities["A001"], ActivityData)
        self.assertEqual(
            PreparedProblem.model_validate_json(data.model_dump_json()), data
        )
        self.assertEqual(
            json.loads(data.model_dump_json()), data.model_dump(mode="json")
        )
        self.assertEqual(data.week_end_dates["1"], "2027-01-10")
        self.assertEqual(data.activities["A001"].planned_start_week, 21)
        self.assertEqual(data.activities["A001"].deadline_week, 23)
        self.assertEqual(data.activities["A001"].delay_weight_scaled, 12)
        self.assertLess(
            data.topological_order.index("A003"), data.topological_order.index("A004")
        )

    def test_models_reject_invalid_types_and_unknown_fields(self):
        payload = preprocess_directory().model_dump()
        payload["activities"]["A001"]["workload_units"] = "4"
        with self.assertRaises(ValidationError):
            PreparedProblem.model_validate(payload)
        payload["activities"]["A001"]["workload_units"] = 4
        payload["activities"]["A001"]["unknown_field"] = True
        with self.assertRaises(ValidationError):
            PreparedProblem.model_validate(payload)

    def test_additional_parameters_are_preserved(self):
        self.files["06_PARAMETERS.csv"] += "custom_setting,example\n"
        data = preprocess_csv_files(self.files)
        self.assertEqual(data.parameters.model_dump()["custom_setting"], "example")

    def test_route_includes_all_platforms_and_tunnels(self):
        a = preprocess_csv_files(self.files).activities["A001"]
        self.assertEqual(
            set(a.R),
            {
                "SEC:BET:S15_S16:EB",
                "SEC:BET:S16_S17:EB",
                "PLAT:BET:S15:EB",
                "PLAT:BET:S16:EB",
                "PLAT:BET:S17:EB",
            },
        )
        self.assertEqual(
            set(a.B),
            {
                "SEC:BET:H02_S15:EB",
                "PLAT:BET:H02:EB",
                "SEC:BET:S17_S18:EB",
                "PLAT:BET:S18:EB",
            },
        )
        self.assertEqual(a.INT, [])
        self.assertEqual(a.MIR, [])

    def test_live_interchange_and_mirror(self):
        a = preprocess_csv_files(self.files).activities["A074"]
        self.assertEqual(a.affected_lines, ["ALP", "BET"])
        self.assertEqual(len(a.INT), 22)
        self.assertIn("SEC:ALP:S03_S04:WB", a.MIR)
        self.assertIn("PLAT:BET:H01:WB", a.INT)
        self.assertEqual(set(a.C), set(a.R) | set(a.X))

    def test_external_validator_interchange_closure_regressions(self):
        data = preprocess_csv_files(self.files)
        cases = [
            ("A074", "A001", {"PLAT:BET:S15:EB", "PLAT:BET:S16:EB", "SEC:BET:S15_S16:EB"}),
            ("A074", "A011", {"PLAT:BET:S15:EB", "PLAT:BET:S16:EB", "SEC:BET:S15_S16:EB"}),
            ("A074", "A021", {"PLAT:BET:S13:WB"}),
            ("A074", "A039", {"PLAT:BET:S13:WB", "PLAT:BET:S14:WB", "SEC:BET:S13_S14:WB"}),
            ("A075", "A023", {"PLAT:ALP:S03:WB", "PLAT:ALP:S04:WB", "SEC:ALP:S03_S04:WB"}),
            ("A075", "A025", {"PLAT:ALP:S03:EB"}),
        ]
        for source, target, expected in cases:
            with self.subTest(source=source, target=target):
                self.assertEqual(set(data.activities[source].INT) & set(data.activities[target].R), expected)
                self.assertIn(target, data.conflicts_by_activity[source])
        # Expansion stops after two sectors; it must not close the whole line.
        self.assertNotIn("PLAT:BET:S17:EB", data.activities["A074"].INT)
        self.assertNotIn("PLAT:ALP:S02:WB", data.activities["A075"].INT)

    def test_clipped_buffers_and_reversed_route(self):
        self.edit(
            "08_ACTIVITY_DETAILS.csv",
            0,
            start_location_id="SEC:BET:S12_S13:WB",
            end_location_id="SEC:BET:S11_S12:WB",
        )
        a = preprocess_csv_files(self.files).activities["A001"]
        self.assertEqual(len(a.R), 5)
        self.assertEqual(set(a.B), {"SEC:BET:S13_S14:WB", "PLAT:BET:S14:WB"})

    def test_platform_only_and_non_live_others(self):
        self.edit(
            "08_ACTIVITY_DETAILS.csv",
            11,
            start_location_id="PLAT:ALP:S08:EB",
            end_location_id="PLAT:ALP:S08:EB",
        )
        a = preprocess_csv_files(self.files).activities["A014"]
        self.assertEqual(a.R, ["PLAT:ALP:S08:EB"])
        self.assertEqual(a.X, [])

    def test_conflict_index_matches_documented_relation(self):
        data = preprocess_csv_files(self.files)
        expected = set()
        ids = sorted(data.activities)
        for i, a in enumerate(ids):
            aa = data.activities[a]
            for b in ids[i + 1 :]:
                bb = data.activities[b]
                if (
                    set(aa.R) & set(bb.C)
                    or set(bb.R) & set(aa.C)
                    or set(aa.B) & set(bb.B)
                ):
                    expected.add((a, b))
        self.assertEqual({tuple(c.activities) for c in data.conflicts}, expected)
        for loc, members in data.activities_by_location.items():
            self.assertEqual(len(data.possession_group_domains[loc]), len(members))

    def test_cycle_and_unknown_predecessor(self):
        self.edit("08_ACTIVITY_DETAILS.csv", 2, predecessor_activity_id="A004")
        with self.assertRaisesRegex(DatasetValidationError, "cycle"):
            preprocess_csv_files(self.files)
        self.edit("08_ACTIVITY_DETAILS.csv", 2, predecessor_activity_id="missing")
        with self.assertRaisesRegex(DatasetValidationError, "unknown predecessor"):
            preprocess_csv_files(self.files)

    def test_invalid_rows_and_references(self):
        for changes, message in [
            ({"total_accesses": "1.5"}, "total_accesses"),
            ({"start_location_id": "missing"}, "endpoint"),
            ({"activity_type": "missing"}, "contract/activity_type"),
            ({"planned_start_date": "bad"}, "planned_start_date"),
            ({"end_location_id": "SEC:ALP:S01_S02:EB"}, "same line"),
        ]:
            with self.subTest(changes=changes):
                self.setUp()
                self.edit("08_ACTIVITY_DETAILS.csv", 0, **changes)
                with self.assertRaisesRegex(DatasetValidationError, message):
                    preprocess_csv_files(self.files)

    def test_duplicate_activity_missing_file_and_bom(self):
        self.files["01_LINES.csv"] = "\ufeff" + self.files["01_LINES.csv"]
        preprocess_csv_files(self.files)
        self.edit("08_ACTIVITY_DETAILS.csv", 1, activity_id="A001")
        with self.assertRaisesRegex(DatasetValidationError, "duplicate key"):
            preprocess_csv_files(self.files)
        del self.files["01_LINES.csv"]
        with self.assertRaisesRegex(DatasetValidationError, "eight"):
            preprocess_csv_files(self.files)

    def test_dates_outside_horizon_are_not_silently_clamped(self):
        self.edit("08_ACTIVITY_DETAILS.csv", 0, planned_start_date="2028-01-01")
        data = preprocess_csv_files(self.files)
        self.assertEqual(data.activities["A001"].eligible_weeks, [])
        self.assertTrue(data.warnings)


if __name__ == "__main__":
    unittest.main()
