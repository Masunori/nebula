"""NebulaX FastAPI Server.

Exposes CP-SAT optimization engine, standalone <150ms validator & scorer,
PostgreSQL database synchronization, preprocessed CQRS caching, disruptions,
and competition CSV/ZIP export endpoints.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import csv
from datetime import datetime, timezone
import io
import logging
import os
from pathlib import Path
import time
from typing import Any, Literal
import uuid
import zipfile

import fcntl
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import psycopg
from pydantic import BaseModel, ConfigDict, Field

from .services.csv_preprocessor import DEFAULT_DATA_DIR, preprocess_directory
from .services.db_preprocessor_sync import (
    sync_and_save_preprocessed_to_database,
    load_prepared_problem_from_postgres,
)
from .services.db_sync import (
    get_db_url,
    sync_schedule_to_postgres,
)
from .services.sat_solver_service import SatSolverService
from .services.schedule_validator import validate_schedule
from .services.solve_results import OUTPUT_DIR, build_result, write_result_csvs

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nebula.main")

OUTPUT_DIR = Path("/tmp/nebula_output")
LOCK_FILE = Path("/tmp/nebula_solver.lock")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm preprocessed tables from PostgreSQL on startup
    try:
        sync_and_save_preprocessed_to_database()
        logger.info("Preprocessed cache verified on server boot.")
    except Exception as exc:
        logger.warning("Could not warm preprocessed cache on startup: %s", exc)
    yield


app = FastAPI(
    title="NebulaX Railway Track Access Optimization API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
async def health_check():
    """Health check endpoint to verify that the service is running."""
    return {"status": "ok"}


class SolveRequest(BaseModel):
    scenario: Literal["A", "B", "C"] = "A"
    max_time_seconds: float = 60.0
    sync_db: bool = True


class ValidationRequest(BaseModel):
    scenario: Literal["A", "B", "C"] = "A"
    access_rows: list[dict[str, Any]] | None = None
    occupancy_rows: list[dict[str, Any]] | None = None
    results_rows: list[dict[str, Any]] | None = None


class DatabaseSyncRequest(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)
    lines: list[dict[str, Any]] | None = None
    stations: list[dict[str, Any]] | None = None
    sectors: list[dict[str, Any]] | None = None
    location_supply: list[dict[str, Any]] | None = Field(default=None, alias="locationSupply")
    buffer_rules: list[dict[str, Any]] | None = Field(default=None, alias="bufferRules")
    parameters: list[dict[str, Any]] | None = None
    contracts: list[dict[str, Any]] | None = None
    activities: list[dict[str, Any]] | None = None


class DisruptionCreateRequest(BaseModel):
    disruption_type: Literal[
        "CAPACITY_REDUCTION", "ACTIVITY_DELAY", "SECTOR_CLOSURE", "EMERGENCY_POSSESSION"
    ]
    title: str
    description: str | None = None
    location_id: str | None = None
    activity_id: str | None = None
    from_week: int
    to_week: int
    adjusted_capacity: int | None = None
    delay_weeks: int | None = 0
    created_by: str | None = "Chief Train Controller"


def _flush_persisted_schedule():
    """Unlink persisted schedule files when underlying database records are modified or flushed."""
    for f in ["SCHEDULE_ACCESS.csv", "SCHEDULE_OCCUPANCY.csv", "RESULTS.csv"]:
        target = OUTPUT_DIR / f
        if target.exists():
            try:
                target.unlink()
            except Exception:
                pass


@app.get("/api/database/status", tags=["database"])
def get_database_status():
    """Get live connection health and record counts from PostgreSQL."""
    db_url = get_db_url()
    try:
        with psycopg.connect(db_url, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SET search_path TO nebula, public;")
                counts = {}
                tables = [
                    "lines",
                    "stations",
                    "sectors",
                    "location_supply",
                    "contracts",
                    "activities",
                    "disruptions",
                    "preprocessed_activities",
                    "preprocessed_groups",
                    "preprocessed_conflicts",
                ]
                for tbl in tables:
                    try:
                        cur.execute(f"SELECT COUNT(*) FROM {tbl};")
                        counts[tbl] = cur.fetchone()[0]
                    except Exception:
                        counts[tbl] = 0

                cur.execute("SELECT COUNT(*) FROM disruptions WHERE is_active = TRUE;")
                active_disruptions = cur.fetchone()[0]

                return {
                    "connected": True,
                    "database": "nebula",
                    "schema": "nebula",
                    "port": 5432,
                    "host": "database",
                    "counts": counts,
                    "active_disruptions": active_disruptions,
                    "preprocessed_cached": counts.get("preprocessed_activities", 0) > 0,
                }
    except Exception as exc:
        return {
            "connected": False,
            "error": str(exc),
            "preprocessed_cached": False,
        }


@app.post("/api/database/flush", tags=["database"])
def flush_database_output():
    """Flush previous schedule calculation results and reset state to awaiting calculation."""
    _flush_persisted_schedule()
    return {"status": "ok", "flushed": True, "message": "Calculated schedules invalidated and flushed."}


def sync_records_to_postgres(request: DatabaseSyncRequest):
    """Synchronize updated network entities and activity datasets to PostgreSQL tables."""
    db_url = get_db_url()
    try:
        with psycopg.connect(db_url, autocommit=False) as conn:
            with conn.cursor() as cur:
                cur.execute("SET search_path TO nebula, public;")
                # 1. Clean out existing records in dependency order
                cur.execute("DELETE FROM schedule_access;")
                cur.execute("DELETE FROM schedule_occupancy;")
                cur.execute("DELETE FROM schedule_results;")
                cur.execute("DELETE FROM preprocessed_conflicts;")
                cur.execute("DELETE FROM preprocessed_groups;")
                cur.execute("DELETE FROM preprocessed_activities;")
                cur.execute("DELETE FROM preprocessed_metadata;")
                cur.execute("DELETE FROM activities;")
                cur.execute("DELETE FROM contracts;")
                cur.execute("DELETE FROM location_supply;")
                cur.execute("DELETE FROM sectors;")
                cur.execute("DELETE FROM stations;")
                cur.execute("DELETE FROM lines;")
                cur.execute("DELETE FROM buffer_rules;")
                cur.execute("DELETE FROM system_parameters;")

                # 2. Insert Lines
                lines_data = request.lines or [
                    {"line_code": "ALP", "line_name": "Line Alpha"},
                    {"line_code": "BET", "line_name": "Line Beta"},
                ]
                for l in lines_data:
                    code = str(l.get("line_code", "")).strip()
                    name = str(l.get("line_name") or f"Line {code}").strip()
                    if code:
                        cur.execute(
                            "INSERT INTO lines (line_code, line_name) VALUES (%s, %s) ON CONFLICT (line_code) DO UPDATE SET line_name = EXCLUDED.line_name;",
                            (code, name),
                        )

                # 3. Insert Stations (Guaranteed sequential monotonic order per line)
                stations_data = request.stations or []
                line_st_counter: dict[str, int] = {}
                station_seq_map: dict[tuple[str, str], int] = {}
                for s in stations_data:
                    sid = str(s.get("station_id", "")).strip()
                    lcode = str(s.get("line_code", "")).strip()
                    if not sid or not lcode:
                        continue
                    raw_seq = s.get("seq") or s.get("seq_order")
                    if raw_seq is not None and int(raw_seq) > 0:
                        seq = int(raw_seq)
                    else:
                        line_st_counter[lcode] = line_st_counter.get(lcode, 0) + 1
                        seq = line_st_counter[lcode]
                    station_seq_map[(lcode, sid)] = seq
                    interchange = bool(s.get("is_interchange", False))
                    cur.execute(
                        """INSERT INTO stations (station_id, line_code, seq, is_interchange)
                           VALUES (%s, %s, %s, %s)
                           ON CONFLICT (station_id, line_code) DO UPDATE SET seq = EXCLUDED.seq, is_interchange = EXCLUDED.is_interchange;""",
                        (sid, lcode, seq, interchange),
                    )

                # 4. Insert Sectors (Topologically ordered by from_station_id)
                sectors_data = request.sectors or []
                line_sec_counter: dict[str, int] = {}
                for sec in sectors_data:
                    sec_id = str(sec.get("sector_id", "")).strip()
                    lcode = str(sec.get("line_code", "")).strip()
                    from_st = str(sec.get("from_station_id") or sec.get("station_from") or "").strip()
                    to_st = str(sec.get("to_station_id") or sec.get("station_to") or "").strip()
                    raw_seq = sec.get("seq") or sec.get("seq_order")
                    if raw_seq is not None and int(raw_seq) > 0:
                        seq = int(raw_seq)
                    elif (lcode, from_st) in station_seq_map:
                        seq = station_seq_map[(lcode, from_st)]
                    else:
                        line_sec_counter[lcode] = line_sec_counter.get(lcode, 0) + 1
                        seq = line_sec_counter[lcode]
                    shared = bool(sec.get("is_shared", False))
                    if sec_id and lcode and from_st and to_st:
                        cur.execute(
                            """INSERT INTO sectors (sector_id, line_code, from_station_id, to_station_id, seq, is_shared)
                               VALUES (%s, %s, %s, %s, %s, %s)
                               ON CONFLICT (sector_id) DO UPDATE SET seq = EXCLUDED.seq;""",
                            (sec_id, lcode, from_st, to_st, seq, shared),
                        )

                # 5. Insert Buffer Rules
                buffer_data = request.buffer_rules or getattr(request, "bufferRules", None) or [
                    {"nature_of_works": "Live", "up_to_buffer_sectors": 2, "opposite_bound_required": True},
                    {"nature_of_works": "Non-live (Consist)", "up_to_buffer_sectors": 1, "opposite_bound_required": False},
                    {"nature_of_works": "Non-live (Others)", "up_to_buffer_sectors": 0, "opposite_bound_required": False},
                ]
                existing_natures = set()
                for b in buffer_data:
                    nature = str(b.get("nature_of_works", "")).strip()
                    buf_secs = int(b.get("up_to_buffer_sectors") or b.get("buffer_sectors") or 0)
                    opp = bool(b.get("opposite_bound_required") or b.get("requires_opposite_bound", False))
                    if nature:
                        cur.execute(
                            """INSERT INTO buffer_rules (nature_of_works, up_to_buffer_sectors, opposite_bound_required)
                               VALUES (%s, %s, %s)
                               ON CONFLICT (nature_of_works) DO UPDATE SET up_to_buffer_sectors = EXCLUDED.up_to_buffer_sectors, opposite_bound_required = EXCLUDED.opposite_bound_required;""",
                            (nature, buf_secs, opp),
                        )
                        existing_natures.add(nature)

                for def_nat, d_buf, d_opp in [
                    ("Live", 2, True),
                    ("Non-live (Consist)", 1, False),
                    ("Non-live (Others)", 0, False),
                ]:
                    if def_nat not in existing_natures:
                        cur.execute(
                            "INSERT INTO buffer_rules (nature_of_works, up_to_buffer_sectors, opposite_bound_required) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING;",
                            (def_nat, d_buf, d_opp),
                        )

                # 6. Insert System Parameters
                params_data = request.parameters or [
                    {"param_key": "horizon_start", "param_value": "2027-01-04"},
                    {"param_key": "horizon_weeks", "param_value": "30"},
                ]
                for p in params_data:
                    k = str(p.get("param_key") or p.get("key") or "").strip()
                    v = str(p.get("param_value") or p.get("value") or "").strip()
                    if k:
                        cur.execute(
                            """INSERT INTO system_parameters (param_key, param_value)
                               VALUES (%s, %s)
                               ON CONFLICT (param_key) DO UPDATE SET param_value = EXCLUDED.param_value;""",
                            (k, v),
                        )

                # 7. Insert Location Supply (Automated Synthesis & Invariant Guarantee)
                cur.execute("SELECT line_code, station_id FROM stations ORDER BY line_code, seq;")
                db_stations = cur.fetchall()
                cur.execute("SELECT sector_id, line_code FROM sectors ORDER BY line_code, seq;")
                db_sectors = cur.fetchall()

                # Build exact network span domain required by preprocessor
                expected_locations: dict[str, tuple[str, str, str, str, int]] = {}
                for lcode, sid in db_stations:
                    for bnd in ("EB", "WB"):
                        loc_id = f"PLAT:{lcode}:{sid}:{bnd}"
                        expected_locations[loc_id] = (loc_id, "platform sector", lcode, bnd, 2)
                for sec_id, lcode in db_sectors:
                    for bnd in ("EB", "WB"):
                        loc_id = f"{sec_id}:{bnd}"
                        cap = 1 if "H01_H02" in sec_id else 4
                        expected_locations[loc_id] = (loc_id, "tunnel sector", lcode, bnd, cap)

                # Overlay client-supplied custom capacities if provided
                supply_data = request.location_supply or getattr(request, "locationSupply", None) or []
                for ls in supply_data:
                    raw_id = str(ls.get("location_id", "")).strip()
                    if raw_id.startswith("STA:"):
                        raw_id = "PLAT:" + raw_id[4:]
                    if raw_id in expected_locations:
                        loc_id, kind, lcode, bound, _ = expected_locations[raw_id]
                        cap = int(ls.get("supply_capacity") or ls.get("capacity") or 2)
                        expected_locations[raw_id] = (loc_id, kind, lcode, bound, cap)

                for loc_id, kind, lcode, bound, cap in expected_locations.values():
                    cur.execute(
                        """INSERT INTO location_supply (location_id, location_kind, line_code, bound, supply_capacity)
                           VALUES (%s, %s, %s, %s, %s)
                           ON CONFLICT (location_id) DO UPDATE SET supply_capacity = EXCLUDED.supply_capacity;""",
                        (loc_id, kind, lcode, bound, cap),
                    )

                # 8. Insert Contracts
                contracts_data = request.contracts or []
                activities_data = request.activities or []

                contract_act_type_map: dict[str, str] = {}
                contract_nature_map: dict[str, str] = {}
                for act in activities_data:
                    c_id = str(act.get("contract_number", "")).strip()
                    a_type = str(act.get("activity_type", "")).strip()
                    n_type = str(act.get("nature_of_works") or act.get("nature_of_activity") or "").strip()
                    if c_id and a_type:
                        contract_act_type_map[c_id] = a_type
                    if c_id and n_type:
                        contract_nature_map[c_id] = n_type

                known_contracts = set()
                for c in contracts_data:
                    cnum = str(c.get("contract_number", "")).strip()
                    cdesc = str(c.get("contract_description") or c.get("description") or f"Contract {cnum}").strip()
                    caward = str(c.get("contract_award_date") or "2026-01-01").strip()
                    atype = str(
                        c.get("activity_type")
                        or contract_act_type_map.get(cnum)
                        or ("Construction" if "construction" in cdesc.lower() else "Renewal")
                    ).strip()
                    nat = str(
                        c.get("nature_of_activity")
                        or c.get("nature_of_works")
                        or contract_nature_map.get(cnum)
                        or ("Live" if "live" in cdesc.lower() else ("Non-live (Others)" if atype == "Construction" else "Non-live (Consist)"))
                    ).strip()
                    if nat not in existing_natures and nat not in ["Live", "Non-live (Consist)", "Non-live (Others)"]:
                        nat = "Non-live (Others)"
                    cprio = int(c.get("contract_priority") or c.get("priority") or 2)
                    pcomp = str(c.get("planned_completion_date") or "2027-08-31").strip()
                    ccomp = str(c.get("contract_completion_date") or pcomp).strip()
                    if ccomp < pcomp:
                        ccomp = pcomp
                    wfronts = max(1, int(c.get("number_of_workfronts") or c.get("max_workfronts") or 1))
                    acc_type = str(c.get("access_type") or "C").strip().upper()
                    if acc_type not in ["PM", "PC", "C"]:
                        acc_type = "C"
                    max_acc = max(1, int(c.get("number_of_maximum_access_per_week") or c.get("max_access_per_week") or 2))

                    if cnum:
                        cur.execute(
                            """INSERT INTO contracts (
                                contract_number, contract_description, contract_award_date, activity_type,
                                nature_of_activity, contract_priority, contract_completion_date, planned_completion_date,
                                number_of_workfronts, access_type, number_of_maximum_access_per_week
                               ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                               ON CONFLICT (contract_number) DO UPDATE SET
                                planned_completion_date = EXCLUDED.planned_completion_date,
                                contract_completion_date = EXCLUDED.contract_completion_date,
                                number_of_workfronts = EXCLUDED.number_of_workfronts,
                                number_of_maximum_access_per_week = EXCLUDED.number_of_maximum_access_per_week;""",
                            (cnum, cdesc, caward, atype, nat, cprio, ccomp, pcomp, wfronts, acc_type, max_acc),
                        )
                        known_contracts.add(cnum)

                # 9. Insert Activities (Resolved to Topology Spans)
                cur.execute("SELECT line_code, station_id FROM stations ORDER BY line_code, seq;")
                db_stations = cur.fetchall()
                line_stations_ordered: dict[str, list[str]] = {}
                for lcode, sid in db_stations:
                    line_stations_ordered.setdefault(lcode, []).append(sid)

                activities_data = request.activities or []
                predecessors_to_link = []
                for act in activities_data:
                    aid = str(act.get("activity_id", "")).strip()
                    cnum = str(act.get("contract_number", "")).strip()
                    if not aid or cnum not in known_contracts:
                        continue
                    atype = str(act.get("activity_type") or "Renewal").strip()

                    start_loc = str(act.get("start_location_id") or "").strip()
                    end_loc = str(act.get("end_location_id") or "").strip()
                    lcode = str(act.get("line_code") or "").strip()
                    st_from = str(act.get("station_from") or "").strip()
                    st_to = str(act.get("station_to") or "").strip()
                    bound = str(act.get("track_bound") or "EB").strip().upper()

                    # Normalize STA: to PLAT:
                    if start_loc.startswith("STA:"):
                        start_loc = "PLAT:" + start_loc[4:]
                    if end_loc.startswith("STA:"):
                        end_loc = "PLAT:" + end_loc[4:]

                    # Decompose composite sector endpoints if given as SEC:LINE:Sxx_Syy:BOUND
                    if start_loc.startswith("SEC:"):
                        parts_s = start_loc.split(":")
                        if len(parts_s) >= 4:
                            if not lcode:
                                lcode = parts_s[1]
                            pair_s = parts_s[2].split("_")
                            if len(pair_s) == 2:
                                if not st_from:
                                    st_from = pair_s[0]
                                if not st_to:
                                    st_to = pair_s[1]
                            if not bound and parts_s[3]:
                                bound = parts_s[3].upper()

                    if end_loc.startswith("SEC:"):
                        parts_e = end_loc.split(":")
                        if len(parts_e) >= 4:
                            pair_e = parts_e[2].split("_")
                            if len(pair_e) == 2 and st_from and not st_to:
                                st_to = pair_e[1]

                    # Derive exact elementary start_loc / end_loc from line station sequence
                    if lcode and st_from and st_to:
                        st_list = line_stations_ordered.get(lcode, [])
                        if st_from in st_list and st_to in st_list:
                            idx_from = st_list.index(st_from)
                            idx_to = st_list.index(st_to)
                            if idx_from == idx_to:
                                start_loc = f"PLAT:{lcode}:{st_from}:{bound}"
                                end_loc = start_loc
                            else:
                                min_idx = min(idx_from, idx_to)
                                max_idx = max(idx_from, idx_to)
                                first_sec_from = st_list[min_idx]
                                first_sec_to = st_list[min_idx + 1]
                                start_loc = f"SEC:{lcode}:{first_sec_from}_{first_sec_to}:{bound}"
                                last_sec_from = st_list[max_idx - 1]
                                last_sec_to = st_list[max_idx]
                                end_loc = f"SEC:{lcode}:{last_sec_from}_{last_sec_to}:{bound}"
                        elif not start_loc:
                            start_loc = f"SEC:{lcode}:{st_from}_{st_to}:{bound}"
                            end_loc = start_loc

                    if not end_loc:
                        end_loc = start_loc

                    tot_acc = max(1, int(act.get("total_accesses") or 1))
                    pstart = str(act.get("planned_start_date") or "2027-01-04").strip()
                    prio = int(act.get("activity_priority") or act.get("priority") or 2)
                    if prio not in (1, 2, 3):
                        prio = 2

                    cur.execute(
                        """INSERT INTO activities (
                            activity_id, contract_number, activity_type, start_location_id,
                            end_location_id, total_accesses, planned_start_date, predecessor_activity_id, activity_priority
                           ) VALUES (%s, %s, %s, %s, %s, %s, %s, NULL, %s)
                           ON CONFLICT (activity_id) DO UPDATE SET
                            contract_number = EXCLUDED.contract_number,
                            activity_type = EXCLUDED.activity_type,
                            start_location_id = EXCLUDED.start_location_id,
                            end_location_id = EXCLUDED.end_location_id,
                            total_accesses = EXCLUDED.total_accesses,
                            planned_start_date = EXCLUDED.planned_start_date,
                            activity_priority = EXCLUDED.activity_priority;""",
                        (aid, cnum, atype, start_loc, end_loc, tot_acc, pstart, prio),
                    )

                    pred = act.get("predecessor_activity_id")
                    if pred and str(pred).strip():
                        predecessors_to_link.append((str(pred).strip(), aid))

                for pred_id, aid in predecessors_to_link:
                    cur.execute(
                        """UPDATE activities SET predecessor_activity_id = %s
                           WHERE activity_id = %s
                           AND EXISTS (SELECT 1 FROM activities WHERE activity_id = %s);""",
                        (pred_id, aid, pred_id),
                    )

                conn.commit()
                logger.info("Successfully synchronized %d activities to PostgreSQL", len(activities_data))
    except Exception as exc:
        logger.error("Failed to sync records to PostgreSQL: %s", exc)
        raise


@app.post("/api/database/sync", tags=["database"])
def sync_database_tables(request: DatabaseSyncRequest):
    """Synchronize uploaded/updated records to PostgreSQL as single source of truth,
    validate and persist preprocessor cache, and mirror verified dataset to server data directory.
    """
    data_dir = DEFAULT_DATA_DIR
    data_dir.mkdir(parents=True, exist_ok=True)

    # 1. Update PostgreSQL tables
    try:
        sync_records_to_postgres(request)
    except Exception as exc:
        logger.error("Could not sync records directly to PostgreSQL: %s", exc)
        raise HTTPException(status_code=422, detail=f"Database synchronization error: {exc}")

    _flush_persisted_schedule()

    # 2. Trigger preprocessor cache persistence in PostgreSQL
    try:
        sync_res = sync_and_save_preprocessed_to_database()
    except Exception as exc:
        logger.error("Could not persist preprocessed optimization data: %s", exc)
        raise HTTPException(status_code=422, detail=f"Dataset preprocessing validation error: {exc}")

    # 3. Export verified dataset from PostgreSQL into data_dir to keep disk mirror in sync
    try:
        with psycopg.connect(get_db_url(), autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SET search_path TO nebula, public;")
                # 01_LINES.csv
                cur.execute("SELECT line_code, line_name FROM lines ORDER BY line_code;")
                with (data_dir / "01_LINES.csv").open("w", newline="", encoding="utf-8") as f:
                    w = csv.writer(f); w.writerow(["line_code", "line_name"]); w.writerows(cur.fetchall())
                # 02_STATIONS.csv
                cur.execute("SELECT station_id, line_code, seq, CASE WHEN is_interchange THEN 1 ELSE 0 END FROM stations ORDER BY line_code, seq;")
                with (data_dir / "02_STATIONS.csv").open("w", newline="", encoding="utf-8") as f:
                    w = csv.writer(f); w.writerow(["station_id", "line_code", "seq", "is_interchange"]); w.writerows(cur.fetchall())
                # 03_SECTORS.csv
                cur.execute("""
                    SELECT sec.sector_id, sec.line_code, sec.from_station_id, sec.to_station_id, 
                           ROW_NUMBER() OVER (PARTITION BY sec.line_code ORDER BY COALESCE(st.seq, sec.seq, 1), sec.sector_id) AS seq, 
                           CASE WHEN sec.is_shared THEN 1 ELSE 0 END 
                    FROM sectors sec
                    LEFT JOIN stations st ON st.line_code = sec.line_code AND st.station_id = sec.from_station_id
                    ORDER BY sec.line_code, seq;
                """)
                with (data_dir / "03_SECTORS.csv").open("w", newline="", encoding="utf-8") as f:
                    w = csv.writer(f); w.writerow(["sector_id", "line_code", "from_station_id", "to_station_id", "seq", "is_shared"]); w.writerows(cur.fetchall())
                # 04_LOCATION_SUPPLY.csv
                cur.execute("""
                    SELECT location_id, location_kind, line_code, bound, supply_capacity 
                    FROM location_supply 
                    WHERE location_id IN (
                        SELECT 'PLAT:' || s.line_code || ':' || s.station_id || ':' || b.bound
                        FROM stations s CROSS JOIN (SELECT 'EB' AS bound UNION ALL SELECT 'WB' AS bound) b
                        UNION ALL
                        SELECT sec.sector_id || ':' || b.bound
                        FROM sectors sec CROSS JOIN (SELECT 'EB' AS bound UNION ALL SELECT 'WB' AS bound) b
                    )
                    ORDER BY location_id;
                """)
                with (data_dir / "04_LOCATION_SUPPLY.csv").open("w", newline="", encoding="utf-8") as f:
                    w = csv.writer(f); w.writerow(["location_id", "location_kind", "line_code", "bound", "supply_capacity"]); w.writerows(cur.fetchall())
                # 05_BUFFER_LOCATION.csv
                cur.execute("SELECT nature_of_works, up_to_buffer_sectors, CASE WHEN opposite_bound_required THEN 1 ELSE 0 END FROM buffer_rules ORDER BY nature_of_works;")
                with (data_dir / "05_BUFFER_LOCATION.csv").open("w", newline="", encoding="utf-8") as f:
                    w = csv.writer(f); w.writerow(["nature_of_works", "up_to_buffer_sectors", "opposite_bound_required"]); w.writerows(cur.fetchall())
                # 06_PARAMETERS.csv
                cur.execute("SELECT param_key, param_value FROM system_parameters ORDER BY param_key;")
                with (data_dir / "06_PARAMETERS.csv").open("w", newline="", encoding="utf-8") as f:
                    w = csv.writer(f); w.writerow(["key", "value"]); w.writerows(cur.fetchall())
                # 07_PROJECT_DETAILS.csv
                cur.execute("SELECT contract_number, contract_description, contract_award_date, activity_type, nature_of_activity, contract_priority, contract_completion_date, planned_completion_date, number_of_workfronts, access_type, number_of_maximum_access_per_week FROM contracts ORDER BY contract_number;")
                with (data_dir / "07_PROJECT_DETAILS.csv").open("w", newline="", encoding="utf-8") as f:
                    w = csv.writer(f); w.writerow(["contract_number", "contract_description", "contract_award_date", "activity_type", "nature_of_activity", "contract_priority", "contract_completion_date", "planned_completion_date", "number_of_workfronts", "access_type", "number_of_maximum_access_per_week"]); w.writerows(cur.fetchall())
                # 08_ACTIVITY_DETAILS.csv
                cur.execute("SELECT activity_id, contract_number, activity_type, start_location_id, end_location_id, total_accesses, TO_CHAR(planned_start_date, 'YYYY-MM-DD'), COALESCE(predecessor_activity_id, ''), activity_priority FROM activities ORDER BY activity_id;")
                with (data_dir / "08_ACTIVITY_DETAILS.csv").open("w", newline="", encoding="utf-8") as f:
                    w = csv.writer(f); w.writerow(["activity_id", "contract_number", "activity_type", "start_location_id", "end_location_id", "total_accesses", "planned_start_date", "predecessor_activity_id", "activity_priority"]); w.writerows(cur.fetchall())
    except Exception as exp_err:
        logger.warning("Could not export clean CSV mirror: %s", exp_err)

    # 4. Return active dataset signature
    signature = {}
    try:
        with psycopg.connect(get_db_url(), autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SET search_path TO nebula, public;")
                cur.execute("SELECT line_code FROM lines ORDER BY line_code;")
                lines_list = [r[0] for r in cur.fetchall()]
                cur.execute("SELECT count(*) FROM stations;")
                st_count = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM activities;")
                act_count = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM contracts;")
                c_count = cur.fetchone()[0]
                signature = {
                    "lines_count": len(lines_list),
                    "line_codes": lines_list,
                    "stations_count": st_count,
                    "activities_count": act_count,
                    "contracts_count": c_count,
                }
    except Exception:
        pass

    return {
        "status": "ok",
        "synced": True,
        "dataset_signature": signature,
        "preprocessed_activities": sync_res.get("activities_count", 0) if isinstance(sync_res, dict) else 0,
    }


# -----------------------------------------------------------------------------
# DISRUPTIONS CRUD
# -----------------------------------------------------------------------------
@app.get("/api/disruptions", tags=["disruptions"])
def list_disruptions():
    """Retrieve all operational disruptions from PostgreSQL."""
    db_url = get_db_url()
    try:
        with psycopg.connect(db_url, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SET search_path TO nebula, public;")
                cur.execute("""
                    SELECT 
                        disruption_id, disruption_type, title, description,
                        location_id, activity_id, from_week, to_week,
                        adjusted_capacity, delay_weeks, is_active,
                        created_at, created_by
                    FROM disruptions
                    ORDER BY created_at DESC;
                """)
                rows = []
                for r in cur.fetchall():
                    rows.append({
                        "disruption_id": r[0],
                        "disruption_type": r[1],
                        "title": r[2],
                        "description": r[3],
                        "location_id": r[4],
                        "activity_id": r[5],
                        "from_week": r[6],
                        "to_week": r[7],
                        "adjusted_capacity": r[8],
                        "delay_weeks": r[9],
                        "is_active": r[10],
                        "created_at": r[11].isoformat() if r[11] else None,
                        "created_by": r[12],
                    })
                return {"status": "ok", "disruptions": rows}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/disruptions", tags=["disruptions"])
def create_disruption(req: DisruptionCreateRequest):
    """Insert an operational disruption into PostgreSQL and recalibrate optimization cache."""
    disruption_id = f"disrupt-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    db_url = get_db_url()
    try:
        with psycopg.connect(db_url, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SET search_path TO nebula, public;")
                cur.execute(
                    """
                    INSERT INTO disruptions (
                        disruption_id, disruption_type, title, description,
                        location_id, activity_id, from_week, to_week,
                        adjusted_capacity, delay_weeks, is_active, created_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """,
                    (
                        disruption_id,
                        req.disruption_type,
                        req.title,
                        req.description,
                        req.location_id,
                        req.activity_id,
                        req.from_week,
                        req.to_week,
                        req.adjusted_capacity,
                        req.delay_weeks,
                        True,
                        req.created_by,
                    ),
                )
        # Recalculate preprocessed database cache
        sync_and_save_preprocessed_to_database()
        _flush_persisted_schedule()
        return {"status": "ok", "disruption_id": disruption_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/disruptions/{disruption_id}/toggle", tags=["disruptions"])
def toggle_disruption(disruption_id: str):
    """Toggle active state of a disruption and update preprocessed database cache."""
    db_url = get_db_url()
    try:
        with psycopg.connect(db_url, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SET search_path TO nebula, public;")
                cur.execute(
                    "UPDATE disruptions SET is_active = NOT is_active WHERE disruption_id = %s RETURNING is_active;",
                    (disruption_id,),
                )
                res = cur.fetchone()
                if not res:
                    raise HTTPException(status_code=404, detail="Disruption not found")
                new_state = res[0]
        sync_and_save_preprocessed_to_database()
        _flush_persisted_schedule()
        return {"status": "ok", "disruption_id": disruption_id, "is_active": new_state}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.delete("/api/disruptions/{disruption_id}", tags=["disruptions"])
def delete_disruption(disruption_id: str):
    """Delete a disruption and recalibrate optimization cache."""
    db_url = get_db_url()
    try:
        with psycopg.connect(db_url, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SET search_path TO nebula, public;")
                cur.execute("DELETE FROM disruptions WHERE disruption_id = %s;", (disruption_id,))
        sync_and_save_preprocessed_to_database()
        _flush_persisted_schedule()
        return {"status": "ok", "deleted": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# -----------------------------------------------------------------------------
# SOLVER & OPTIMIZATION
# -----------------------------------------------------------------------------
def _execute_solve(
    scenario: Literal["A", "B", "C"],
    max_time_seconds: float,
    sync_db: bool = True,
) -> dict[str, Any]:
    """Execute CP-SAT solve, write CSVs, sync to PostgreSQL, audit, and persist run."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with (OUTPUT_DIR / ".solve.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise HTTPException(status_code=409, detail="A solve is already running")

        try:
            service = SatSolverService(scenario)
            service.solve(max_time_seconds=max_time_seconds)
            report, tables = build_result(service)
            report["dataset_signature"] = {
                "lines_count": len(service.data.lines),
                "line_codes": list(service.data.lines.keys()),
                "activities_count": len(service.data.activities),
                "contracts_count": len(service.data.contracts),
            }

            if report["feasible"]:
                # Write CSV files
                write_result_csvs(tables, OUTPUT_DIR)
                report["detail"]["csv_written"] = True
                report["detail"]["output_directory"] = str(OUTPUT_DIR)

                # Standalone verification using live PostgreSQL data
                try:
                    data = load_prepared_problem_from_postgres()
                    val_res = validate_schedule(
                        data,
                        tables["SCHEDULE_ACCESS.csv"],
                        tables["SCHEDULE_OCCUPANCY.csv"],
                        tables["RESULTS.csv"],
                        scenario=scenario,
                    )
                    report["validation_log"] = val_res.get("validation_log", [])
                    report["detail"]["independent_validator_certified"] = val_res.get("feasible", False)
                except Exception as val_err:
                    logger.warning("Independent validation error: %s", val_err)
                    report["detail"]["independent_validator_certified"] = False

                if sync_db:
                    try:
                        sync_res = sync_schedule_to_postgres(
                            scenario=scenario,
                            results_rows=tables.get("RESULTS.csv", []),
                            access_rows=tables.get("SCHEDULE_ACCESS.csv", []),
                            occupancy_rows=tables.get("SCHEDULE_OCCUPANCY.csv", []),
                        )
                        report["detail"]["db_sync"] = sync_res
                    except Exception as e:
                        logger.warning("Could not sync schedule to PostgreSQL: %s", e)
                        report["detail"]["db_sync"] = {"status": "skipped_or_failed", "error": str(e)}

                # Persist planning run in PostgreSQL
                try:
                    run_id = f"run-{int(time.time())}-{uuid.uuid4().hex[:6]}"
                    db_url = get_db_url()
                    with psycopg.connect(db_url, autocommit=True) as conn:
                        with conn.cursor() as cur:
                            cur.execute("SET search_path TO nebula, public;")
                            cur.execute(
                                """
                                INSERT INTO planning_runs (
                                    run_id, scenario, revision_number, revision_type,
                                    validation_state, objective_score, hard_violations_count
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s);
                                """,
                                (
                                    run_id,
                                    scenario,
                                    f"Rev 1.{int(time.time()) % 1000}",
                                    "approved" if report.get("feasible") else "draft",
                                    "valid" if report.get("feasible") else "invalid",
                                    report.get("soft_scores", {}).get("penalty_score", report.get("soft_scores", {}).get("objective_score", 0)),
                                    len(report.get("hard_violations", [])),
                                ),
                            )
                            report["run_id"] = run_id
                except Exception as run_err:
                    logger.warning("Could not save planning run: %s", run_err)

            return report
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


@app.post("/api/recalculate", tags=["solver"])
def recalculate_schedule(request: SolveRequest):
    """Trigger CP-SAT recalculation using preprocessed data directly from PostgreSQL."""
    return _execute_solve(request.scenario, request.max_time_seconds, request.sync_db)


@app.get("/api/runs", tags=["runs"])
def get_planning_runs():
    """Retrieve history of saved planning runs from PostgreSQL."""
    db_url = get_db_url()
    try:
        with psycopg.connect(db_url, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SET search_path TO nebula, public;")
                cur.execute(
                    """
                    SELECT run_id, scenario, revision_number, revision_type,
                           validation_state, objective_score, hard_violations_count,
                           created_at
                    FROM planning_runs
                    ORDER BY created_at DESC;
                    """
                )
                rows = cur.fetchall()
                runs = []
                for r in rows:
                    runs.append({
                        "runId": r[0],
                        "scenario": r[1],
                        "revisionNumber": r[2],
                        "revisionType": r[3],
                        "validationState": r[4],
                        "objectiveScore": float(r[5]) if r[5] is not None else None,
                        "penaltyScore": float(r[5]) if r[5] is not None else None,
                        "hardViolationCount": int(r[6]) if r[6] is not None else 0,
                        "createdBy": {"id": "sys", "name": "Nebula Planner", "email": "planner@nebula.rail", "initials": "NP"},
                        "updatedBy": {"id": "sys", "name": "Nebula Planner", "email": "planner@nebula.rail", "initials": "NP"},
                        "createdAt": r[7].isoformat() if hasattr(r[7], "isoformat") else str(r[7]),
                        "updatedAt": r[7].isoformat() if hasattr(r[7], "isoformat") else str(r[7]),
                        "status": "ready" if r[4] == "valid" else "failed",
                        "parentRunId": None,
                    })
                return runs
    except Exception as exc:
        logger.warning("Could not fetch planning runs: %s", exc)
        return []


@app.post("/api/solver/solve", tags=["solver"])
def solve(request: SolveRequest):
    """Solve the track access optimization problem for the given scenario."""
    return _execute_solve(request.scenario, request.max_time_seconds, request.sync_db)


@app.post("/api/solver/audit", tags=["solver"])
@app.post("/api/solver/validate", tags=["solver"])
def audit_schedule(request: ValidationRequest):
    """Perform deterministic 8-rule audit against Problem Statement Section 2."""
    data = load_prepared_problem_from_postgres()

    acc = request.access_rows
    occ = request.occupancy_rows
    res = request.results_rows

    if acc is None or occ is None:
        acc_path = OUTPUT_DIR / "SCHEDULE_ACCESS.csv"
        occ_path = OUTPUT_DIR / "SCHEDULE_OCCUPANCY.csv"
        if not (acc_path.exists() and occ_path.exists()):
            raise HTTPException(status_code=404, detail="No output schedule files found on disk to validate.")

        with acc_path.open(encoding="utf-8") as f:
            acc = list(csv.DictReader(f))
        with occ_path.open(encoding="utf-8") as f:
            occ = list(csv.DictReader(f))

    if res is None:
        res_path = OUTPUT_DIR / "RESULTS.csv"
        if res_path.exists():
            with res_path.open(encoding="utf-8") as f:
                res = list(csv.DictReader(f))
        else:
            res = []

    return validate_schedule(data, acc, occ, res, scenario=request.scenario)


@app.get("/api/solver/current", tags=["solver"])
def get_current_solution(scenario: Literal["A", "B", "C"] = "A"):
    """Fetch the latest persisted schedule solution from disk/database."""
    acc_path = OUTPUT_DIR / "SCHEDULE_ACCESS.csv"
    occ_path = OUTPUT_DIR / "SCHEDULE_OCCUPANCY.csv"
    res_path = OUTPUT_DIR / "RESULTS.csv"

    if not (acc_path.exists() and occ_path.exists() and res_path.exists()):
        return {"has_solution": False, "scenario": scenario}

    mtime = acc_path.stat().st_mtime
    timestamp = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()

    with acc_path.open(encoding="utf-8") as f:
        acc = list(csv.DictReader(f))
    with occ_path.open(encoding="utf-8") as f:
        occ = list(csv.DictReader(f))
    with res_path.open(encoding="utf-8") as f:
        res = list(csv.DictReader(f))

    data = load_prepared_problem_from_postgres()
    audit = validate_schedule(data, acc, occ, res, scenario=scenario)

    return {
        "has_solution": True,
        "scenario": scenario,
        "timestamp": timestamp,
        "feasible": audit["feasible"],
        "soft_scores": audit["soft_scores"],
        "hard_violations": audit["hard_violations"],
        "validation_log": audit.get("validation_log", []),
        "access_rows_count": len(acc),
    }


@app.get("/api/solver/download/{filename}", tags=["export"])
def download_file(filename: str):
    """Download individual competition submission CSV."""
    allowed = {
        "SCHEDULE_ACCESS.csv": OUTPUT_DIR / "SCHEDULE_ACCESS.csv",
        "SCHEDULE_OCCUPANCY.csv": OUTPUT_DIR / "SCHEDULE_OCCUPANCY.csv",
        "RESULTS.csv": OUTPUT_DIR / "RESULTS.csv",
    }
    if filename not in allowed:
        raise HTTPException(status_code=404, detail=f"Invalid file: {filename}")

    target = allowed[filename]
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Deliverable {filename} has not been generated yet.")

    return FileResponse(
        path=str(target),
        filename=filename,
        media_type="text/csv",
    )


@app.get("/api/solver/download_zip", tags=["export"])
def download_zip(scenario: Literal["A", "B", "C"] = "A"):
    """Package all 3 competition submission CSVs into a single downloadable .zip archive."""
    required_files = [
        "SCHEDULE_ACCESS.csv",
        "SCHEDULE_OCCUPANCY.csv",
        "RESULTS.csv",
    ]

    missing = [f for f in required_files if not (OUTPUT_DIR / f).exists()]
    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"Cannot build zip; missing output files: {missing}",
        )

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in required_files:
            file_path = OUTPUT_DIR / fname
            zf.write(file_path, arcname=fname)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=nebula_submission_scenario_{scenario}.zip"
        },
    )
