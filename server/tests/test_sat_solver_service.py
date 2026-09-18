"""Focused checks for variable linking and hard constraints 1, 2 and 3."""

import unittest
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from ortools.sat.python import cp_model

from server.app.services.sat_solver_service import (
    SatSolverService,
    initialize_optimization_variables,
    add_variable_linking_constraints,
    add_workload_conservation_constraints,
    add_planned_start_date_constraints,
    add_predecessor_precedence_constraints,
    add_closure_and_buffer_constraints,
    add_possession_legal_mix_constraints,
    add_weekly_resource_constraints,
    add_scenario_hard_constraints,
)


def small_problem(workload=4, release=2):
    # Minimal domains isolate these rules from unrelated production data.
    return SimpleNamespace(
        weeks=[1, 2, 3],
        conflicts=[],
        activities={
            "A": SimpleNamespace(
                group_id="h1",
                R=["L"],
                workload_units=workload,
                planned_start_week=release,
                predecessor_activity_id=None,
                access_type="C",
            )
        },
        groups={"h1": SimpleNamespace(local_nights=[1, 2], activities=["A"])},
        possession_group_domains={"L": [1]},
        activities_by_location={"L": ["A"]},
    )


def with_resource_defaults(data):
    """Complete fixtures with permissive resource limits for older rule tests."""
    from server.app.services.csv_preprocessor import preprocess_directory

    data.scenarios = preprocess_directory().scenarios
    data.location_capacity = {
        location: 100 for location in data.possession_group_domains
    }
    data.lines = {"ALP": {}, "BET": {}}
    data.parameters = SimpleNamespace(horizon_weeks=max(data.weeks))
    data.objective_scale = 10
    data.week_end_dates = {
        str(w): (date(2027, 1, 3) + timedelta(weeks=w)).isoformat()
        for w in data.weeks
    }
    data.contracts = {
        "C1": SimpleNamespace(planned_completion_date=data.week_end_dates[str(max(data.weeks))])
    }
    for group in data.groups.values():
        group.number_of_maximum_access_per_week = len(group.local_nights)
        group.number_of_workfronts = 100
    for activity in data.activities.values():
        activity.contract_number = "C1"
        activity.delay_weight_scaled = 10
        activity.deadline_week = max(data.weeks)
        activity.affected_lines = ["ALP"]
    return data


class SolverConstraintTests(unittest.TestCase):
    def build(self, workload=4, release=2):
        data = small_problem(workload, release)
        model = cp_model.CpModel()
        variables = initialize_optimization_variables(model, data)
        self.assertEqual(len(model.proto.constraints), 0)
        add_variable_linking_constraints(model, data, variables)
        add_workload_conservation_constraints(model, data, variables)
        add_planned_start_date_constraints(model, data, variables)
        self.assertEqual(model.validate(), "")
        return model, variables

    def feasible(self, model):
        solver = cp_model.CpSolver()
        return solver.solve(model) in (cp_model.FEASIBLE, cp_model.OPTIMAL)

    def test_standard_accesses_meet_workload(self):
        model, variables = self.build()
        for e in variables.eclo_vars.values():
            model.add(e == 0)
        self.assertTrue(self.feasible(model))

    def test_insufficient_workload_is_infeasible(self):
        model, variables = self.build()
        model.add(sum(variables.activity_access_vars.values()) <= 1)
        self.assertFalse(self.feasible(model))

    def test_eclo_yield_and_start_boundary(self):
        model, variables = self.build(workload=3)
        model.add(variables.activity_access_vars["A", 2, 1] == 1)
        model.add(variables.eclo_vars["A", 2, 1] == 1)
        model.add(sum(variables.activity_access_vars.values()) == 1)
        self.assertTrue(self.feasible(model))

    def test_early_access_and_early_eclo_are_forbidden(self):
        for field in ("activity_access_vars", "eclo_vars"):
            with self.subTest(field=field):
                model, variables = self.build()
                model.add(getattr(variables, field)["A", 1, 1] == 1)
                self.assertFalse(self.feasible(model))

    def test_one_access_per_week(self):
        model, variables = self.build()
        for n in (1, 2):
            model.add(variables.activity_access_vars["A", 2, n] == 1)
        self.assertFalse(self.feasible(model))

    def test_access_requires_route_occupancy(self):
        model, variables = self.build()
        model.add(variables.activity_access_vars["A", 2, 1] == 1)
        model.add(variables.loc_possess_cosharing_vars["A", "L", 2, 1] == 0)
        self.assertFalse(self.feasible(model))

    def test_service_wires_workload_and_start_constraints(self):
        with patch(
            "server.app.services.sat_solver_service.preprocess_directory",
            return_value=with_resource_defaults(small_problem(workload=8)),
        ):
            service = SatSolverService()
        # Only weeks 2 and 3 are available: maximum yield is 6 units.
        self.assertFalse(service.solve())


