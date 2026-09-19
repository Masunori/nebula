"""Validate the eight input CSVs and prepare constants (never CP-SAT variables).

See docs/Preprocessing.md for spatial conventions and the returned schema.
Uses Pydantic for typed output; importing this module does not require OR-Tools.
"""

from __future__ import annotations

import argparse
import csv
import io
from collections import deque
from datetime import date, timedelta
from itertools import combinations
from pathlib import Path
from typing import Mapping

from pydantic import ValidationError

from ..models.preprocessed_data import PreparedProblem

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
SCHEMAS = {
    "01_LINES.csv": "line_code,line_name",
    "02_STATIONS.csv": "station_id,line_code,seq,is_interchange",
    "03_SECTORS.csv": "sector_id,line_code,from_station_id,to_station_id,seq,is_shared",
    "04_LOCATION_SUPPLY.csv": "location_id,location_kind,line_code,bound,supply_capacity",
    "05_BUFFER_LOCATION.csv": "nature_of_works,up_to_buffer_sectors,opposite_bound_required",
    "06_PARAMETERS.csv": "key,value",
    "07_PROJECT_DETAILS.csv": "contract_number,contract_description,contract_award_date,activity_type,nature_of_activity,contract_priority,contract_completion_date,planned_completion_date,number_of_workfronts,access_type,number_of_maximum_access_per_week",
    "08_ACTIVITY_DETAILS.csv": "activity_id,contract_number,activity_type,start_location_id,end_location_id,total_accesses,planned_start_date,predecessor_activity_id,activity_priority",
}
INTEGER_MIN = {
    "seq": 1,
    "is_interchange": 0,
    "is_shared": 0,
    "supply_capacity": 0,
    "up_to_buffer_sectors": 0,
    "opposite_bound_required": 0,
    "contract_priority": 1,
    "activity_priority": 1,
    "number_of_workfronts": 1,
    "number_of_maximum_access_per_week": 1,
    "total_accesses": 1,
}
ENUMS = {
    "is_interchange": {0, 1},
    "is_shared": {0, 1},
    "opposite_bound_required": {0, 1},
    "contract_priority": {1, 2, 3},
    "activity_priority": {1, 2, 3},
    "bound": {"EB", "WB"},
    "access_type": {"PM", "PC", "C"},
    "location_kind": {"tunnel sector", "platform sector"},
    "nature_of_works": {"Live", "Non-live (Consist)", "Non-live (Others)"},
    "nature_of_activity": {"Live", "Non-live (Consist)", "Non-live (Others)"},
}


class DatasetValidationError(ValueError):
    """Malformed input, with a file/row/field or entity identifier in the message."""


def _require(condition: bool, message: str) -> None:
    """Require a validation condition to hold.

    Args:
        condition: Truthy value indicating that the input satisfies a rule.
        message: Error text to report when the condition fails. Include the
            relevant filename, row, field, or entity ID where possible.

    Returns:
        None when the condition holds.

    Raises:
        DatasetValidationError: If condition is false."""
    if not condition:
        raise DatasetValidationError(message)


def _parse(name: str, text: str) -> list[dict]:
    """Parse and validate the rows of one supported CSV file.

    Removes a leading UTF-8 BOM and strips whitespace from field values.
    Headers must match the configured schema, but may appear in any order.
    Numeric fields become integers; dates remain validated YYYY-MM-DD strings.
    Only predecessor_activity_id may be empty. Cross-table references and
    unique keys are checked later in the preprocessing pipeline.

    Args:
        name: Exact filename registered in SCHEMAS, such as '01_LINES.csv'.
        text: Already decoded CSV contents, including the header row.

    Returns:
        Nonempty list of row dictionaries in input order. Each dictionary maps
        column names to stripped strings or converted integer values.

    Raises:
        DatasetValidationError: If headers, row widths, required values, numeric
            ranges, dates, enumerations, or CSV data rows are invalid.
        KeyError: If name is not registered in SCHEMAS.
        csv.Error: If the CSV header itself cannot be parsed."""
    reader = csv.DictReader(io.StringIO(text.lstrip("\ufeff")), strict=True)
    expected = SCHEMAS[name].split(",")
    _require(
        reader.fieldnames is not None
        and len(reader.fieldnames) == len(set(reader.fieldnames)),
        f"{name}: missing or duplicate headers",
    )
    _require(
        set(reader.fieldnames) == set(expected), f"{name}: expected columns {expected}"
    )
    rows = []
    try:
        for row in reader:
            context = f"{name}: row {reader.line_num}"
            _require(
                None not in row and all(v is not None for v in row.values()),
                f"{context}: incorrect number of fields",
            )
            row = {k: v.strip() for k, v in row.items()}
            for field, value in row.items():
                _require(
                    value or field == "predecessor_activity_id",
                    f"{context}: {field} is required",
                )
                try:
                    if field in INTEGER_MIN:
                        row[field] = int(value)
                        _require(
                            row[field] >= INTEGER_MIN[field],
                            f"{context}: {field} is out of range",
                        )
                    elif field.endswith("_date"):
                        _require(
                            date.fromisoformat(value).isoformat() == value,
                            f"{context}: {field} must be YYYY-MM-DD",
                        )
                except ValueError as exc:
                    raise DatasetValidationError(
                        f"{context}: invalid {field}: {value!r}"
                    ) from exc
                if field in ENUMS:
                    _require(
                        row[field] in ENUMS[field],
                        f"{context}: invalid {field}: {value!r}",
                    )
            rows.append(row)
    except csv.Error as exc:
        raise DatasetValidationError(f"{name}: row {reader.line_num}: {exc}") from exc
    _require(rows, f"{name}: no data rows")
    return rows


