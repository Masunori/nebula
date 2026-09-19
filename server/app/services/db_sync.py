"""PostgreSQL synchronization service for NebulaX schedule results.

Syncs the generated schedule tables into PostgreSQL:
- nebula.schedule_results
- nebula.schedule_access
- nebula.schedule_occupancy
"""

from __future__ import annotations

import logging
import os
from typing import Any, Mapping, Sequence

logger = logging.getLogger("nebula.db_sync")


def get_db_url() -> str:
    return os.environ.get(
        "DATABASE_URL",
        "postgresql://nebula_user:nebula_password@database:5432/nebula",
    )


def sync_schedule_to_postgres(
    scenario: str,
    results_rows: Sequence[Mapping[str, Any]],
    access_rows: Sequence[Mapping[str, Any]],
    occupancy_rows: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Upsert schedule outputs for the given scenario into PostgreSQL tables."""
    try:
        import psycopg
    except ImportError:
        logger.warning("psycopg not installed; skipping PostgreSQL sync")
        return {"status": "skipped", "reason": "psycopg not installed"}

    db_url = get_db_url()

    try:
        with psycopg.connect(db_url, autocommit=False) as conn:
            with conn.cursor() as cur:
                # Set schema
                cur.execute("SET search_path TO nebula, public;")

                # 1. Sync schedule_results
                # Clear previous scenario results
                cur.execute("DELETE FROM schedule_results WHERE scenario = %s;", (scenario,))
                if results_rows:
                    cur.executemany(
                        """
                        INSERT INTO schedule_results (scenario, contract_number, simulated_completion_date, overrun_days)
                        VALUES (%s, %s, %s, %s);
                        """,
                        [
                            (
                                str(row.get("scenario", scenario)),
                                str(row["contract_number"]),
                                str(row["simulated_completion_date"]),
                                int(row.get("overrun_days", 0)),
                            )
                            for row in results_rows
                        ],
                    )

                # 2. Sync schedule_access
                cur.execute("DELETE FROM schedule_access WHERE scenario = %s;", (scenario,))
                if access_rows:
                    cur.executemany(
                        """
                        INSERT INTO schedule_access (scenario, activity_id, access_seq, week, eclo, access_night)
                        VALUES (%s, %s, %s, %s, %s, %s);
                        """,
                        [
                            (
                                scenario,
                                str(row["activity_id"]),
                                int(row["access_seq"]),
                                int(row["week"]),
                                int(row.get("eclo", 0)),
                                int(row["access_night"]),
                            )
                            for row in access_rows
                        ],
                    )

                # 3. Sync schedule_occupancy
                cur.execute("DELETE FROM schedule_occupancy WHERE scenario = %s;", (scenario,))
                if occupancy_rows:
                    cur.executemany(
                        """
                        INSERT INTO schedule_occupancy (scenario, activity_id, week, location_id, co_share_group)
                        VALUES (%s, %s, %s, %s, %s);
                        """,
                        [
                            (
                                scenario,
                                str(row["activity_id"]),
                                int(row["week"]),
                                str(row["location_id"]),
                                str(row.get("co_share_group", "")),
                            )
                            for row in occupancy_rows
                        ],
                    )

            conn.commit()
            logger.info("Synchronized %d results, %d accesses, %d occupancies to PostgreSQL for scenario %s",
                        len(results_rows), len(access_rows), len(occupancy_rows), scenario)
            return {
                "status": "success",
                "scenario": scenario,
                "synced_results": len(results_rows),
                "synced_accesses": len(access_rows),
                "synced_occupancies": len(occupancy_rows),
            }

    except Exception as exc:
        logger.error("Failed to sync schedule to PostgreSQL: %s", exc)
        return {
            "status": "error",
            "error": str(exc),
        }
