"""NebulaX FastAPI Server.

Exposes CP-SAT optimization engine, standalone <150ms validator & scorer,
PostgreSQL database synchronization, and competition CSV/ZIP export endpoints.
"""

from __future__ import annotations

import csv
import io
import logging
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

import fcntl
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from .services.csv_preprocessor import preprocess_directory
from .services.db_sync import sync_schedule_to_postgres
from .services.sat_solver_service import SatSolverService
from .services.schedule_validator import validate_schedule
from .services.solve_results import OUTPUT_DIR, build_result, write_result_csvs

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nebula.main")

app = FastAPI(title="NebulaX Railway Track Access Optimization API")

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
    lines: list[dict[str, Any]] | None = None
    stations: list[dict[str, Any]] | None = None
    sectors: list[dict[str, Any]] | None = None
    location_supply: list[dict[str, Any]] | None = None
    buffer_rules: list[dict[str, Any]] | None = None
    parameters: list[dict[str, Any]] | None = None
    contracts: list[dict[str, Any]] | None = None
    activities: list[dict[str, Any]] | None = None


def _flush_persisted_schedule():
    """Unlink persisted schedule files when underlying database records are modified or flushed."""
    for f in ["SCHEDULE_ACCESS.csv", "SCHEDULE_OCCUPANCY.csv", "RESULTS.csv"]:
        target = OUTPUT_DIR / f
        if target.exists():
            try:
                target.unlink()
            except Exception:
                pass


@app.post("/api/database/flush", tags=["database"])
def flush_database_output():
    """Flush previous schedule calculation results and reset state to awaiting calculation."""
    _flush_persisted_schedule()
    return {"status": "ok", "flushed": True, "message": "Calculated schedules invalidated and flushed."}


@app.post("/api/database/sync", tags=["database"])
def sync_database_tables(request: DatabaseSyncRequest):
    """Sync live database records to solver input CSV directory and flush previous schedules."""
    data_dir = DEFAULT_DATA_DIR
    data_dir.mkdir(parents=True, exist_ok=True)

    if request.lines is not None:
        lines_path = data_dir / "01_LINES.csv"
        with lines_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["line_code", "line_name"])
            for r in request.lines:
                writer.writerow([r.get("line_code", ""), r.get("line_name", "")])

    if request.stations is not None:
        stations_path = data_dir / "02_STATIONS.csv"
        with stations_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["station_id", "line_code", "seq", "is_interchange"])
            for r in request.stations:
                writer.writerow([
                    r.get("station_id", ""),
                    r.get("line_code", ""),
                    r.get("seq", 0),
                    1 if r.get("is_interchange") else 0,
                ])

    if request.sectors is not None:
        sectors_path = data_dir / "03_SECTORS.csv"
        with sectors_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["sector_id", "line_code", "from_station_id", "to_station_id", "seq", "is_shared"])
            for r in request.sectors:
                writer.writerow([
                    r.get("sector_id", ""),
                    r.get("line_code", ""),
                    r.get("from_station_id", ""),
                    r.get("to_station_id", ""),
                    r.get("seq", 0),
                    1 if r.get("is_shared") else 0,
                ])

    if request.location_supply is not None:
        supply_path = data_dir / "04_LOCATION_SUPPLY.csv"
        with supply_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["location_id", "location_kind", "line_code", "bound", "supply_capacity"])
            for r in request.location_supply:
                writer.writerow([
                    r.get("location_id", ""),
                    r.get("location_kind", ""),
                    r.get("line_code", ""),
                    r.get("bound", ""),
                    r.get("supply_capacity", 0),
                ])

    if request.buffer_rules is not None:
        buffer_path = data_dir / "05_BUFFER_LOCATION.csv"
        with buffer_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["nature_of_works", "up_to_buffer_sectors", "opposite_bound_required"])
            for r in request.buffer_rules:
                writer.writerow([
                    r.get("nature_of_works", ""),
                    r.get("up_to_buffer_sectors", 0),
                    1 if r.get("opposite_bound_required") else 0,
                ])

    if request.parameters is not None:
        params_path = data_dir / "06_PARAMETERS.csv"
        with params_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["key", "value"])
            for r in request.parameters:
                writer.writerow([r.get("key", ""), r.get("value", "")])

    if request.contracts is not None:
        contracts_path = data_dir / "07_PROJECT_DETAILS.csv"
        with contracts_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "contract_number", "contract_description", "contract_award_date",
                "activity_type", "nature_of_activity", "contract_priority",
                "contract_completion_date", "planned_completion_date",
                "number_of_workfronts", "access_type", "number_of_maximum_access_per_week"
            ])
            for r in request.contracts:
                writer.writerow([
                    r.get("contract_number", ""),
                    r.get("contract_description", ""),
                    r.get("contract_award_date", ""),
                    r.get("activity_type", ""),
                    r.get("nature_of_activity", ""),
                    r.get("contract_priority", 1),
                    r.get("contract_completion_date", ""),
                    r.get("planned_completion_date", ""),
                    r.get("number_of_workfronts", 1),
                    r.get("access_type", ""),
                    r.get("number_of_maximum_access_per_week", 1),
                ])

    if request.activities is not None:
        act_path = data_dir / "08_ACTIVITY_DETAILS.csv"
        with act_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "activity_id", "contract_number", "activity_type",
                "start_location_id", "end_location_id", "total_accesses",
                "planned_start_date", "predecessor_activity_id", "activity_priority"
            ])
            for r in request.activities:
                writer.writerow([
                    r.get("activity_id", ""),
                    r.get("contract_number", ""),
                    r.get("activity_type", ""),
                    r.get("start_location_id", ""),
                    r.get("end_location_id", ""),
                    r.get("total_accesses", 0),
                    r.get("planned_start_date", ""),
                    r.get("predecessor_activity_id") or "",
                    r.get("activity_priority", 1),
                ])

    _flush_persisted_schedule()
    return {"status": "ok", "synced": True, "data_dir": str(data_dir)}