def _index(rows: list[dict], fields: list[str], label: str) -> dict:
    """Index rows by a unique field or an ordered composite key.

    Args:
        rows: Parsed row dictionaries containing every requested key field.
        fields: Nonempty list of column names. One field produces scalar keys;
            multiple fields produce tuples in the supplied field order.
        label: Human-readable table name used in duplicate-key error messages.

    Returns:
        Dictionary mapping each key to its original row dictionary. Rows are
        referenced, not copied, and input order is preserved. Empty rows input
        produces an empty dictionary.

    Raises:
        DatasetValidationError: If two rows produce the same key.
        KeyError: If a row does not contain a requested field."""
    result = {}
    for row in rows:
        key = tuple(row[f] for f in fields)
        key = key[0] if len(key) == 1 else key
        _require(key not in result, f"{label}: duplicate key {key}")
        result[key] = row
    return result


def _build_calendar(parameters: dict) -> tuple[date, int, list[int], dict]:
    """Build the planning-week domain and its calendar completion dates.

    Weeks are seven-day intervals anchored at horizon_start, irrespective of
    its weekday. Week 1 ends six days after horizon_start.

    Args:
        parameters: Parameter-name mapping containing 'horizon_start' as an
            ISO date string and 'horizon_weeks' as a positive integer or an
            integer string. Other parameters are ignored by this helper.

    Returns:
        Tuple (horizon_start, horizon, weeks, week_ends), where horizon_start
        is a date, horizon is an integer, weeks is [1, ..., horizon], and
        week_ends maps string week numbers to ISO completion-date strings.

    Raises:
        DatasetValidationError: If a required parameter is missing or invalid.
        OverflowError: If the horizon extends beyond Python's date range."""
    try:
        horizon_start = date.fromisoformat(parameters["horizon_start"])
        horizon = int(parameters["horizon_weeks"])
        _require(horizon > 0, "horizon_weeks must be positive")
    except (KeyError, ValueError) as exc:
        raise DatasetValidationError(
            "06_PARAMETERS.csv: invalid horizon_start/horizon_weeks"
        ) from exc
    weeks = list(range(1, horizon + 1))
    week_ends = {
        str(w): (horizon_start + timedelta(days=7 * w - 1)).isoformat() for w in weeks
    }
    return horizon_start, horizon, weeks, week_ends


