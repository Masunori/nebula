"""Unified standalone deterministic schedule validator and scorer for NebulaX.

Audits any schedule (from submission CSV directories, database rows, or in-memory
UI structures) against the 8 rigid safety constraints and computes competition
soft penalty scores without invoking the CP-SAT optimization solver.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
from datetime import date
import json
from pathlib import Path
from typing import Any, Literal, Mapping, Sequence

from ..models.preprocessed_data import PreparedProblem
from .csv_preprocessor import DEFAULT_DATA_DIR, preprocess_directory

SCHEMAS = {
    "SCHEDULE_ACCESS.csv": "activity_id,access_seq,week,eclo,access_night",
    "SCHEDULE_OCCUPANCY.csv": "activity_id,week,location_id,co_share_group",
    "RESULTS.csv": "scenario,contract_number,simulated_completion_date,overrun_days",
}
INTEGER_FIELDS = {"access_seq", "week", "eclo", "access_night", "overrun_days"}


class InvalidScheduleError(ValueError):
    """A submission cannot be scored because validation failed."""

    def __init__(self, report: dict[str, Any]):
        self.report = report
        violations_count = len(report.get("hard_violations", []))
        super().__init__(f"Schedule has {violations_count} validation violation(s)")


def validate_schedule(
    arg1: str | Path | PreparedProblem,
    arg2: Sequence[Mapping[str, Any]] | PreparedProblem | None = None,
    occupancy_rows: Sequence[Mapping[str, Any]] | None = None,
    results_rows: Sequence[Mapping[str, Any]] | None = None,
    scenario: Literal["A", "B", "C"] | None = None,
) -> dict[str, Any]:
    """Audit a schedule against Problem Statement Section 2.

    Overloaded interface supporting both:
    1. Directory mode: validate_schedule(directory, data, scenario=None)
    2. In-memory mode: validate_schedule(data, access_rows, occupancy_rows, results_rows=None, scenario="A")
    """
    # Dispatch directory mode
    if isinstance(arg1, (str, Path)):
        directory = Path(arg1)
        data = arg2 if isinstance(arg2, PreparedProblem) else preprocess_directory(DEFAULT_DATA_DIR)
        return _validate_directory_internal(directory, data, scenario=scenario)

    # In-memory mode
    if not isinstance(arg1, PreparedProblem):
        raise TypeError(f"Expected PreparedProblem or directory Path, got {type(arg1).__name__}")

    data: PreparedProblem = arg1
    access_rows = arg2 if isinstance(arg2, (list, tuple)) else []
    occ_rows = occupancy_rows if occupancy_rows is not None else []
    res_rows = results_rows

    target_scenario = scenario or "A"
    return _validate_in_memory_rows(data, access_rows, occ_rows, res_rows, scenario=target_scenario)


def _validate_directory_internal(
    directory: Path,
    data: PreparedProblem,
    scenario: Literal["A", "B", "C"] | None = None,
) -> dict[str, Any]:
    """Parse CSV files in directory and run full validation."""
    if scenario is not None and scenario not in ("A", "B", "C"):
        raise ValueError("scenario must be A, B or C")

    errors: list[dict[str, Any]] = []

    def error(tag: str, message: str, **context: Any) -> None:
        errors.append({
            "tag": tag,
            "rule": tag,
            "severity": "hard",
            "message": message,
            "detail": message,
            **context,
        })

    tables: dict[str, list[dict[str, Any]]] = {}
    for name, schema in SCHEMAS.items():
        rows: list[dict[str, Any]] = []
        file_path = directory / name
        try:
            with file_path.open(encoding="utf-8-sig", newline="") as stream:
                reader = csv.DictReader(stream, strict=True)
                fields = schema.split(",")
                if (
                    reader.fieldnames is None
                    or len(reader.fieldnames) != len(fields)
                    or set(reader.fieldnames) != set(fields)
                ):
                    error("schema", "Headers must match: " + schema, file=name, row=1)
                    continue
                for number, raw in enumerate(reader, 2):
                    if None in raw or any(v is None or not v.strip() for v in raw.values()):
                        error("schema", "Missing, blank or extra fields", file=name, row=number)
                        continue
                    row = {k: v.strip() for k, v in raw.items()}
                    try:
                        for field in INTEGER_FIELDS.intersection(row):
                            row[field] = int(row[field])
                            minimum = 0 if field in ("eclo", "overrun_days") else 1
                            if row[field] < minimum or (field == "eclo" and row[field] > 1):
                                raise ValueError(f"Invalid {field}")
                        if "simulated_completion_date" in row:
                            value = row["simulated_completion_date"]
                            if date.fromisoformat(value).isoformat() != value:
                                raise ValueError("Date must be YYYY-MM-DD")
                    except ValueError as exc:
                        error("value", str(exc), file=name, row=number)
                        continue
                    row["_row"] = number
                    rows.append(row)
        except (OSError, UnicodeError, csv.Error) as exc:
            error("csv", str(exc), file=name)
        tables[name] = rows

    report: dict[str, Any] = {
        "scenario": scenario,
        "feasible": False,
        "hard_violations": errors,
        "soft_scores": {},
        "detail": {"validation_scope": "Independent CSV checks; pairwise co-sharing interpretation"},
        "validation_log": [],
    }

    if errors:
        return report

    access = tables["SCHEDULE_ACCESS.csv"]
    occupancy = tables["SCHEDULE_OCCUPANCY.csv"]
    results = tables["RESULTS.csv"]
    scenarios = {r["scenario"] for r in results}

    if len(scenarios) != 1 or not scenarios <= {"A", "B", "C"}:
        error("scenario", "RESULTS.csv must contain exactly one scenario A, B or C")
    elif scenario is not None and scenarios != {scenario}:
        error("scenario", "RESULTS.csv does not match requested scenario")
    else:
        scenario = next(iter(scenarios))
        report["scenario"] = scenario

    return _validate_in_memory_rows(
        data,
        access,
        occupancy,
        results,
        scenario=scenario or "A",
        initial_errors=errors,
        directory_mode=True,
    )


def _validate_in_memory_rows(
    data: PreparedProblem,
    access_rows: Sequence[Mapping[str, Any]],
    occupancy_rows: Sequence[Mapping[str, Any]],
    results_rows: Sequence[Mapping[str, Any]] | None = None,
    scenario: Literal["A", "B", "C"] = "A",
    initial_errors: list[dict[str, Any]] | None = None,
    directory_mode: bool = False,
) -> dict[str, Any]:
    """Perform deterministic 8-rule audit across rows in memory."""
    if scenario not in ("A", "B", "C"):
        raise ValueError(f"Unsupported scenario: {scenario}")

    hard_violations: list[dict[str, Any]] = list(initial_errors or [])
    validation_log: list[dict[str, Any]] = []

    def error(
        tag: str,
        message: str,
        week: int = 0,
        location_id: str = "",
        activity_id: str = "",
        contract: str = "",
        **context: Any,
    ) -> None:
        entry = {
            "tag": tag,
            "rule": tag,
            "severity": "hard",
            "message": message,
            "detail": message,
            **context,
        }
        hard_violations.append(entry)
        validation_log.append({
            "id": f"viol-{len(hard_violations)}",
            "severity": "error",
            "rule": tag,
            "tag": tag,
            "week": week,
            "calendarWeek": f"CW{week:02d}" if week else "N/A",
            "locationId": location_id,
            "activityId": activity_id,
            "contractNumber": contract,
            "message": message,
            "timetableCellKey": f"{activity_id}:{week}:{location_id}" if activity_id and week else "",
        })

    # Validate referential integrity against problem definition
    for r in access_rows:
        aid = str(r.get("activity_id", ""))
        w = int(r.get("week", 0))
        if aid not in data.activities:
            error("reference", "Unknown activity", week=w, activity_id=aid)
        if w not in data.weeks:
            error("week", "Week outside planning horizon", week=w, activity_id=aid)

    for r in occupancy_rows:
        loc = str(r.get("location_id", ""))
        w = int(r.get("week", 0))
        aid = str(r.get("activity_id", ""))
        if loc not in data.locations:
            error("reference", "Unknown location", week=w, location_id=loc, activity_id=aid)
        if w not in data.weeks:
            error("week", "Week outside planning horizon", week=w, location_id=loc, activity_id=aid)

    settings = data.scenarios[scenario]
    by_activity: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    nights: dict[tuple[str, int], set[int]] = defaultdict(set)
    fronts: Counter = Counter()
    eclo_weeks: dict[str, set[int]] = defaultdict(set)

    for row in access_rows:
        a = str(row["activity_id"])
        w = int(row["week"])
        n = int(row["access_night"])
        eclo = int(row.get("eclo", 0))

        if a not in data.activities:
            continue

        activity = data.activities[a]
        group = data.groups[activity.group_id]
        by_activity[a].append(row)
        nights[activity.group_id, w].add(n)
        fronts[activity.group_id, w, n] += 1

        if n not in group.local_nights:
            error("access_night", "Night outside contract/type local domain", week=w, activity_id=a)
        if w < activity.planned_start_week:
            error("planned_start", "Access before planned start", week=w, activity_id=a)
        if eclo:
            if not settings.eclo_allowed:
                error("eclo", "ECLO forbidden in scenario A", week=w, activity_id=a)
            for line in activity.affected_lines:
                eclo_weeks[line].add(w)

    finish: dict[str, int] = {}
    for a, activity in data.activities.items():
        rows = sorted(by_activity[a], key=lambda r: (int(r["week"]), int(r["access_night"])))
        weeks = [int(r["week"]) for r in rows]
        if len(set(weeks)) != len(weeks):
            error("weekly_access", "At most one access per activity per week", activity_id=a)
        if [int(r["access_seq"]) for r in rows] != list(range(1, len(rows) + 1)):
            error("access_seq", "Sequence must be chronological and contiguous from 1", activity_id=a)
        if sum(2 + int(r.get("eclo", 0)) for r in rows) < activity.workload_units:
            error("workload", "Insufficient delivered workload", activity_id=a)
        if rows:
            finish[a] = max(weeks)
            if settings.hard_deadline and finish[a] > activity.deadline_week:
                error("planned_date", "Completion after planned deadline", activity_id=a)

    for a, activity in data.activities.items():
        pred = activity.predecessor_activity_id
        if pred and a in finish and pred in finish:
            if min(int(r["week"]) for r in by_activity[a]) <= finish[pred]:
                error("predecessor", "Successor must start after predecessor's final week", activity_id=a, predecessor=pred)

    for (h, w), used in nights.items():
        if len(used) > data.groups[h].number_of_maximum_access_per_week:
            error("weekly_allocation", "Too many local nights", group=h, week=w)

    for (h, w, n), count in fronts.items():
        if count > data.groups[h].number_of_workfronts:
            error("workfronts", "Concurrent workfront limit exceeded", group=h, week=w, access_night=n)

    for line, e_wks in eclo_weeks.items():
        if settings.eclo_window_weeks is not None and (max(e_wks) - min(e_wks) >= settings.eclo_window_weeks):
            error("eclo_window", "ECLO exceeds contiguous line-wide window", line=line)

    expected = {(str(r["activity_id"]), int(r["week"]), loc) for r in access_rows if str(r.get("activity_id", "")) in data.activities for loc in data.activities[str(r["activity_id"])].R}
    actual = Counter((str(r["activity_id"]), int(r["week"]), str(r["location_id"])) for r in occupancy_rows)

    for key in sorted(expected - actual.keys()):
        error("occupancy", "Missing route occupancy", activity_id=key[0], week=key[1], location_id=key[2])
    for key, count in actual.items():
        if key not in expected or count != 1:
            error("occupancy", "Unexpected or duplicate route occupancy", activity_id=key[0], week=key[1], location_id=key[2])

    possessions: dict[tuple[str, int, str], set[str]] = defaultdict(set)
    membership: dict[tuple[str, int], set[tuple[str, str]]] = defaultdict(set)
    used_groups: dict[tuple[str, int], set[str]] = defaultdict(set)

    for r in occupancy_rows:
        a = str(r["activity_id"])
        w = int(r["week"])
        loc = str(r["location_id"])
        g = str(r.get("co_share_group", "0"))
        possessions[loc, w, g].add(a)
        membership[a, w].add((loc, g))
        used_groups[loc, w].add(g)

    for (loc, w, g), members in possessions.items():
        counts = Counter(data.activities[a].access_type for a in members if a in data.activities)
        if counts["PM"] + counts["PC"] > 1 or counts["C"] + counts["PC"] + 4 * counts["PM"] > 4:
            error("possession_mix", "Illegal possession sharing mix", location_id=loc, week=w, co_share_group=g)

    active_weeks = {a: {int(r["week"]) for r in rows} for a, rows in by_activity.items()}
    access_nights = {(str(r["activity_id"]), int(r["week"])): int(r["access_night"]) for r in access_rows}

    for conflict in data.conflicts:
        a, b = conflict.activities
        for w in sorted(active_weeks.get(a, set()) & active_weeks.get(b, set())):
            if membership[a, w].intersection(membership[b, w]):
                continue
            is_live_a = getattr(data.activities.get(a), "nature_of_activity", "") == "Live"
            is_live_b = getattr(data.activities.get(b), "nature_of_activity", "") == "Live"
            if is_live_a or is_live_b:
                error(
                    "closure_buffer",
                    "Activity inside another group's live closure zone",
                    activities=[a, b],
                    week=w,
                    locations=conflict.locations,
                )
                continue
            c_a = getattr(data.activities.get(a), "contract_number", None)
            c_b = getattr(data.activities.get(b), "contract_number", None)
            n_a = access_nights.get((a, w))
            n_b = access_nights.get((b, w))
            if (c_a is not None and c_a == c_b and n_a is not None and n_a == n_b) or (c_a is None and c_b is None):
                error(
                    "closure_buffer",
                    "Conflicting activities without shared possession",
                    activities=[a, b],
                    week=w,
                    locations=conflict.locations,
                )

    capacity_hotspots = []
    for (loc, w), grps in sorted(used_groups.items()):
        capacity = data.location_capacity.get(loc, 0)
        excess = max(0, len(grps) - capacity)
        if excess:
            capacity_hotspots.append({
                "location_id": loc,
                "week": w,
                "used": len(grps),
                "capacity": capacity,
                "excess": excess,
            })
        if settings.max_supply_excess is not None and excess > settings.max_supply_excess:
            error("capacity", "Location weekly capacity allowance exceeded", location_id=loc, week=w, excess=excess)

    expected_results: dict[str, tuple[str, int]] = {}
    for c, contract in data.contracts.items():
        members = data.activities_by_contract.get(c, [])
        if members and all(a in finish for a in members):
            completed = data.week_end_dates[str(max(finish[a] for a in members))]
            overrun = max(0, (date.fromisoformat(completed) - date.fromisoformat(contract.planned_completion_date)).days)
            expected_results[c] = (completed, overrun)

    if results_rows is not None and len(results_rows) > 0:
        result_counts = Counter(str(r.get("contract_number", "")) for r in results_rows)
        for c in data.contracts:
            if result_counts[c] != 1:
                error("results", "Expected exactly one result per contract", contract_number=c)
        for r in results_rows:
            c = str(r.get("contract_number", ""))
            sim_date = str(r.get("simulated_completion_date", ""))
            try:
                overrun = int(r.get("overrun_days") or 0)
            except (ValueError, TypeError):
                overrun = 0
            if c in expected_results and (sim_date, overrun) != expected_results[c]:
                error("results", "Completion date or overrun disagrees with scheduled accesses", contract_number=c)

    feasible = len(hard_violations) == 0

    report: dict[str, Any] = {
        "scenario": scenario,
        "feasible": feasible,
        "hard_violations": hard_violations,
        "soft_scores": {},
        "detail": {
            "validation_scope": "Unified deterministic 8-rule auditor against Problem Statement Section 2",
            "capacity_hotspots": capacity_hotspots,
            "nights_scheduled": len(access_rows),
            "eclo_nights": sum(int(r.get("eclo", 0)) for r in access_rows),
        },
        "validation_log": validation_log,
    }

    if not feasible:
        return report

    # Soft Penalty Scoring Calculation
    priority_overrun = {"1": 0, "2": 0, "3": 0}
    overrun_total = 0
    earliness_days_total = 0
    weighted_scaled = 0

    for aid, act in data.activities.items():
        if aid in finish:
            finish_w = finish[aid]
            completed_str = data.week_end_dates.get(str(finish_w))
            if completed_str:
                completed = date.fromisoformat(completed_str)
                contract = data.contracts[act.contract_number]
                planned = date.fromisoformat(contract.planned_completion_date)
                delta = (completed - planned).days
                overrun = max(0, delta)
                overrun_total += overrun
                earliness_days_total += max(0, -delta)
                priority_overrun[str(contract.contract_priority)] += overrun
                weighted_scaled += act.delay_weight_scaled * overrun

    excess_total = sum(h["excess"] for h in capacity_hotspots)
    eclo_total = sum(int(r.get("eclo", 0)) for r in access_rows)
    weighted_score = weighted_scaled / data.objective_scale

    if scenario == "A":
        math_score = weighted_score
    elif scenario == "B":
        math_score = 7 * excess_total + 5 * eclo_total
    else:  # Scenario C
        math_score = weighted_score + 7 * excess_total + 5 * eclo_total

    total_penalty = round(weighted_score + (7 * excess_total + 5 * eclo_total if scenario != "A" else 0), 1)
    contracts_overrunning = sum(overrun > 0 for _, overrun in expected_results.values())

    report["soft_scores"] = {
        "scenario": scenario,
        "overrun_days_total": overrun_total,
        "contracts_overrunning": contracts_overrunning,
        "earliness_days_total": earliness_days_total,
        "excess_access_nights_total": excess_total,
        "eclo_nights_total": eclo_total,
        "priority_overrun": priority_overrun,
        "priority_weighted_score": round(weighted_score, 1),
        "delay_penalty": round(weighted_score, 1),
        "capacity_penalty": round(7 * excess_total + 5 * eclo_total, 1),
        "penalty_score": total_penalty,
        "objective_score": round(math_score if (scenario != "B" or math_score > 0) else total_penalty, 1),
    }

    return report


def validate_directory(
    directory: str | Path,
    input_directory: str | Path = DEFAULT_DATA_DIR,
    scenario: str | None = None,
) -> dict[str, Any]:
    """Preprocess the eight source CSVs and validate a submission directory."""
    data = preprocess_directory(input_directory)
    return validate_schedule(directory, data, scenario=scenario)


def score_directory(
    directory: str | Path,
    input_directory: str | Path = DEFAULT_DATA_DIR,
    scenario: str | None = None,
) -> dict[str, Any]:
    """Return independently calculated scores; reject invalid submissions."""
    report = validate_directory(directory, input_directory, scenario)
    if not report["feasible"]:
        raise InvalidScheduleError(report)
    return report["soft_scores"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["validate", "score"])
    parser.add_argument("directory", type=Path)
    parser.add_argument("--input-directory", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--scenario", choices=["A", "B", "C"])
    args = parser.parse_args()
    try:
        report = validate_directory(args.directory, args.input_directory, args.scenario)
    except (OSError, ValueError) as exc:
        print(json.dumps({"error": str(exc)}))
        raise SystemExit(2)

    print(json.dumps(report["soft_scores"] if args.command == "score" and report["feasible"] else report, indent=2))
    raise SystemExit(0 if report["feasible"] else 1)


if __name__ == "__main__":
    main()