class PredecessorConstraintTests(unittest.TestCase):
    def check_schedule(
        self,
        predecessor_weeks,
        successor_weeks,
        expected,
        predecessor_nights=1,
        successor_nights=2,
        successor_night=2,
    ):
        data = small_problem(workload=2, release=1)
        data.weeks = [1, 2, 3, 4]
        data.activities["A"].workload_units = 2 * len(predecessor_weeks)
        data.activities["B"] = SimpleNamespace(
            group_id="h2",
            R=["L"],
            workload_units=2,
            planned_start_week=1,
            predecessor_activity_id="A",
            access_type="C",
        )
        data.groups["h1"].local_nights = list(range(1, predecessor_nights + 1))
        data.groups["h2"] = SimpleNamespace(
            local_nights=list(range(1, successor_nights + 1)),
            activities=["B"],
        )
        data.activities_by_location["L"].append("B")
        with patch(
            "server.app.services.sat_solver_service.preprocess_directory",
            return_value=with_resource_defaults(data),
        ):
            service = SatSolverService()
        variables = service.variables
        for (
            activity_id,
            week,
            night,
        ), variable in variables.activity_access_vars.items():
            scheduled_weeks = (
                predecessor_weeks if activity_id == "A" else successor_weeks
            )
            scheduled_night = (
                predecessor_nights if activity_id == "A" else successor_night
            )
            service.model.add(
                variable == int(week in scheduled_weeks and night == scheduled_night)
            )
        for variable in variables.eclo_vars.values():
            service.model.add(variable == 0)
        self.assertEqual(service.model.validate(), "")
        self.assertEqual(service.solve(), expected)

    def test_successor_in_week_after_finish_is_allowed(self):
        self.check_schedule([1, 2], [3], True)

    def test_same_week_is_forbidden_even_with_later_night(self):
        self.check_schedule([2], [2], False)

    def test_one_early_access_does_not_mean_predecessor_finished(self):
        self.check_schedule([1, 3], [2], False)

    def test_predecessor_with_more_local_nights(self):
        self.check_schedule(
            [1, 2],
            [3],
            True,
            predecessor_nights=3,
            successor_nights=1,
            successor_night=1,
        )

    def test_successor_cannot_start_before_predecessor(self):
        self.check_schedule([3], [1], False)

    def test_finish_at_horizon_leaves_no_successor_week(self):
        self.check_schedule([4], [4], False)

    def test_all_successor_accesses_must_follow_finish(self):
        self.check_schedule([2], [1, 3], False)