def _build_network(
    lines: dict, stations: dict, sectors: dict, locations: dict
) -> tuple[dict, dict, dict, dict, dict]:
    """Validate a linear railway network and build spatial lookup tables.

    Station and sector sequence values determine order independently on each
    line. Sequence values must be unique within each line, but need not start
    at one. Every station platform and tunnel must have supply records for
    both EB and WB. This helper does not modify its input dictionaries.

    Args:
        lines: Line code -> parsed line row.
        stations: (line_code, station_id) -> parsed station row with integer seq.
        sectors: Sector ID -> parsed sector row with endpoints and integer seq.
        locations: Location ID -> parsed supply row, including line_code,
            bound, location_kind, and supply_capacity.

    Returns:
        Tuple (station_order, sector_order, spans, paths, opposite):
            station_order: Line code -> station IDs in physical order.
            sector_order: Line code -> tunnel sector IDs in physical order.
            spans: Location ID -> (line_code, bound, lower_index, upper_index).
                Indices are zero-based positions in station_order; a platform
                spans (i, i), while its following tunnel spans (i, i + 1).
            paths: 'line_code:bound' -> alternating platform/tunnel location
                IDs in physical order, starting and ending at platforms.
            opposite: Location ID -> corresponding location on the other bound.

    Raises:
        DatasetValidationError: If a line reference, sequence, sector endpoint,
            sector ID, location coverage, or location metadata is inconsistent.
        KeyError: If callers supply rows missing required schema fields."""
    # Build per-line physical order; sector seq is global in the supplied data.
    station_order, sector_order, spans, paths = {}, {}, {}, {}
    for row in (
        list(stations.values()) + list(sectors.values()) + list(locations.values())
    ):
        _require(row["line_code"] in lines, f"Unknown line: {row['line_code']}")
    for line in lines:
        line_stations = sorted(
            (s for (station_line, _), s in stations.items() if station_line == line),
            key=lambda s: s["seq"],
        )
        line_sectors = sorted(
            (s for s in sectors.values() if s["line_code"] == line),
            key=lambda s: s["seq"],
        )
        _require(
            len(line_stations) >= 2 and len(line_sectors) == len(line_stations) - 1,
            f"{line}: expected a connected linear network",
        )
        _require(
            len({s["seq"] for s in line_stations}) == len(line_stations)
            and len({s["seq"] for s in line_sectors}) == len(line_sectors),
            f"{line}: duplicate sequence numbers",
        )
        station_order[line] = [s["station_id"] for s in line_stations]
        sector_order[line] = [s["sector_id"] for s in line_sectors]
        for i, sector in enumerate(line_sectors):
            _require(
                (sector["from_station_id"], sector["to_station_id"])
                == (line_stations[i]["station_id"], line_stations[i + 1]["station_id"]),
                f"{sector['sector_id']}: inconsistent topology",
            )
            _require(
                sector["sector_id"]
                == f"SEC:{line}:{line_stations[i]['station_id']}_{line_stations[i+1]['station_id']}",
                f"{sector['sector_id']}: inconsistent sector ID",
            )
        for bound in ("EB", "WB"):
            path = []
            for i, station in enumerate(line_stations):
                location_id = f"PLAT:{line}:{station['station_id']}:{bound}"
                path.append(location_id)
                spans[location_id] = (line, bound, i, i)
                if i < len(line_sectors):
                    location_id = f"{line_sectors[i]['sector_id']}:{bound}"
                    path.append(location_id)
                    spans[location_id] = (line, bound, i, i + 1)
            paths[f"{line}:{bound}"] = path
    _require(
        set(spans) == set(locations),
        "04_LOCATION_SUPPLY.csv: locations must cover exactly the network's tunnels/platforms on both bounds",
    )
    for location_id, row in locations.items():
        line, bound, _, _ = spans[location_id]
        kind = "platform sector" if location_id.startswith("PLAT:") else "tunnel sector"
        _require(
            (row["line_code"], row["bound"], row["location_kind"])
            == (line, bound, kind),
            f"{location_id}: metadata disagrees with location ID",
        )
    opposite = {
        location_id: location_id.rsplit(":", 1)[0]
        + (":WB" if span[1] == "EB" else ":EB")
        for location_id, span in spans.items()
    }
    return station_order, sector_order, spans, paths, opposite


def _build_contract_groups(projects: dict, buffers: dict) -> tuple[dict, dict, dict]:
    """Separate contract metadata from contract/type resource groups.

    Args:
        projects: (contract_number, activity_type) -> parsed project row.
        buffers: Nature-of-works name -> parsed buffer rule. Every project's
            nature_of_activity must reference one of these rules.

    Returns:
        Tuple (contracts, groups, group_by_key):
            contracts: Contract number -> shared description, dates, priority,
                and contract number fields.
            groups: Generated group ID ('h1', 'h2', ...) -> project fields,
                local_nights in 1..number_of_maximum_access_per_week, and an
                initially empty activities list.
            group_by_key: (contract_number, activity_type) -> generated group ID.
        Group IDs follow project iteration order. Inputs are not modified.

    Raises:
        DatasetValidationError: If a buffer rule is missing or project rows
            for one contract disagree on contract-level metadata.
        KeyError: If project rows lack required schema fields."""
    contracts, groups, group_by_key = {}, {}, {}
    for key, project in projects.items():
        contract, activity_type = key
        _require(
            project["nature_of_activity"] in buffers, f"{key}: missing buffer rule"
        )
        common = {
            k: v
            for k, v in project.items()
            if k
            in (
                "contract_number",
                "contract_description",
                "contract_award_date",
                "contract_priority",
                "contract_completion_date",
                "planned_completion_date",
            )
        }
        _require(
            contract not in contracts or contracts[contract] == common,
            f"{contract}: inconsistent contract metadata",
        )
        contracts[contract] = common
        group_id = f"h{len(groups)+1}"
        group_by_key[key] = group_id
        groups[group_id] = {
            **project,
            "local_nights": list(
                range(1, project["number_of_maximum_access_per_week"] + 1)
            ),
            "activities": [],
        }
    return contracts, groups, group_by_key


