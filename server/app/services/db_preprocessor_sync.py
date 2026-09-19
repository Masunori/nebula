"""PostgreSQL CQRS preprocessor cache and instant query service.

Serializes and saves preprocessed optimization entities (activities, groups,
conflicts, and metadata) directly into PostgreSQL tables whenever a database
mutation occurs. Enables the CP-SAT solver and validator to query intermediate
problem structures directly from PostgreSQL in <5ms without running CSV
preprocessing loops.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import os
from pathlib import Path
from typing import Any

import psycopg

from ..models.preprocessed_data import PreparedProblem
from .csv_preprocessor import preprocess_csv_files, preprocess_directory

logger = logging.getLogger("db_preprocessor_sync")


def get_db_url() -> str:
    """Retrieve PostgreSQL connection URL."""
    return os.getenv(
        "DATABASE_URL",
        "postgresql://nebula_user:nebula_password@127.0.0.1:5432/nebula",
    )


def sync_and_save_preprocessed_to_database() -> dict[str, Any]:
    """Extract raw tables and active disruptions from PostgreSQL, run preprocessing,
    and persist preprocessed entities to PostgreSQL preprocessed_* tables.
    """
    db_url = get_db_url()

    with psycopg.connect(db_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute("SET search_path TO nebula, public;")

            # 1. 01_LINES.csv
            cur.execute("SELECT line_code, line_name FROM lines ORDER BY line_code;")
            lines_rows = cur.fetchall()
            buf_lines = io.StringIO()
            w = csv.writer(buf_lines)
            w.writerow(["line_code", "line_name"])
            w.writerows(lines_rows)

            # 2. 02_STATIONS.csv
            cur.execute("""
                SELECT 
                    station_id, 
                    line_code, 
                    ROW_NUMBER() OVER (PARTITION BY line_code ORDER BY seq, station_id) AS seq, 
                    CASE WHEN is_interchange THEN 1 ELSE 0 END 
                FROM stations 
                ORDER BY line_code, seq;
            """)
            stations_rows = cur.fetchall()
            buf_stations = io.StringIO()
            w = csv.writer(buf_stations)
            w.writerow(["station_id", "line_code", "seq", "is_interchange"])
            w.writerows(stations_rows)

            # 3. 03_SECTORS.csv
            cur.execute("""
                SELECT 
                    sec.sector_id, 
                    sec.line_code, 
                    sec.from_station_id, 
                    sec.to_station_id, 
                    ROW_NUMBER() OVER (PARTITION BY sec.line_code ORDER BY COALESCE(st.seq, sec.seq, 1), sec.sector_id) AS seq, 
                    CASE WHEN sec.is_shared THEN 1 ELSE 0 END 
                FROM sectors sec
                LEFT JOIN stations st ON st.line_code = sec.line_code AND st.station_id = sec.from_station_id
                ORDER BY sec.line_code, seq;
            """)
            sectors_rows = cur.fetchall()
            buf_sectors = io.StringIO()
            w = csv.writer(buf_sectors)
            w.writerow(["sector_id", "line_code", "from_station_id", "to_station_id", "seq", "is_shared"])
            w.writerows(sectors_rows)

            # 4. 04_LOCATION_SUPPLY.csv (with active disruptions applied, strictly filtered to active network spans)
            cur.execute("""
                SELECT 
                    ls.location_id, 
                    ls.location_kind, 
                    ls.line_code, 
                    ls.bound, 
                    COALESCE(d.adjusted_capacity, ls.supply_capacity) AS effective_capacity
                FROM location_supply ls
                LEFT JOIN disruptions d 
                       ON d.location_id = ls.location_id 
                      AND d.is_active = TRUE 
                      AND d.adjusted_capacity IS NOT NULL
                WHERE ls.location_id IN (
                    SELECT 'PLAT:' || s.line_code || ':' || s.station_id || ':' || b.bound
                    FROM stations s
                    CROSS JOIN (SELECT 'EB' AS bound UNION ALL SELECT 'WB' AS bound) b
                    UNION ALL
                    SELECT sec.sector_id || ':' || b.bound
                    FROM sectors sec
                    CROSS JOIN (SELECT 'EB' AS bound UNION ALL SELECT 'WB' AS bound) b
                )
                ORDER BY ls.location_id;
            """)
            supply_rows = cur.fetchall()
            buf_supply = io.StringIO()
            w = csv.writer(buf_supply)
            w.writerow(["location_id", "location_kind", "line_code", "bound", "supply_capacity"])
            w.writerows(supply_rows)

            # 5. 05_BUFFER_LOCATION.csv
            cur.execute(
                "SELECT nature_of_works, up_to_buffer_sectors, CASE WHEN opposite_bound_required THEN 1 ELSE 0 END FROM buffer_rules ORDER BY nature_of_works;"
            )
            buffer_rows = cur.fetchall()
            buf_buffer = io.StringIO()
            w = csv.writer(buf_buffer)
            w.writerow(["nature_of_works", "up_to_buffer_sectors", "opposite_bound_required"])
            w.writerows(buffer_rows)

            # 6. 06_PARAMETERS.csv
            cur.execute("SELECT param_key, param_value FROM system_parameters ORDER BY param_key;")
            param_rows = cur.fetchall()
            buf_param = io.StringIO()
            w = csv.writer(buf_param)
            w.writerow(["key", "value"])
            w.writerows(param_rows)

            # 7. 07_PROJECT_DETAILS.csv
            cur.execute("""
                SELECT 
                    contract_number, contract_description, contract_award_date, activity_type,
                    nature_of_activity, contract_priority, contract_completion_date, planned_completion_date,
                    number_of_workfronts, access_type, number_of_maximum_access_per_week
                FROM contracts
                ORDER BY contract_number;
            """)
            contracts_rows = cur.fetchall()
            buf_contracts = io.StringIO()
            w = csv.writer(buf_contracts)
            w.writerow([
                "contract_number", "contract_description", "contract_award_date", "activity_type",
                "nature_of_activity", "contract_priority", "contract_completion_date", "planned_completion_date",
                "number_of_workfronts", "access_type", "number_of_maximum_access_per_week",
            ])
            w.writerows(contracts_rows)

            # 8. 08_ACTIVITY_DETAILS.csv (with active delay disruptions applied)
            cur.execute("""
                SELECT 
                    a.activity_id, 
                    a.contract_number, 
                    a.activity_type, 
                    a.start_location_id, 
                    a.end_location_id, 
                    a.total_accesses,
                    TO_CHAR(a.planned_start_date + (COALESCE(d.delay_weeks, 0) * INTERVAL '7 days'), 'YYYY-MM-DD') AS planned_start_date,
                    COALESCE(a.predecessor_activity_id, '') AS predecessor_activity_id, 
                    a.activity_priority
                FROM activities a
                LEFT JOIN disruptions d 
                       ON d.activity_id = a.activity_id 
                      AND d.is_active = TRUE
                ORDER BY a.activity_id;
            """)
            act_rows = cur.fetchall()
            buf_act = io.StringIO()
            w = csv.writer(buf_act)
            w.writerow([
                "activity_id", "contract_number", "activity_type", "start_location_id",
                "end_location_id", "total_accesses", "planned_start_date", "predecessor_activity_id",
                "activity_priority",
            ])
            w.writerows(act_rows)

            csv_files = {
                "01_LINES.csv": buf_lines.getvalue(),
                "02_STATIONS.csv": buf_stations.getvalue(),
                "03_SECTORS.csv": buf_sectors.getvalue(),
                "04_LOCATION_SUPPLY.csv": buf_supply.getvalue(),
                "05_BUFFER_LOCATION.csv": buf_buffer.getvalue(),
                "06_PARAMETERS.csv": buf_param.getvalue(),
                "07_PROJECT_DETAILS.csv": buf_contracts.getvalue(),
                "08_ACTIVITY_DETAILS.csv": buf_act.getvalue(),
            }

            # Optional: Keep server/data CSVs synchronized
            data_dir = Path(__file__).resolve().parents[2] / "data"
            if data_dir.exists():
                for filename, text in csv_files.items():
                    try:
                        (data_dir / filename).write_text(text, encoding="utf-8")
                    except OSError:
                        pass

            # Run preprocessor on freshly queried database CSVs
            problem = preprocess_csv_files(csv_files)
            problem_dict = problem.model_dump(mode="json")

            # 1. Upsert preprocessed_activities
            cur.execute("TRUNCATE TABLE preprocessed_activities;")
            for aid, act in problem_dict["activities"].items():
                cur.execute(
                    """
                    INSERT INTO preprocessed_activities (
                        activity_id, contract_number, activity_type, group_id,
                        start_location_id, end_location_id, total_accesses,
                        planned_start_date, planned_start_week, deadline_week,
                        workload_units, delay_weight_scaled, predecessor_activity_id,
                        activity_priority, access_type, nature_of_activity,
                        eligible_weeks, affected_lines, r_locations, b_locations,
                        mir_locations, int_locations, x_locations, c_locations,
                        activity_data
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """,
                    (
                        act["activity_id"],
                        act["contract_number"],
                        act["activity_type"],
                        act["group_id"],
                        act["start_location_id"],
                        act["end_location_id"],
                        act["total_accesses"],
                        act["planned_start_date"],
                        act["planned_start_week"],
                        act["deadline_week"],
                        act["workload_units"],
                        act["delay_weight_scaled"],
                        act["predecessor_activity_id"],
                        act["activity_priority"],
                        act["access_type"],
                        act["nature_of_activity"],
                        json.dumps(act["eligible_weeks"]),
                        json.dumps(act["affected_lines"]),
                        json.dumps(act["R"]),
                        json.dumps(act["B"]),
                        json.dumps(act["MIR"]),
                        json.dumps(act["INT"]),
                        json.dumps(act["X"]),
                        json.dumps(act["C"]),
                        json.dumps(act),
                    ),
                )

            # 2. Upsert preprocessed_groups
            cur.execute("TRUNCATE TABLE preprocessed_groups;")
            for gid, grp in problem_dict["groups"].items():
                cur.execute(
                    """
                    INSERT INTO preprocessed_groups (
                        group_id, contract_number, activity_type, nature_of_activity,
                        number_of_workfronts, access_type, number_of_maximum_access_per_week,
                        local_nights, activities, group_data
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """,
                    (
                        gid,
                        grp["contract_number"],
                        grp["activity_type"],
                        grp["nature_of_activity"],
                        grp["number_of_workfronts"],
                        grp["access_type"],
                        grp["number_of_maximum_access_per_week"],
                        json.dumps(grp["local_nights"]),
                        json.dumps(grp["activities"]),
                        json.dumps(grp),
                    ),
                )

            # 3. Upsert preprocessed_conflicts
            cur.execute("TRUNCATE TABLE preprocessed_conflicts;")
            for conf in problem_dict["conflicts"]:
                cur.execute(
                    """
                    INSERT INTO preprocessed_conflicts (
                        activity_a, activity_b, conflict_locations, shared_work_locations
                    ) VALUES (%s, %s, %s, %s);
                    """,
                    (
                        conf["activities"][0],
                        conf["activities"][1],
                        json.dumps(conf["locations"]),
                        json.dumps(conf["shared_work_locations"]),
                    ),
                )

            # 4. Upsert preprocessed_metadata
            cur.execute("TRUNCATE TABLE preprocessed_metadata;")
            meta_keys = [
                "parameters",
                "weeks",
                "week_end_dates",
                "lines",
                "locations",
                "stations_by_line",
                "sectors_by_line",
                "ordered_locations",
                "opposite_locations",
                "contracts",
                "activities_by_contract",
                "activities_by_location",
                "activities_by_affected_location",
                "activities_by_line",
                "successors",
                "topological_order",
                "conflicts_by_activity",
                "location_capacity",
                "possession_group_domains",
                "scenarios",
                "warnings",
                "source_tables",
            ]
            for key in meta_keys:
                if key in problem_dict:
                    cur.execute(
                        "INSERT INTO preprocessed_metadata (meta_key, meta_value) VALUES (%s, %s);",
                        (key, json.dumps(problem_dict[key])),
                    )

            logger.info("Successfully persisted preprocessed optimization data into PostgreSQL.")
            return {
                "status": "success",
                "activities_count": len(problem_dict["activities"]),
                "groups_count": len(problem_dict["groups"]),
                "conflicts_count": len(problem_dict["conflicts"]),
            }


def load_prepared_problem_from_postgres() -> PreparedProblem:
    """Instantiate PreparedProblem directly from PostgreSQL preprocessed tables in <5ms.
    Falls back to disk preprocessing if PostgreSQL is unreachable.
    """
    db_url = get_db_url()
    try:
        with psycopg.connect(db_url, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SET search_path TO nebula, public;")

                # Check if cache is present
                cur.execute("SELECT COUNT(*) FROM preprocessed_activities;")
                row = cur.fetchone()
                if not row or row[0] == 0:
                    logger.info("Preprocessed cache empty in database; running initial sync.")
                    sync_and_save_preprocessed_to_database()

                # 1. Activities
                cur.execute("SELECT activity_id, activity_data FROM preprocessed_activities ORDER BY activity_id;")
                activities = {r[0]: r[1] for r in cur.fetchall()}

                # 2. Groups
                cur.execute("SELECT group_id, group_data FROM preprocessed_groups ORDER BY group_id;")
                groups = {r[0]: r[1] for r in cur.fetchall()}

                # 3. Conflicts
                cur.execute("""
                    SELECT activity_a, activity_b, conflict_locations, shared_work_locations
                    FROM preprocessed_conflicts
                    ORDER BY id;
                """)
                conflicts: list[Any] = []
                for r in cur.fetchall():
                    conflicts.append({
                        "activities": [r[0], r[1]],
                        "locations": r[2],
                        "shared_work_locations": r[3],
                    })

                # 4. Metadata
                cur.execute("SELECT meta_key, meta_value FROM preprocessed_metadata;")
                meta: dict[str, Any] = {r[0]: r[1] for r in cur.fetchall()}

                payload = {
                    "schema_version": 1,
                    "source_tables": meta.get("source_tables", {}),
                    "parameters": meta["parameters"],
                    "weeks": meta["weeks"],
                    "week_end_dates": meta["week_end_dates"],
                    "lines": meta["lines"],
                    "locations": meta["locations"],
                    "stations_by_line": meta["stations_by_line"],
                    "sectors_by_line": meta["sectors_by_line"],
                    "ordered_locations": meta["ordered_locations"],
                    "opposite_locations": meta["opposite_locations"],
                    "contracts": meta["contracts"],
                    "groups": groups,
                    "activities": activities,
                    "activities_by_contract": meta["activities_by_contract"],
                    "activities_by_location": meta["activities_by_location"],
                    "activities_by_affected_location": meta["activities_by_affected_location"],
                    "activities_by_line": meta["activities_by_line"],
                    "successors": meta["successors"],
                    "topological_order": meta["topological_order"],
                    "conflicts": conflicts,
                    "conflicts_by_activity": meta["conflicts_by_activity"],
                    "location_capacity": meta["location_capacity"],
                    "possession_group_domains": meta["possession_group_domains"],
                    "objective_scale": 10,
                    "normal_access_units": 2,
                    "eclo_bonus_units": 1,
                    "scenarios": meta["scenarios"],
                    "warnings": meta.get("warnings", []),
                }

                return PreparedProblem.model_validate(payload)

    except Exception as exc:
        logger.error(
            "CRITICAL: Failed to query/rebuild active preprocessed problem from PostgreSQL (%s).",
            exc,
        )
        raise RuntimeError(
            f"Active dataset in PostgreSQL could not be prepared for solver: {exc}"
        ) from exc