class ClosureConstraintTests(unittest.TestCase):
    def check_pair(
        self, shared_locations, assignments, expected, conflict=True, weeks=(1, 1)
    ):
        data = small_problem(workload=2, release=1)
        data.activities["A"].R = ["L1", "L2"]
        data.activities["B"] = SimpleNamespace(
            group_id="h2",
            R=["L1", "L2"] if shared_locations else ["L3"],
            workload_units=2,
            planned_start_week=1,
            predecessor_activity_id=None,
            access_type="C",
        )
        data.groups["h2"] = SimpleNamespace(local_nights=[1], activities=["B"])
        data.possession_group_domains = {l: [1, 2] for l in ["L1", "L2", "L3"]}
        data.activities_by_location = {
            l: [a for a, row in data.activities.items() if l in row.R]
            for l in data.possession_group_domains
        }
        data.conflicts = (
            [
                SimpleNamespace(
                    activities=["A", "B"],
                    shared_work_locations=shared_locations,
                )
            ]
            if conflict
            else []
        )
        with patch(
            "server.app.services.sat_solver_service.preprocess_directory",
            return_value=with_resource_defaults(data),
        ):
            service = SatSolverService()
        for (a, w), variable in service.variables.activity_week_access_vars.items():
            service.model.add(variable == int(w == weeks[0 if a == "A" else 1]))
        for a, l, g in assignments:
            w = weeks[0 if a == "A" else 1]
            service.model.add(
                service.variables.loc_possess_cosharing_vars[a, l, w, g] == 1
            )
        self.assertEqual(service.model.validate(), "")
        self.assertEqual(service.solve(), expected)

    def test_external_closure_or_buffer_overlap_blocks_same_week(self):
        self.check_pair([], [], False)

    def test_conflicting_pair_can_run_in_different_weeks(self):
        self.check_pair([], [], True, weeks=(1, 2))

    def test_nonconflicting_pair_can_run_together(self):
        self.check_pair([], [], True, conflict=False)

    def test_same_possession_exempts_pair(self):
        self.check_pair(["L1", "L2"], [("A", "L1", 1), ("B", "L1", 1)], True)

    def test_different_possessions_do_not_exempt_pair(self):
        self.check_pair(
            ["L1", "L2"],
            [
                ("A", "L1", 1),
                ("B", "L1", 2),
                ("A", "L2", 1),
                ("B", "L2", 2),
            ],
            False,
        )

    def test_matching_labels_at_different_locations_do_not_exempt(self):
        self.check_pair(
            ["L1", "L2"],
            [
                ("A", "L1", 1),
                ("B", "L1", 2),
                ("A", "L2", 2),
                ("B", "L2", 1),
            ],
            False,
        )


class PossessionMixConstraintTests(unittest.TestCase):
    def check_mix(self, access_types, expected, separate_groups=False):
        data = small_problem(workload=2, release=1)
        data.weeks = [1]
        data.activities = {
            str(i): SimpleNamespace(
                group_id="h1",
                R=["L"],
                workload_units=2,
                planned_start_week=1,
                predecessor_activity_id=None,
                access_type=access_type,
            )
            for i, access_type in enumerate(access_types)
        }
        data.groups["h1"].activities = list(data.activities)
        data.activities_by_location["L"] = list(data.activities)
        data.possession_group_domains["L"] = list(range(1, len(access_types) + 2))
        with patch(
            "server.app.services.sat_solver_service.preprocess_directory",
            return_value=with_resource_defaults(data),
        ):
            service = SatSolverService()
        for i, activity_id in enumerate(data.activities):
            group = i + 1 if separate_groups else 1
            # Fix z_alwg = 1 to test the requested possession composition.
            service.model.add(
                service.variables.loc_possess_cosharing_vars[activity_id, "L", 1, group]
                == 1
            )
        self.assertEqual(service.model.validate(), "")
        self.assertEqual(service.solve(), expected)

    def test_legal_mixes(self):
        for mix in [
            [],
            ["PM"],
            ["PC"],
            ["PC", "C"],
            ["PC"] + ["C"] * 3,
            ["C"],
            ["C"] * 4,
        ]:
            with self.subTest(mix=mix):
                self.check_mix(mix, True)

    def test_illegal_mixes(self):
        for mix in [
            ["PM", "PM"],
            ["PM", "PC"],
            ["PM", "C"],
            ["PC", "PC"],
            ["PC"] + ["C"] * 4,
            ["C"] * 5,
        ]:
            with self.subTest(mix=mix):
                self.check_mix(mix, False)

    def test_limits_apply_per_possession(self):
        self.check_mix(["PM", "PC", "C", "C", "C"], True, separate_groups=True)