def _topological_order(prepared: dict, successors: dict) -> list[str]:
    """Order activities so every predecessor appears before its successors.

    Uses an iterative topological sort, avoiding recursion limits for long
    chains. It checks dependency cycles, not whether dates permit scheduling.

    Args:
        prepared: Activity ID -> prepared activity row, with
            predecessor_activity_id set to an existing activity ID or None.
        successors: Activity ID -> list of its immediate successor IDs. Must
            agree with the predecessor fields and include all activity IDs.

    Returns:
        List containing every activity ID once, with predecessors before their
        successors. Independent roots follow prepared dictionary order.

    Raises:
        DatasetValidationError: If dependencies contain a cycle.
        KeyError: If the supplied dependency indexes reference missing entries."""
    # Kahn's algorithm avoids recursion limits for long predecessor chains.
    indegree = {a: int(bool(p["predecessor_activity_id"])) for a, p in prepared.items()}
    queue = deque(a for a in prepared if indegree[a] == 0)
    topological_order = []
    while queue:
        activity_id = queue.popleft()
        topological_order.append(activity_id)
        for child in successors[activity_id]:
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)
    _require(
        len(topological_order) == len(prepared),
        "08_ACTIVITY_DETAILS.csv: predecessor cycle detected",
    )
    return topological_order


def _build_conflicts(
    prepared: dict, by_affected_location: dict
) -> tuple[list[dict], dict]:
    """Find spatial conflicts between independent activity possessions.

    A pair conflicts when either working route intersects the other's total
    footprint: (R_b & C_a) or (R_a & C_b). Touching buffers (B_a & B_b) without
    route intrusion do not conflict, providing legal safety separation.
    Candidate pairs are restricted to activities sharing an affected location.
    These are not unconditional scheduling bans: the solver and validator
    must apply legal co-sharing exceptions.

    Args:
        prepared: Activity ID -> prepared row containing R (working locations),
            B (buffer locations), and C (total footprint) as ID collections.
        by_affected_location: Location ID -> activities whose C contains that
            location. Must be complete to avoid missing candidate conflicts.

    Returns:
        Tuple (conflicts, conflicts_by_activity):
            conflicts: List sorted by activity pair. Each record contains
                'activities' (two IDs), 'locations' (sorted conflict locations),
                and 'shared_work_locations' (sorted intersection of both R sets).
            conflicts_by_activity: Every activity ID -> sorted IDs of activities
                with which it conflicts. Each relationship is stored both ways.
        Input dictionaries and footprint collections are not modified.

    Raises:
        KeyError: If required footprints or referenced activities are absent."""
    # Only compare pairs sharing an affected location, avoiding a dense A x A matrix.
    candidates = set()
    for members in by_affected_location.values():
        candidates.update(combinations(sorted(members), 2))
    sets = {a: {k: set(p[k]) for k in ("R", "B", "C")} for a, p in prepared.items()}
    conflicts = []
    conflicts_by_activity = {a: [] for a in prepared}
    for a, b in sorted(candidates):
        left, right = sets[a], sets[b]
        overlap = (right["R"] & left["C"]) | (left["R"] & right["C"])
        if overlap:
            conflicts.append(
                {
                    "activities": [a, b],
                    "locations": sorted(overlap),
                    "shared_work_locations": sorted(left["R"] & right["R"]),
                }
            )
            conflicts_by_activity[a].append(b)
            conflicts_by_activity[b].append(a)
    return conflicts, conflicts_by_activity