def _execute_solve(scenario: Literal["A", "B", "C"], max_time_seconds: float, sync_db: bool = True) -> dict[str, Any]:
    """Internal helper to execute CP-SAT solve, write CSVs, sync to PostgreSQL, and audit."""
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

            if report["feasible"]:
                # Write CSV files
                write_result_csvs(tables, OUTPUT_DIR)
                report["detail"]["csv_written"] = True
                report["detail"]["output_directory"] = str(OUTPUT_DIR)

                # Standalone verification & validation log enrichment
                try:
                    data = preprocess_directory()
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
                    logger.warning("Independent validation encountered warning: %s", val_err)
                    report["validation_log"] = []

                # Synchronize to PostgreSQL database if requested
                if sync_db:
                    db_result = sync_schedule_to_postgres(
                        scenario=scenario,
                        results_rows=tables["RESULTS.csv"],
                        access_rows=tables["SCHEDULE_ACCESS.csv"],
                        occupancy_rows=tables["SCHEDULE_OCCUPANCY.csv"],
                    )
                    report["detail"]["database_sync"] = db_result

            return report
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


@app.get("/stub_solve", tags=["solver"])
def stub_solve(
    scenario: Literal["A", "B", "C"] = "A",
    max_time_seconds: float = Query(default=60, gt=0, le=300),
):
    """Backward-compatible endpoint to trigger solve."""
    return _execute_solve(scenario, max_time_seconds, sync_db=True)


@app.post("/api/solver/solve", tags=["solver"])
def solve_endpoint(request: SolveRequest):
    """Trigger CP-SAT solver for Scenario A, B, or C with customized runtime budget."""
    return _execute_solve(request.scenario, request.max_time_seconds, request.sync_db)


@app.post("/api/solver/validate", tags=["validator"])
def validate_endpoint(request: ValidationRequest):
    """Audit any schedule against all 8 rigid safety rules in <150ms without running CP-SAT.

    If rows are omitted, reads the current files from actual_output.
    """
    data = preprocess_directory()

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

    data = preprocess_directory()
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
