"""NebulaX FastAPI Server.

Exposes CP-SAT optimization engine, standalone <150ms validator & scorer,
PostgreSQL database synchronization, and competition CSV/ZIP export endpoints.
"""

from __future__ import annotations

import csv
import io
import logging
import zipfile
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

    if acc is None or occ is None or res is None:
        acc_path = OUTPUT_DIR / "SCHEDULE_ACCESS.csv"
        occ_path = OUTPUT_DIR / "SCHEDULE_OCCUPANCY.csv"
        res_path = OUTPUT_DIR / "RESULTS.csv"

        if not (acc_path.exists() and occ_path.exists() and res_path.exists()):
            raise HTTPException(status_code=404, detail="No output schedule files found on disk to validate.")

        with acc_path.open(encoding="utf-8") as f:
            acc = list(csv.DictReader(f))
        with occ_path.open(encoding="utf-8") as f:
            occ = list(csv.DictReader(f))
        with res_path.open(encoding="utf-8") as f:
            res = list(csv.DictReader(f))

    return validate_schedule(data, acc, occ, res, scenario=request.scenario)


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