def _build_activity_footprint(
    activity_id: str,
    activity: dict,
    project: dict,
    buffers: dict,
    lines: dict,
    locations: dict,
    station_order: dict,
    spans: dict,
    paths: dict,
    opposite: dict,
) -> tuple[set, set, set, set, set, set, list[str]]:
    """Expand an activity route into its working and exclusion locations.

    The inclusive endpoint interval contains tunnel sectors and platforms.
    Reversing endpoints does not change it. Buffers extend by tunnel-sector
    count, include platforms, and stop at line termini. When required, the
    entire buffered interval is mirrored to the opposite bound. Live work
    reaching H01/H02 also closes their platforms and connecting tunnel on both
    bounds of other lines, including the configured buffer around that other
    line's interchange interval. This expansion does not recursively cross back.
    These are the spatial conventions documented in docs/Preprocessing.md.

    Args:
        activity_id: Identifier used in validation error messages.
        activity: Parsed activity row containing start_location_id and
            end_location_id. Both endpoints must share a line and bound.
        project: Matching project row containing nature_of_activity.
        buffers: Nature-of-works name -> rule with up_to_buffer_sectors and
            opposite_bound_required.
        lines: Line code -> parsed line row; keys identify possible other lines.
        locations: Location ID -> supply row; used to validate interchange IDs.
        station_order: Line code -> ordered station IDs from _build_network.
        spans: Location ID -> (line, bound, lower_index, upper_index), with
            zero-based station indices, from _build_network.
        paths: 'line:bound' -> physically ordered location IDs.
        opposite: Location ID -> corresponding opposite-bound location ID.

    Returns:
        Tuple (route, buffer, mirror, interchange, exclusion, footprint,
        affected_lines). The first six entries are sets of location IDs:
            route: Actual work locations, R.
            buffer: Extended interval minus route, B.
            mirror: Opposite-bound closures, MIR.
            interchange: Other-line interchange closures, INT.
            exclusion: B | MIR | INT, X.
            footprint: R | X, C.
        affected_lines is a sorted list of all line codes touched by C.
        No input data is modified.

    Raises:
        DatasetValidationError: If endpoints are unknown, differ in line/bound,
            or a required interchange location is missing.
        KeyError: If supplied project, buffer, or network indexes are incomplete."""

    def interval(line, bound, lower_station, upper_station):
        """Select all locations contained in an inclusive station interval.

        Args:
            line: Line code identifying the path to inspect.
            bound: Track direction, 'EB' or 'WB'.
            lower_station: Inclusive lower zero-based station index.
            upper_station: Inclusive upper zero-based station index.

        Returns:
            Set of platform/tunnel IDs whose full span lies inside the interval.
            Uses paths and spans captured from _build_activity_footprint. An
            interval containing no complete locations produces an empty set.

        Raises:
            KeyError: If the requested path or one of its spans is missing."""
        return {
            location_id
            for location_id in paths[f"{line}:{bound}"]
            if lower_station <= spans[location_id][2]
            and spans[location_id][3] <= upper_station
        }

    start, end = activity["start_location_id"], activity["end_location_id"]
    _require(start in spans and end in spans, f"{activity_id}: unknown route endpoint")
    line, bound, start_lower, start_upper = spans[start]
    end_line, end_bound, end_lower, end_upper = spans[end]
    _require(
        (line, bound) == (end_line, end_bound),
        f"{activity_id}: endpoints must be on the same line and bound",
    )
    lower_station, upper_station = min(start_lower, end_lower), max(
        start_upper, end_upper
    )
    route = interval(line, bound, lower_station, upper_station)
    rule = buffers[project["nature_of_activity"]]
    radius = rule["up_to_buffer_sectors"]
    extended = interval(
        line,
        bound,
        max(0, lower_station - radius),
        min(len(station_order[line]) - 1, upper_station + radius),
    )
    if project["nature_of_activity"] == "Live":
        buffer = set(extended - route)
    else:
        buffer = {loc for loc in (extended - route) if loc.startswith("SEC:")}
    mirror = (
        {opposite[location_id] for location_id in extended}
        if rule["opposite_bound_required"]
        else set()
    )
    interchange = set()
    if project["nature_of_activity"] == "Live":
        hubs = {f"PLAT:{line}:{hub}:{bound}" for hub in ("H01", "H02")}
        hubs.add(f"SEC:{line}:H01_H02:{bound}")
        if extended & hubs:
            for other in lines:
                if other != line:
                    for other_bound in ("EB", "WB"):
                        candidates = {
                            f"PLAT:{other}:{hub}:{other_bound}"
                            for hub in ("H01", "H02")
                        }
                        candidates.add(f"SEC:{other}:H01_H02:{other_bound}")
                        _require(
                            candidates <= locations.keys(),
                            "Live interchange requires H01/H02 locations on both lines",
                        )
                        other_lower = min(spans[loc][2] for loc in candidates)
                        other_upper = max(spans[loc][3] for loc in candidates)
                        interchange.update(interval(
                            other,
                            other_bound,
                            max(0, other_lower - radius),
                            min(len(station_order[other]) - 1, other_upper + radius),
                        ))
    exclusion = buffer | mirror | interchange
    footprint = route | exclusion
    affected_lines = sorted({spans[location_id][0] for location_id in footprint})
    return route, buffer, mirror, interchange, exclusion, footprint, affected_lines