class RemainingHardConstraintTests(unittest.TestCase):
    def build(
        self,
        scenario="C",
        count=1,
        weeks=4,
        capacity=10,
        workfronts=10,
        deadline=None,
        affected_lines=None,
    ):
        data = small_problem(workload=2, release=1)
        data.weeks = list(range(1, weeks + 1))
        prototype = data.activities["A"]
        data.activities = {
            str(i): SimpleNamespace(**vars(prototype)) for i in range(count)
        }
        data.groups["h1"].activities = list(data.activities)
        data.activities_by_location["L"] = list(data.activities)
        data.possession_group_domains["L"] = list(range(1, count + 1))
        with_resource_defaults(data)
        data.location_capacity["L"] = capacity
        data.groups["h1"].number_of_workfronts = workfronts
        for activity in data.activities.values():
            if deadline is not None:
                activity.deadline_week = deadline
            if affected_lines is not None:
                activity.affected_lines = affected_lines
        model = cp_model.CpModel()
        variables = initialize_optimization_variables(model, data)
        add_variable_linking_constraints(model, data, variables)
        add_workload_conservation_constraints(model, data, variables)
        add_weekly_resource_constraints(model, data, variables)
        windows = add_scenario_hard_constraints(model, data, variables, scenario)
        return model, variables, windows

    def feasible(self, model):
        self.assertEqual(model.validate(), "")
        return cp_model.CpSolver().solve(model) in (cp_model.OPTIMAL, cp_model.FEASIBLE)

    def test_workfront_cap_and_separate_nights(self):
        for second_night, expected in [(1, False), (2, True)]:
            model, variables, _ = self.build(count=2, workfronts=1)
            model.add(variables.activity_access_vars["0", 1, 1] == 1)
            model.add(variables.activity_access_vars["1", 1, second_night] == 1)
            self.assertEqual(self.feasible(model), expected)

    def test_supply_caps_by_scenario(self):
        for scenario, slots, expected in [
            ("A", 1, True),
            ("A", 2, False),
            ("C", 2, True),
            ("C", 3, False),
            ("B", 3, True),
        ]:
            with self.subTest(scenario=scenario, slots=slots):
                model, variables, _ = self.build(scenario=scenario, count=3, capacity=1)
                for i in range(slots):
                    model.add(
                        variables.loc_possess_cosharing_vars[str(i), "L", 1, i + 1] == 1
                    )
                self.assertEqual(self.feasible(model), expected)

    def test_shared_possession_consumes_one_slot(self):
        model, variables, _ = self.build(scenario="A", count=2, capacity=1)
        for a in ("0", "1"):
            model.add(variables.loc_possess_cosharing_vars[a, "L", 1, 1] == 1)
        self.assertTrue(self.feasible(model))

    def test_eclo_forbidden_only_in_a(self):
        for scenario in ("A", "B", "C"):
            model, variables, _ = self.build(scenario=scenario)
            model.add(variables.eclo_vars["0", 1, 1] == 1)
            self.assertEqual(self.feasible(model), scenario != "A")

    def test_deadline_boundary_and_no_on_time_week(self):
        for scenario, week, expected in [
            ("B", 2, True),
            ("B", 3, False),
            ("A", 3, True),
            ("C", 3, True),
        ]:
            model, variables, _ = self.build(scenario=scenario, deadline=2)
            model.add(variables.activity_access_vars["0", week, 1] == 1)
            self.assertEqual(self.feasible(model), expected)
        model, _, _ = self.build(scenario="B", deadline=0)
        self.assertFalse(self.feasible(model))

    def test_eclo_window_is_line_wide_and_calendar_contiguous(self):
        for scenario, last_week, expected in [
            ("C", 2, True),
            ("C", 3, False),
            ("B", 3, True),
        ]:
            model, variables, _ = self.build(scenario=scenario, count=2)
            model.add(variables.eclo_vars["0", 1, 1] == 1)
            model.add(variables.eclo_vars["1", last_week, 1] == 1)
            self.assertEqual(self.feasible(model), expected)

    def test_cross_line_eclo_must_fit_both_windows(self):
        model, variables, windows = self.build(affected_lines=["ALP", "BET"])
        model.add(windows["ALP"] == 1)
        model.add(windows["BET"] == 3)
        model.add(variables.eclo_vars["0", 2, 1] == 1)
        self.assertFalse(self.feasible(model))

    def test_single_week_horizon_and_unused_line_window(self):
        model, variables, windows = self.build(weeks=1)
        model.add(variables.eclo_vars["0", 1, 1] == 1)
        self.assertTrue(self.feasible(model))
        self.assertEqual(set(windows), {"ALP", "BET"})

    def test_invalid_scenario_rejected(self):
        with self.assertRaises(ValueError):
            SatSolverService("unknown")


if __name__ == "__main__":
    unittest.main()
