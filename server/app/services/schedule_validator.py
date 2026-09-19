"""Standalone deterministic schedule validator and scorer for NebulaX.

Audits any schedule (from CSV files, DB rows, or memory) against the 8 rigid
safety constraints and computes the competition soft penalty scores without
invoking the CP-SAT optimization solver.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Literal, Sequence, Mapping, Any

from ..models.preprocessed_data import PreparedProblem
from .csv_preprocessor import preprocess_directory


def validate_schedule(
    data: PreparedProblem,
    access_rows: Sequence[Mapping[str, Any]],
    occupancy_rows: Sequence[Mapping[str, Any]],
    results_rows: Sequence[Mapping[str, Any]],
    scenario: Literal["A", "B", "C"] = "A",
) -> dict[str, Any]:
    """Audit a schedule against the competition problem statement.

    Args:
        data: Preprocessed problem constants (locations, activities, contracts, rules).
        access_rows: Iterable of dicts with keys: activity_id, access_seq, week, eclo, access_night.
        occupancy_rows: Iterable of dicts with keys: activity_id, week, location_id, co_share_group.
        results_rows: Iterable of dicts with keys: scenario, contract_number, simulated_completion_date, overrun_days.
        scenario: "A", "B", or "C".

    Returns:
        Structured dictionary matching problem statement Section 2.7:
        {
            "scenario": scenario,
            "feasible": bool,
            "hard_violations": list[dict],
            "soft_scores": dict,
            "detail": dict,
            "validation_log": list[dict]
        }
    """
    if scenario not in ("A", "B", "C"):
        raise ValueError(f"Unsupported scenario: {scenario}")

    hard_violations: list[dict[str, str]] = []
    validation_log: list[dict[str, Any]] = []

    def log_violation(rule: str, detail: str, week: int = 0, location_id: str = "", activity_id: str = "", contract: str = ""):
        entry = {
            "rule": rule,
            "severity": "hard",
            "detail": detail,
        }
        hard_violations.append(entry)
        validation_log.append({
            "id": f"viol-{len(hard_violations)}",
            "severity": "error",
            "rule": rule,
            "week": week,
            "calendarWeek": f"CW{week:02d}" if week else "N/A",
            "locationId": location_id,
            "activityId": activity_id,
            "contractNumber": contract,
            "message": detail,
            "timetableCellKey": f"{activity_id}:{week}:{location_id}" if activity_id and week else "",
        })

    # Index access rows
    accesses_by_activity: dict[str, list[dict]] = defaultdict(list)
    weeks_by_activity: dict[str, set[int]] = defaultdict(set)
    activity_finish_week: dict[str, int] = {}
    contract_nights_by_week: dict[tuple[str, int], set[int]] = defaultdict(set)
    workfront_counts: dict[tuple[str, int, int], int] = defaultdict(int)
    eclo_by_activity_week: dict[tuple[str, int], int] = {}

    for row in access_rows:
        aid = str(row["activity_id"])
        w = int(row["week"])
        seq = int(row["access_seq"])
        eclo = int(row.get("eclo", 0))
        night = int(row["access_night"])

        accesses_by_activity[aid].append({
            "week": w,
            "seq": seq,
            "eclo": eclo,
            "night": night,
        })
        weeks_by_activity[aid].add(w)
        activity_finish_week[aid] = max(activity_finish_week.get(aid, 0), w)

        if aid in data.activities:
            act = data.activities[aid]
            c_group = act.group_id
            contract_nights_by_week[c_group, w].add(night)
            workfront_counts[c_group, w, night] += 1
            eclo_by_activity_week[aid, w] = eclo

    # 1. Rule 1: Workload Conservation (all activities scheduled to full yield)
    for aid, act in data.activities.items():
        if aid not in accesses_by_activity or not accesses_by_activity[aid]:
            log_violation(
                rule="workload",
                detail=f"Activity {aid} in contract {act.contract_number} has 0 scheduled accesses (requires {act.workload_units} units)",
                activity_id=aid,
                contract=act.contract_number,
            )
            continue

        work_units = 0.0
        seen_weeks = set()
        for acc in accesses_by_activity[aid]:
            w = acc["week"]
            if w in seen_weeks:
                log_violation(
                    rule="workload",
                    detail=f"Activity {aid} scheduled multiple times in week {w} (at most 1 access per week allowed)",
                    week=w,
                    activity_id=aid,
                    contract=act.contract_number,
                )
            seen_weeks.add(w)
            work_units += 1.5 if acc["eclo"] == 1 else 1.0

        if work_units < act.total_accesses:
            log_violation(
                rule="workload",
                detail=f"Activity {aid} total work units {work_units} is below required workload {act.total_accesses}",
                activity_id=aid,
                contract=act.contract_number,
            )

    # 2. Rule 2: Planned Start Date
    for aid, act in data.activities.items():
        if aid in weeks_by_activity:
            earliest = min(weeks_by_activity[aid])
            if earliest < act.planned_start_week:
                log_violation(
                    rule="planned_date",
                    detail=f"Activity {aid} starts in week {earliest}, earlier than planned start week {act.planned_start_week}",
                    week=earliest,
                    activity_id=aid,
                    contract=act.contract_number,
                )

    # 3. Rule 3: Predecessor Precedence (FS+0: successor earliest > predecessor finish)
    for aid, act in data.activities.items():
        pred_id = act.predecessor_activity_id
        if pred_id and pred_id in activity_finish_week and aid in weeks_by_activity:
            pred_finish = activity_finish_week[pred_id]
            succ_start = min(weeks_by_activity[aid])
            if succ_start <= pred_finish:
                log_violation(
                    rule="predecessor",
                    detail=f"Activity {aid} starts in week {succ_start} before predecessor {pred_id} finished in week {pred_finish}",
                    week=succ_start,
                    activity_id=aid,
                    contract=act.contract_number,
                )

    # 4. Rule 7 & 8: Weekly Allocation Caps & Workfronts
    for (group_id, w), nights_used in contract_nights_by_week.items():
        group_meta = data.groups[group_id]
        if len(nights_used) > group_meta.number_of_maximum_access_per_week:
            log_violation(
                rule="weekly_allocation",
                detail=f"Contract group {group_id} uses {len(nights_used)} access nights in week {w} (max {group_meta.number_of_maximum_access_per_week})",
                week=w,
                contract=group_meta.contract_number,
            )

    for (group_id, w, night), count in workfront_counts.items():
        group_meta = data.groups[group_id]
        if count > group_meta.number_of_workfronts:
            log_violation(
                rule="workfront",
                detail=f"Contract group {group_id} has {count} concurrent activities on night {night} in week {w} (max workfronts {group_meta.number_of_workfronts})",
                week=w,
                contract=group_meta.contract_number,
            )

    # 5. Rule 9 & 10: Scenario Specific Hard Rules (ECLO & Capacity & Overrun)
    # Check ECLO in Scenario A
    if scenario == "A":
        for row in access_rows:
            if int(row.get("eclo", 0)) == 1:
                log_violation(
                    rule="eclo",
                    detail=f"ECLO night is strictly forbidden in Scenario A (activity {row.get('activity_id')}, week {row.get('week')})",
                    week=int(row.get("week", 0)),
                    activity_id=str(row.get("activity_id", "")),
                )

    # Check Scenario C ECLO continuity (at most one continuous 2-week window per line)
    if scenario == "C":
        eclo_weeks_by_line: dict[str, set[int]] = defaultdict(set)
        for row in access_rows:
            if int(row.get("eclo", 0)) == 1:
                aid = str(row["activity_id"])
                w = int(row["week"])
                if aid in data.activities:
                    act = data.activities[aid]
                    for loc in act.R:
                        line = loc.split(":")[1] if ":" in loc else "ALP"
                        eclo_weeks_by_line[line].add(w)

        for line, weeks in eclo_weeks_by_line.items():
            if weeks:
                min_w, max_w = min(weeks), max(weeks)
                if (max_w - min_w + 1) > 2:
                    log_violation(
                        rule="eclo",
                        detail=f"Scenario C requires ECLO on line {line} to fall in a continuous 2-week window, but spans {min_w} to {max_w}",
                        week=min_w,
                    )

    # 6. Rule 5: Location Occupancy & Legal Mixes & Supply Capacity
    occupancy_by_loc_week: dict[tuple[str, int], dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for row in occupancy_rows:
        aid = str(row["activity_id"])
        w = int(row["week"])
        loc = str(row["location_id"])
        group = str(row["co_share_group"])
        occupancy_by_loc_week[loc, w][group].append(aid)

    capacity_hotspots: list[dict[str, Any]] = []
    excess_access_nights_total = 0

    for (loc, w), groups in occupancy_by_loc_week.items():
        used_slots = len(groups)
        cap = data.location_capacity.get(loc, 0)
        excess = max(0, used_slots - cap)

        if excess > 0:
            excess_access_nights_total += excess
            capacity_hotspots.append({
                "location_id": loc,
                "week": w,
                "used": used_slots,
                "capacity": cap,
                "excess": excess,
            })
            if scenario == "A":
                log_violation(
                    rule="capacity",
                    detail=f"Location {loc} week {w} exceeds capacity (used {used_slots}, capacity {cap}) - zero excess allowed in Scenario A",
                    week=w,
                    location_id=loc,
                )
            elif scenario == "C" and excess > 1:
                log_violation(
                    rule="capacity",
                    detail=f"Location {loc} week {w} exceeds allowance (used {used_slots}, capacity {cap}, excess {excess} > 1 limit in Scenario C)",
                    week=w,
                    location_id=loc,
                )

        # Check legal mix in each co-share group:
        for g_name, activities_in_group in groups.items():
            pm_count = 0
            pc_count = 0
            c_count = 0
            for act_id in activities_in_group:
                if act_id in data.activities:
                    access_type = data.activities[act_id].access_type
                    if access_type == "PM":
                        pm_count += 1
                    elif access_type == "PC":
                        pc_count += 1
                    elif access_type == "C":
                        c_count += 1

            if pm_count > 0 and (pm_count > 1 or pc_count > 0 or c_count > 0):
                log_violation(
                    rule="legal_mix",
                    detail=f"Illegal mix at {loc} wk{w} group {g_name}: PM must be sole possession (found {pm_count} PM, {pc_count} PC, {c_count} C)",
                    week=w,
                    location_id=loc,
                )
            elif pc_count > 1:
                log_violation(
                    rule="legal_mix",
                    detail=f"Illegal mix at {loc} wk{w} group {g_name}: multiple PC activities in same group ({pc_count} PC)",
                    week=w,
                    location_id=loc,
                )
            elif pc_count == 1 and c_count > 3:
                log_violation(
                    rule="legal_mix",
                    detail=f"Illegal mix at {loc} wk{w} group {g_name}: 1 PC may co-share with at most 3 C (found {c_count} C)",
                    week=w,
                    location_id=loc,
                )
            elif pc_count == 0 and c_count > 4:
                log_violation(
                    rule="legal_mix",
                    detail=f"Illegal mix at {loc} wk{w} group {g_name}: at most 4 C may share a slot (found {c_count} C)",
                    week=w,
                    location_id=loc,
                )

    # 7. Results & Completion Overrun Calculations
    results_by_contract: dict[str, dict] = {}
    overrun_days_total = 0
    earliness_days_total = 0
    contracts_overrunning = 0
    priority_overrun = {"1": 0, "2": 0, "3": 0}
    weighted_scaled = 0

    for row in results_rows:
        cid = str(row["contract_number"])
        sim_date = str(row["simulated_completion_date"])
        overrun = int(row.get("overrun_days", 0))
        results_by_contract[cid] = {
            "simulated_completion_date": sim_date,
            "overrun_days": overrun,
        }
        if overrun > 0:
            contracts_overrunning += 1
            if scenario == "B":
                log_violation(
                    rule="planned_date",
                    detail=f"Contract {cid} has {overrun} overrun days (Scenario B strictly forbids completion overruns)",
                    contract=cid,
                )

    # Calculate exact completion metrics from activities
    for aid, act in data.activities.items():
        if aid in activity_finish_week:
            finish_w = activity_finish_week[aid]
            completed_str = data.week_end_dates.get(str(finish_w))
            if completed_str:
                completed = date.fromisoformat(completed_str)
                contract = data.contracts[act.contract_number]
                planned = date.fromisoformat(contract.planned_completion_date)
                delta = (completed - planned).days
                overrun = max(0, delta)
                overrun_days_total += overrun
                earliness_days_total += max(0, -delta)
                priority_overrun[str(contract.contract_priority)] += overrun
                weighted_scaled += act.delay_weight_scaled * overrun

    weighted_score = weighted_scaled / data.objective_scale
    eclo_nights_total = sum(int(r.get("eclo", 0)) for r in access_rows)

    # Combined Scenario Penalty Score Formula (§2.5)
    if scenario == "A":
        score = weighted_score
    elif scenario == "B":
        score = 7 * excess_access_nights_total + 5 * eclo_nights_total
    else:  # Scenario C
        score = weighted_score + 7 * excess_access_nights_total + 5 * eclo_nights_total

    soft_scores = {
        "scenario": scenario,
        "overrun_days_total": overrun_days_total,
        "contracts_overrunning": contracts_overrunning,
        "earliness_days_total": earliness_days_total,
        "excess_access_nights_total": excess_access_nights_total,
        "eclo_nights_total": eclo_nights_total,
        "priority_overrun": priority_overrun,
        "priority_weighted_score": round(weighted_score, 1),
        "objective_score": round(score, 1),
    }

    feasible = len(hard_violations) == 0

    return {
        "scenario": scenario,
        "feasible": feasible,
        "hard_violations": hard_violations,
        "soft_scores": soft_scores,
        "detail": {
            "validation_scope": "Deterministic 8-rule auditor against Problem Statement Section 2",
            "capacity_hotspots": capacity_hotspots,
            "nights_scheduled": len(access_rows),
            "eclo_nights": eclo_nights_total,
        },
        "validation_log": validation_log,
    }
