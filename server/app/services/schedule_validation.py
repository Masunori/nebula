"""Independently validate and score submission CSVs; never invokes CP-SAT.

Uses the documented pairwise co-sharing interpretation and input preprocessing
for topology/footprints. Scores are withheld when any validation check fails.
"""

import argparse
import csv
import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from .csv_preprocessor import DEFAULT_DATA_DIR, preprocess_directory
from ..models.preprocessed_data import PreparedProblem

SCHEMAS = {
    "SCHEDULE_ACCESS.csv": "activity_id,access_seq,week,eclo,access_night",
    "SCHEDULE_OCCUPANCY.csv": "activity_id,week,location_id,co_share_group",
    "RESULTS.csv": "scenario,contract_number,simulated_completion_date,overrun_days",
}
INTEGER_FIELDS = {"access_seq", "week", "eclo", "access_night", "overrun_days"}


class InvalidScheduleError(ValueError):
    """A submission cannot be scored because validation failed."""

    def __init__(self, report):
        self.report = report
        super().__init__(f"Schedule has {len(report['hard_violations'])} validation violation(s)")


def validate_schedule(directory: str | Path, data: PreparedProblem, scenario: str | None = None) -> dict:
    """Read all three CSVs and return violations plus scores for a valid schedule.

    Scenario is inferred from RESULTS.csv unless supplied explicitly, in which
    case every result must match it. Row numbers include the header. CSV errors
    are reported, not raised; invalid input datasets are the preprocessor's job.
    """
    if scenario is not None and scenario not in ("A", "B", "C"):
        raise ValueError("scenario must be A, B or C")
    errors = []

    def error(tag, message, **context):
        errors.append({"tag": tag, "message": message, **context})

    report = {
        "scenario": scenario, "feasible": False, "hard_violations": errors,
        "soft_scores": {},
        "detail": {"validation_scope": "Independent CSV checks; pairwise co-sharing interpretation"},
    }
    tables = {}
    for name, schema in SCHEMAS.items():
        rows = []
        try:
            with (Path(directory) / name).open(encoding="utf-8-sig", newline="") as stream:
                reader = csv.DictReader(stream, strict=True)
                fields = schema.split(",")
                if reader.fieldnames is None or len(reader.fieldnames) != len(fields) or set(reader.fieldnames) != set(fields):
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

    for name, rows in tables.items():
        for row in rows:
            context = {"file": name, "row": row["_row"]}
            if "activity_id" in row and row["activity_id"] not in data.activities:
                error("reference", "Unknown activity", **context)
            if "contract_number" in row and row["contract_number"] not in data.contracts:
                error("reference", "Unknown contract", **context)
            if "location_id" in row and row["location_id"] not in data.locations:
                error("reference", "Unknown location", **context)
            if "week" in row and row["week"] not in data.weeks:
                error("week", "Week outside planning horizon", **context)
    if errors:
        return report

    settings = data.scenarios[scenario]
    by_activity = defaultdict(list)
    nights = defaultdict(set)
    fronts = Counter()
    eclo_weeks = defaultdict(set)
    for row in access:
        a, w, n = row["activity_id"], row["week"], row["access_night"]
        activity = data.activities[a]
        group = data.groups[activity.group_id]
        by_activity[a].append(row)
        nights[activity.group_id, w].add(n)
        fronts[activity.group_id, w, n] += 1
        if n not in group.local_nights:
            error("access_night", "Night outside contract/type local domain", activity_id=a, week=w)
        if w < activity.planned_start_week:
            error("planned_start", "Access before planned start", activity_id=a, week=w)
        if row["eclo"]:
            if not settings.eclo_allowed:
                error("eclo", "ECLO forbidden in scenario A", activity_id=a, week=w)
            for line in activity.affected_lines:
                eclo_weeks[line].add(w)

    finish = {}
    for a, activity in data.activities.items():
        rows = sorted(by_activity[a], key=lambda r: (r["week"], r["access_night"]))
        weeks = [r["week"] for r in rows]
        if len(set(weeks)) != len(weeks):
            error("weekly_access", "At most one access per activity per week", activity_id=a)
        if [r["access_seq"] for r in rows] != list(range(1, len(rows) + 1)):
            error("access_seq", "Sequence must be chronological and contiguous from 1", activity_id=a)
        if sum(2 + r["eclo"] for r in rows) < activity.workload_units:
            error("workload", "Insufficient delivered workload", activity_id=a)
        if rows:
            finish[a] = max(weeks)
            if settings.hard_deadline and finish[a] > activity.deadline_week:
                error("planned_date", "Completion after planned deadline", activity_id=a)
    for a, activity in data.activities.items():
        pred = activity.predecessor_activity_id
        if pred and a in finish and pred in finish:
            if min(r["week"] for r in by_activity[a]) <= finish[pred]:
                error("predecessor", "Successor must start after predecessor's final week", activity_id=a, predecessor=pred)
    for (h, w), used in nights.items():
        if len(used) > data.groups[h].number_of_maximum_access_per_week:
            error("weekly_allocation", "Too many local nights", group=h, week=w)
    for (h, w, n), count in fronts.items():
        if count > data.groups[h].number_of_workfronts:
            error("workfronts", "Concurrent workfront limit exceeded", group=h, week=w, access_night=n)
    for line, weeks in eclo_weeks.items():
        if settings.eclo_window_weeks is not None and max(weeks) - min(weeks) >= settings.eclo_window_weeks:
            error("eclo_window", "ECLO exceeds contiguous line-wide window", line=line)

    expected = {(r["activity_id"], r["week"], loc) for r in access for loc in data.activities[r["activity_id"]].R}
    actual = Counter((r["activity_id"], r["week"], r["location_id"]) for r in occupancy)
    for key in sorted(expected - actual.keys()):
        error("occupancy", "Missing route occupancy", activity_id=key[0], week=key[1], location_id=key[2])
    for key, count in actual.items():
        if key not in expected or count != 1:
            error("occupancy", "Unexpected or duplicate route occupancy", activity_id=key[0], week=key[1], location_id=key[2])
    possessions = defaultdict(set)
    membership = defaultdict(set)
    used_groups = defaultdict(set)
    for r in occupancy:
        a, w, loc, g = r["activity_id"], r["week"], r["location_id"], r["co_share_group"]
        possessions[loc, w, g].add(a)
        membership[a, w].add((loc, g))
        used_groups[loc, w].add(g)
    for (loc, w, g), members in possessions.items():
        counts = Counter(data.activities[a].access_type for a in members)
        if counts["PM"] + counts["PC"] > 1 or counts["C"] + counts["PC"] + 4 * counts["PM"] > 4:
            error("possession_mix", "Illegal possession sharing mix", location_id=loc, week=w, co_share_group=g)
    active_weeks = {a: {r["week"] for r in rows} for a, rows in by_activity.items()}
    access_nights = {(r["activity_id"], r["week"]): r["access_night"] for r in access}
    for conflict in data.conflicts:
        a, b = conflict.activities
        for w in sorted(active_weeks[a] & active_weeks[b]):
            if membership[a, w].intersection(membership[b, w]):
                continue
            is_live_a = getattr(data.activities.get(a), "nature_of_activity", "") == "Live"
            is_live_b = getattr(data.activities.get(b), "nature_of_activity", "") == "Live"
            if is_live_a or is_live_b:
                error(
                    "closure_buffer", "Activity inside another group's live closure zone",
                    activities=[a, b], week=w,
                    locations=conflict.locations,
                )
                continue
            c_a = getattr(data.activities.get(a), "contract_number", None)
            c_b = getattr(data.activities.get(b), "contract_number", None)
            n_a = access_nights.get((a, w))
            n_b = access_nights.get((b, w))
            if (c_a is not None and c_a == c_b and n_a is not None and n_a == n_b) or (c_a is None and c_b is None):
                error(
                    "closure_buffer", "Conflicting activities without shared possession",
                    activities=[a, b], week=w,
                    locations=conflict.locations,
                )
    hotspots = []
    for (loc, w), groups in sorted(used_groups.items()):
        excess = max(0, len(groups) - data.location_capacity[loc])
        if excess:
            hotspots.append({"location_id": loc, "week": w, "used": len(groups), "capacity": data.location_capacity[loc], "excess": excess})
        if settings.max_supply_excess is not None and excess > settings.max_supply_excess:
            error("capacity", "Location weekly capacity allowance exceeded", location_id=loc, week=w, excess=excess)

    result_counts = Counter(r["contract_number"] for r in results)
    expected_results = {}
    for c, contract in data.contracts.items():
        if result_counts[c] != 1:
            error("results", "Expected exactly one result per contract", contract_number=c)
        members = data.activities_by_contract[c]
        if members and all(a in finish for a in members):
            completed = data.week_end_dates[str(max(finish[a] for a in members))]
            overrun = max(0, (date.fromisoformat(completed) - date.fromisoformat(contract.planned_completion_date)).days)
            expected_results[c] = (completed, overrun)
    for r in results:
        c = r["contract_number"]
        if c in expected_results and (r["simulated_completion_date"], r["overrun_days"]) != expected_results[c]:
            error("results", "Completion date or overrun disagrees with scheduled accesses", contract_number=c, row=r["_row"])

    report["detail"].update(capacity_hotspots=hotspots, nights_scheduled=len(access), eclo_nights=sum(r["eclo"] for r in access))
    if errors:
        return report
    priority = {"1": 0, "2": 0, "3": 0}
    weighted = overrun_total = earliness = 0
    for a, activity in data.activities.items():
        contract = data.contracts[activity.contract_number]
        delta = (date.fromisoformat(data.week_end_dates[str(finish[a])]) - date.fromisoformat(contract.planned_completion_date)).days
        late = max(0, delta)
        overrun_total += late
        earliness += max(0, -delta)
        priority[str(contract.contract_priority)] += late
        weighted += activity.delay_weight_scaled * late
    excess_total = sum(h["excess"] for h in hotspots)
    eclo_total = sum(r["eclo"] for r in access)
    report["feasible"] = True
    report["soft_scores"] = {
        "scenario": scenario, "overrun_days_total": overrun_total,
        "contracts_overrunning": sum(overrun > 0 for _, overrun in expected_results.values()),
        "earliness_days_total": earliness, "excess_access_nights_total": excess_total,
        "eclo_nights_total": eclo_total, "priority_overrun": priority,
        "priority_weighted_score": weighted / data.objective_scale,
        "objective_score": (settings.delay_multiplier * weighted + settings.excess_weight_scaled * excess_total + settings.eclo_weight_scaled * eclo_total) / data.objective_scale,
    }
    return report


def validate_directory(directory: str | Path, input_directory: str | Path = DEFAULT_DATA_DIR, scenario: str | None = None) -> dict:
    """Preprocess the eight source CSVs and validate a submission directory."""
    return validate_schedule(directory, preprocess_directory(input_directory), scenario)


def score_directory(directory: str | Path, input_directory: str | Path = DEFAULT_DATA_DIR, scenario: str | None = None) -> dict:
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