def _prepare_activities(
    activities: dict,
    projects: dict,
    contracts: dict,
    groups: dict,
    group_by_key: dict,
    buffers: dict,
    lines: dict,
    locations: dict,
    station_order: dict,
    spans: dict,
    paths: dict,
    opposite: dict,
    horizon_start: date,
    horizon: int,
) -> tuple[dict, list[str], dict, dict, dict, dict, dict]:
    """Enrich activities with constants and construct membership indexes.

    Release dates map to their containing planning week, floored at week 1.
    Deadline weeks are the last weeks ending on/before planned completion,
    clipped to 0..horizon. Workload uses scale 2; delay weights use scale 10.
    Successful preparation does not establish scheduling feasibility or check
    predecessor cycles; _topological_order performs the latter check.

    Args:
        activities: Activity ID -> parsed activity row.
        projects: (contract_number, activity_type) -> parsed project row.
        contracts: Contract number -> metadata from _build_contract_groups.
        groups: Group ID -> resource record. This function appends activity IDs
            to each group's activities list in place; use freshly built groups.
        group_by_key: (contract_number, activity_type) -> group ID.
        buffers: Nature-of-works name -> buffer rule.
        lines: Line code -> parsed line row.
        locations: Location ID -> parsed supply row.
        station_order: Line code -> ordered station IDs.
        spans: Location ID -> (line, bound, lower_index, upper_index), using
            zero-based station positions from _build_network.
        paths: 'line:bound' -> physically ordered location IDs.
        opposite: Location ID -> opposite-bound location ID.
        horizon_start: Calendar date beginning planning week 1.
        horizon: Positive number of planning weeks.

    Returns:
        Tuple (prepared, warnings, by_contract, by_location,
        by_affected_location, by_line, successors):
            prepared: Activity ID -> original fields plus group, access type,
                nature, release/deadline weeks, eligible_weeks, workload_units,
                delay_weight_scaled, affected_lines and sorted R/B/MIR/INT/X/C
                location lists. Empty predecessor strings become None.
            warnings: Messages for activities starting beyond the horizon;
                these activities remain present with empty eligible_weeks.
            by_contract: Contract number -> member activity IDs.
            by_location: Location ID -> activities working there (R).
            by_affected_location: Location ID -> activities affecting it (C).
            by_line: Line code -> activities affecting it through work/closures.
            successors: Activity ID -> immediate successor IDs.
        Reverse-index lists follow activity input order and include empty
        entries for unused contracts, locations, lines, and leaf activities.

    Raises:
        DatasetValidationError: If a contract/type, predecessor, route endpoint,
            or required interchange location is invalid.
        KeyError: If required fields or prebuilt index entries are absent.
        ValueError: If supplied date strings have not been validated."""
    by_contract = {c: [] for c in contracts}
    by_location = {location_id: [] for location_id in locations}
    by_affected_location = {location_id: [] for location_id in locations}
    by_line = {line: [] for line in lines}
    successors = {a: [] for a in activities}
    prepared, warnings = {}, []

    for activity_id, activity in activities.items():
        key = (activity["contract_number"], activity["activity_type"])
        _require(
            key in projects, f"{activity_id}: unknown contract/activity_type {key}"
        )
        project, group_id = projects[key], group_by_key[key]
        route, buffer, mirror, interchange, exclusion, footprint, affected_lines = (
            _build_activity_footprint(
                activity_id,
                activity,
                project,
                buffers,
                lines,
                locations,
                station_order,
                spans,
                paths,
                opposite,
            )
        )
        predecessor = activity["predecessor_activity_id"] or None
        _require(
            predecessor is None or predecessor in activities,
            f"{activity_id}: unknown predecessor {predecessor}",
        )
        if predecessor:
            successors[predecessor].append(activity_id)
        release = max(
            1,
            (date.fromisoformat(activity["planned_start_date"]) - horizon_start).days
            // 7
            + 1,
        )
        deadline = date.fromisoformat(project["planned_completion_date"])
        deadline_week = max(0, min(horizon, ((deadline - horizon_start).days + 1) // 7))
        weight = {1: 100, 2: 10, 3: 1}[project["contract_priority"]] * {
            1: 13,
            2: 12,
            3: 10,
        }[activity["activity_priority"]]
        prepared[activity_id] = {
            **activity,
            "group_id": group_id,
            "predecessor_activity_id": predecessor,
            "access_type": project["access_type"],
            "nature_of_activity": project["nature_of_activity"],
            "planned_start_week": release,
            "eligible_weeks": list(range(release, horizon + 1)),
            "deadline_week": deadline_week,
            "workload_units": 2 * activity["total_accesses"],
            "delay_weight_scaled": weight,
            "affected_lines": affected_lines,
            "R": sorted(route),
            "B": sorted(buffer),
            "MIR": sorted(mirror),
            "INT": sorted(interchange),
            "X": sorted(exclusion),
            "C": sorted(footprint),
        }
        if release > horizon:
            warnings.append(
                f"{activity_id}: planned start is beyond the planning horizon"
            )
        groups[group_id]["activities"].append(activity_id)
        by_contract[key[0]].append(activity_id)
        for location_id in route:
            by_location[location_id].append(activity_id)
        for location_id in footprint:
            by_affected_location[location_id].append(activity_id)
        for affected_line in affected_lines:
            by_line[affected_line].append(activity_id)
    return (
        prepared,
        warnings,
        by_contract,
        by_location,
        by_affected_location,
        by_line,
        successors,
    )


def preprocess_directory(directory: str | Path = DEFAULT_DATA_DIR) -> PreparedProblem:
    """Read the eight input CSV files and prepare data for a future CP-SAT model.

    Reads UTF-8 CSVs (optionally with a BOM), then delegates validation and
    lookup construction to preprocess_csv_files. No solver is created, and
    no output files or browser storage are written by this function.

    Args:
        directory: Directory containing the eight filenames in SCHEMAS.
            Defaults to the repository's server/data directory, resolved from
            this module rather than the current working directory. Explicit
            relative paths are resolved from the current working directory.
            Unrelated files in the directory are ignored.

    Returns:
        PreparedProblem model with schema_version, parsed source_tables,
        calendar/parameters, network and resource indexes, enriched activities,
        spatial conflicts, predecessor order, scenario constants, and warnings.
        Footprint sets are serialized as sorted lists; dates are ISO strings.
        See preprocess_csv_files for the full output-key descriptions.

    Raises:
        DatasetValidationError: If a required file cannot be read or decoded,
            or the dataset fails schema, reference, topology, or cycle checks.
        csv.Error: If a CSV header cannot be parsed.
        OverflowError: If the planning horizon exceeds Python's date range.

    Example:
        problem = preprocess_directory()
        route = problem.activities['A001'].R
        capacity = problem.location_capacity[route[0]]"""
    files = {}
    for name in SCHEMAS:
        try:
            files[name] = (Path(directory) / name).read_text(encoding="utf-8-sig")
        except (OSError, UnicodeError) as exc:
            raise DatasetValidationError(f"{name}: {exc}") from exc
    return preprocess_csv_files(files)


def preprocess_csv_files(files: Mapping[str, str]) -> PreparedProblem:
    """Validate all eight CSV texts and prepare JSON-compatible solver inputs.

    Builds calendar/network indexes, contract/type groups, activity footprints,
    resource domains, dependencies and conflicts. It creates no CP-SAT model,
    performs no solving, and does not persist anything. The input mapping is
    not modified. A successful return means structurally valid inputs, not a
    feasible schedule. Only the first validation failure is reported.

    Args:
        files: Mapping from each exact filename in SCHEMAS to its decoded CSV
            text, including headers. All eight files are required; extra keys
            are rejected. Callers handling uploads must decode bytes first.
            Column order may vary, but names must match each file's schema.

    Returns:
        PreparedProblem model with the following attributes:
            schema_version: Output format version (1).
            source_tables: Filename -> parsed rows, retaining source fields.
            parameters: Parameter values with horizon_weeks converted to int.
            weeks: One-based week domain, [1, ..., horizon_weeks].
            week_end_dates: String week number -> ISO completion date.
            lines, locations, contracts: Entity ID -> corresponding record.
            stations_by_line, sectors_by_line: Line -> IDs in physical order.
            ordered_locations: 'line:bound' -> platform/tunnel path.
            opposite_locations: Location ID -> opposite-bound location ID.
            groups: Generated group ID -> project/resource fields, local_nights
                domain and member activity IDs; includes contract/type fields.
            activities: Activity ID -> original fields plus group_id, access
                type/nature, planned_start_week, eligible_weeks, deadline_week,
                workload_units, delay_weight_scaled and affected_lines.
                Each record also contains sorted location lists R (work),
                B (buffer), MIR (mirror), INT (interchange), X (exclusions),
                and C (total footprint). Missing predecessors become None.
            activities_by_contract, activities_by_location,
            activities_by_affected_location, activities_by_line: Entity ID ->
                activity IDs, using actual work for location and total footprint
                for affected-location/line membership.
            successors: Activity ID -> immediate successor IDs.
            topological_order: Activity IDs with predecessors before successors.
            conflicts: Independent-possession conflict records, each with two
                activities, conflict locations, and shared_work_locations.
                Co-sharing exceptions remain the future solver's responsibility.
            conflicts_by_activity: Activity ID -> conflicting activity IDs.
            location_capacity: Location ID -> nominal weekly supply.
            possession_group_domains: Location ID -> candidate group numbers
                1..number of activities working there; empty for unused sites.
            objective_scale: 10; divide the complete scaled objective by this
                value when reporting. Delay weights already include this scale.
            normal_access_units, eclo_bonus_units: 2 and 1 respectively; activity
                workload_units is twice the source total_accesses.
            scenarios: A/B/C -> supply, deadline, ECLO and objective settings.
                Scaled excess/ECLO costs are 70/50 where allowed. None means
                no excess cap or no ECLO window, depending on the field.
            warnings: Messages for planned starts beyond the horizon.
        Use model_dump(mode='json') for the equivalent dictionary or
    model_dump_json() for JSON text. Lookup dictionaries retain string keys.
        Week/date and spatial interpretations are detailed in Preprocessing.md.

    Raises:
        DatasetValidationError: If filenames, schemas, values, unique keys,
            cross-table references, network topology or predecessor chains
            are invalid. No partial payload is returned.
        csv.Error: If a CSV header cannot be parsed.
        OverflowError: If the planning horizon exceeds Python's date range.

    Example:
        files = {name: (data_dir / name).read_text(encoding='utf-8-sig')
                 for name in SCHEMAS}
        problem = preprocess_csv_files(files)
        activity = problem.activities['A001']
        nights = problem.groups[activity.group_id].local_nights"""
    _require(
        set(files) == set(SCHEMAS), "Expected exactly the eight named input CSV files"
    )
    tables = {name: _parse(name, files[name]) for name in SCHEMAS}
    lines = _index(tables["01_LINES.csv"], ["line_code"], "lines")
    stations = _index(
        tables["02_STATIONS.csv"], ["line_code", "station_id"], "stations"
    )
    sectors = _index(tables["03_SECTORS.csv"], ["sector_id"], "sectors")
    locations = _index(tables["04_LOCATION_SUPPLY.csv"], ["location_id"], "locations")
    buffers = _index(tables["05_BUFFER_LOCATION.csv"], ["nature_of_works"], "buffers")
    parameters = {
        k: r["value"]
        for k, r in _index(tables["06_PARAMETERS.csv"], ["key"], "parameters").items()
    }
    projects = _index(
        tables["07_PROJECT_DETAILS.csv"],
        ["contract_number", "activity_type"],
        "projects",
    )
    activities = _index(
        tables["08_ACTIVITY_DETAILS.csv"], ["activity_id"], "activities"
    )
    horizon_start, horizon, weeks, week_ends = _build_calendar(parameters)

    station_order, sector_order, spans, paths, opposite = _build_network(
        lines, stations, sectors, locations
    )

    contracts, groups, group_by_key = _build_contract_groups(projects, buffers)

    (
        prepared,
        warnings,
        by_contract,
        by_location,
        by_affected_location,
        by_line,
        successors,
    ) = _prepare_activities(
        activities,
        projects,
        contracts,
        groups,
        group_by_key,
        buffers,
        lines,
        locations,
        station_order,
        spans,
        paths,
        opposite,
        horizon_start,
        horizon,
    )

    topological_order = _topological_order(prepared, successors)

    conflicts, conflicts_by_activity = _build_conflicts(prepared, by_affected_location)

    payload = {
        "schema_version": 1,
        "source_tables": tables,
        "parameters": {**parameters, "horizon_weeks": horizon},
        "weeks": weeks,
        "week_end_dates": week_ends,
        "lines": lines,
        "locations": locations,
        "stations_by_line": station_order,
        "sectors_by_line": sector_order,
        "ordered_locations": paths,
        "opposite_locations": opposite,
        "contracts": contracts,
        "groups": groups,
        "activities": prepared,
        "activities_by_contract": by_contract,
        "activities_by_location": by_location,
        "activities_by_affected_location": by_affected_location,
        "activities_by_line": by_line,
        "successors": successors,
        "topological_order": topological_order,
        "conflicts": conflicts,
        "conflicts_by_activity": conflicts_by_activity,
        "location_capacity": {
            location_id: r["supply_capacity"] for location_id, r in locations.items()
        },
        "possession_group_domains": {
            location_id: list(range(1, len(members) + 1))
            for location_id, members in by_location.items()
        },
        "objective_scale": 10,
        "normal_access_units": 2,
        "eclo_bonus_units": 1,
        "scenarios": {
            "A": {
                "max_supply_excess": 0,
                "eclo_allowed": False,
                "hard_deadline": False,
                "eclo_window_weeks": None,
                "delay_multiplier": 1,
                "excess_weight_scaled": 0,
                "eclo_weight_scaled": 0,
            },
            "B": {
                "max_supply_excess": None,
                "eclo_allowed": True,
                "hard_deadline": True,
                "eclo_window_weeks": None,
                "delay_multiplier": 0,
                "excess_weight_scaled": 70,
                "eclo_weight_scaled": 50,
            },
            "C": {
                "max_supply_excess": 1,
                "eclo_allowed": True,
                "hard_deadline": False,
                "eclo_window_weeks": 2,
                "delay_multiplier": 1,
                "excess_weight_scaled": 70,
                "eclo_weight_scaled": 50,
            },
        },
        "warnings": warnings,
    }

    try:
        return PreparedProblem.model_validate(payload)
    except ValidationError as exc:
        raise DatasetValidationError(f"Prepared data validation failed: {exc}") from exc


def main() -> None:
    """Run the preprocessing command-line interface.

    Args:
        None. Reads command-line arguments from sys.argv. --data-dir selects
        the input directory (default: server/data); --output selects the JSON
        destination (default: stdout).

    Returns:
        None after emitting indented JSON with a trailing newline. When
        --output is supplied, writes UTF-8 and replaces any existing file;
        parent directories must already exist.

    Raises:
        SystemExit: With status 0 for --help, 2 for invalid CLI arguments, or
            1 for DatasetValidationError/output I/O failures, reporting the
            error to stderr. Other preprocessing exceptions propagate.

    Example:
        From the repository root:
        python -m server.app.services.csv_preprocessor --output /tmp/problem.json"""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument(
        "--output", type=Path, help="Write JSON to this path (default: stdout)"
    )
    args = parser.parse_args()
    try:
        payload = preprocess_directory(args.data_dir).model_dump_json(indent=2) + "\n"
        if args.output:
            args.output.write_text(payload, encoding="utf-8")
        else:
            print(payload, end="")
    except (DatasetValidationError, OSError) as exc:
        parser.exit(1, f"{exc}\n")


if __name__ == "__main__":
    main()
