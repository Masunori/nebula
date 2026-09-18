import logging

import fcntl
from typing import Literal

from fastapi import FastAPI, HTTPException, Query

from .services.sat_solver_service import SatSolverService
from .services.solve_results import OUTPUT_DIR, build_result, write_result_csvs
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app = FastAPI()


@app.get("/health", tags=["system"])
async def health_check():
    """
    Health check endpoint to verify that the service is running.
    """
    return {"status": "ok"}


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)


@app.get("/stub_solve", tags=["solver"])
def stub_solve(
    scenario: Literal["A", "B", "C"] = "A",
    max_time_seconds: float = Query(default=60, gt=0, le=300),
):
    """Solve bundled CSV inputs, report scores, and replace actual_output CSVs.

    Runs in FastAPI's thread pool. A file lock prevents concurrent workers
    from solving/exporting into the same output directory. UNKNOWN and
    INFEASIBLE results do not overwrite the last successful CSV files.
    """
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
                write_result_csvs(tables, OUTPUT_DIR)
                report["detail"]["csv_written"] = True
                report["detail"]["output_directory"] = "server/data/actual_output"
            return report
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)
