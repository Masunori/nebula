"""Extract solver assignments, calculate report metrics, and export submission CSVs."""

import csv
from collections import defaultdict
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory

from ortools.sat.python import cp_model

from .csv_preprocessor import DEFAULT_DATA_DIR
from .sat_solver_service import SatSolverService

OUTPUT_DIR = DEFAULT_DATA_DIR / "actual_output"
CSV_FIELDS = {
    "SCHEDULE_ACCESS.csv": [
        "activity_id",
        "access_seq",
        "week",
        "eclo",
        "access_night",
    ],
    "SCHEDULE_OCCUPANCY.csv": ["activity_id", "week", "location_id", "co_share_group"],
    "RESULTS.csv": [
        "scenario",
        "contract_number",
        "simulated_completion_date",
        "overrun_days",
    ],
}


def build_result(service: SatSolverService) -> tuple[dict, dict[str, list[dict]]]:
    """Extract a solved model into a problem-statement report and CSV rows.

    Args:
        service: Service whose solve() has completed and recorded its status.

    Returns:
        (report, tables). Tables are empty if no feasible assignment was found.
        Scores describe the assignment; no objective optimization is claimed.
        An UNKNOWN status means no solution found within the limit, not proven
        infeasibility. Hard violations are not fabricated from solver status.

    Raises:
        ValueError: If solve() has not been called.
    """
    if service.status is None:
        raise ValueError("Call solve() before extracting results")
    feasible = service.status in (cp_model.FEASIBLE, cp_model.OPTIMAL)
    report = {
        "scenario": service.scenario,
        "feasible": feasible,
        "hard_violations": [],
        "soft_scores": {},
        "detail": {
            "solver_status": service.solver.status_name(service.status),
            "wall_time_seconds": service.solver.wall_time,
            "objective_optimized": False,
            "validation_scope": "Implemented CP-SAT model; pairwise co-sharing interpretation",
            "capacity_hotspots": [],
            "nights_scheduled": 0,
            "eclo_nights": 0,
            "csv_written": False,
        },
    }
    if not feasible:
        report["detail"]["message"] = {
            cp_model.INFEASIBLE: "The implemented model is infeasible within the planning horizon.",
            cp_model.UNKNOWN: "No solution found within the search limit; infeasibility is not proven.",
            cp_model.MODEL_INVALID: "The CP-SAT model is invalid.",
        }.get(service.status, "No feasible assignment is available.")
        return report, {}

    data, variables = service.data, service.variables
    tables = {name: [] for name in CSV_FIELDS}
    finish = {}
    sequence = defaultdict(int)
    for (activity, week, night), variable in sorted(
        variables.activity_access_vars.items()
    ):
        if service.get_value(variable):
            sequence[activity] += 1
            finish[activity] = max(finish.get(activity, 0), week)
            tables["SCHEDULE_ACCESS.csv"].append(
                {
                    "activity_id": activity,
                    "access_seq": sequence[activity],
                    "week": week,
                    "eclo": service.get_value(
                        variables.eclo_vars[activity, week, night]
                    ),
                    "access_night": night,
                }
            )
    used_groups = defaultdict(set)
    for (activity, location, week, group), variable in sorted(
        variables.loc_possess_cosharing_vars.items()
    ):
        if service.get_value(variable):
            tables["SCHEDULE_OCCUPANCY.csv"].append(
                {
                    "activity_id": activity,
                    "week": week,
                    "location_id": location,
                    "co_share_group": f"b{group}",
                }
            )
            used_groups[location, week].add(group)
    tables["SCHEDULE_OCCUPANCY.csv"].sort(
        key=lambda r: (r["activity_id"], r["week"], r["location_id"])
    )

    priority_overrun = {"1": 0, "2": 0, "3": 0}
    weighted_scaled = 0
    overrun_total = earliness_total = 0
    for activity_id, activity in data.activities.items():
        completed = date.fromisoformat(data.week_end_dates[str(finish[activity_id])])
        contract = data.contracts[activity.contract_number]
        delta = (completed - date.fromisoformat(contract.planned_completion_date)).days
        overrun = max(0, delta)
        overrun_total += overrun
        earliness_total += max(0, -delta)
        priority_overrun[str(contract.contract_priority)] += overrun
        weighted_scaled += activity.delay_weight_scaled * overrun
    for contract_id, contract in data.contracts.items():
        members = data.activities_by_contract[contract_id]
        if not members:
            raise ValueError(
                f"Cannot report completion for contract {contract_id} without activities"
            )
        completed = data.week_end_dates[str(max(finish[a] for a in members))]
        tables["RESULTS.csv"].append(
            {
                "scenario": service.scenario,
                "contract_number": contract_id,
                "simulated_completion_date": completed,
                "overrun_days": max(
                    0,
                    (
                        date.fromisoformat(completed)
                        - date.fromisoformat(contract.planned_completion_date)
                    ).days,
                ),
            }
        )
    hotspots = []
    for (location, week), groups in sorted(used_groups.items()):
        excess = max(0, len(groups) - data.location_capacity[location])
        if excess:
            hotspots.append(
                {
                    "location_id": location,
                    "week": week,
                    "used": len(groups),
                    "capacity": data.location_capacity[location],
                    "excess": excess,
                }
            )
    excess_total = sum(row["excess"] for row in hotspots)
    eclo_total = sum(row["eclo"] for row in tables["SCHEDULE_ACCESS.csv"])
    weighted = weighted_scaled / data.objective_scale
    score = (weighted if service.scenario != "B" else 0) + (
        7 * excess_total + 5 * eclo_total if service.scenario != "A" else 0
    )
    report["soft_scores"] = {
        "scenario": service.scenario,
        "overrun_days_total": overrun_total,
        "contracts_overrunning": sum(
            row["overrun_days"] > 0 for row in tables["RESULTS.csv"]
        ),
        "earliness_days_total": earliness_total,
        "excess_access_nights_total": excess_total,
        "eclo_nights_total": eclo_total,
        "priority_overrun": priority_overrun,
        "priority_weighted_score": weighted,
        "objective_score": score,
    }
    report["detail"].update(
        capacity_hotspots=hotspots,
        nights_scheduled=len(tables["SCHEDULE_ACCESS.csv"]),
        eclo_nights=eclo_total,
    )
    return report, tables


def write_result_csvs(
    tables: dict[str, list[dict]], directory: Path = OUTPUT_DIR
) -> None:
    """Stage and replace the three submission CSVs after a successful solve.

    Args:
        tables: All three table names mapped to rows from build_result().
        directory: Output directory; created if needed. Existing CSVs are replaced.

    Returns:
        None. Each file is replaced atomically; callers must serialize batches.
        Failed/unknown solves must not call this function or overwrite prior output.
    """
    if set(tables) != set(CSV_FIELDS):
        raise ValueError("Expected all three result tables")
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=directory) as staging:
        for name, fields in CSV_FIELDS.items():
            with (Path(staging) / name).open(
                "w", newline="", encoding="utf-8"
            ) as stream:
                writer = csv.DictWriter(stream, fieldnames=fields)
                writer.writeheader()
                writer.writerows(tables[name])
        for name in CSV_FIELDS:
            (Path(staging) / name).replace(directory / name)
