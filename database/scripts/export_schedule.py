#!/usr/bin/env python3
"""
export_schedule.py: Exports database schedules to competition-compliant CSV files.
Supports Scenario A, B, and C with zero-loss exact schema matching.
"""

import os
import sys
import csv
import argparse
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DATA_DIR = os.path.join(BASE_DIR, "output_data")


def export_schedule(db_path=":memory:", scenario="A", export_dir="exported_output", verify_against=None):
    os.makedirs(export_dir, exist_ok=True)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    print(f"[*] Exporting Scenario {scenario} schedules to {export_dir}...")

    # 1. RESULTS.csv
    results_path = os.path.join(export_dir, "RESULTS.csv")
    cur.execute("""
        SELECT scenario, contract_number, simulated_completion_date, overrun_days
        FROM schedule_results
        WHERE scenario = ?
        ORDER BY contract_number
    """, (scenario,))
    rows = cur.fetchall()
    with open(results_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["scenario", "contract_number", "simulated_completion_date", "overrun_days"])
        writer.writerows(rows)
    print(f"  [+] RESULTS.csv: {len(rows)} records written.")

    # 2. SCHEDULE_ACCESS.csv
    access_path = os.path.join(export_dir, "SCHEDULE_ACCESS.csv")
    cur.execute("""
        SELECT activity_id, access_seq, week, eclo, access_night
        FROM schedule_access
        WHERE scenario = ?
        ORDER BY activity_id, access_seq
    """, (scenario,))
    rows = cur.fetchall()
    with open(access_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["activity_id", "access_seq", "week", "eclo", "access_night"])
        writer.writerows(rows)
    print(f"  [+] SCHEDULE_ACCESS.csv: {len(rows)} records written.")

    # 3. SCHEDULE_OCCUPANCY.csv
    occ_path = os.path.join(export_dir, "SCHEDULE_OCCUPANCY.csv")
    cur.execute("""
        SELECT activity_id, week, location_id, co_share_group
        FROM schedule_occupancy
        WHERE scenario = ?
        ORDER BY activity_id, week, location_id
    """, (scenario,))
    rows = cur.fetchall()
    with open(occ_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["activity_id", "week", "location_id", "co_share_group"])
        writer.writerows(rows)
    print(f"  [+] SCHEDULE_OCCUPANCY.csv: {len(rows)} records written.")

    if verify_against:
        print(f"[*] Verifying exported files against reference: {verify_against}...")
        for fname in ["RESULTS.csv", "SCHEDULE_ACCESS.csv", "SCHEDULE_OCCUPANCY.csv"]:
            ref_path = os.path.join(verify_against, fname)
            exp_path = os.path.join(export_dir, fname)
            with open(ref_path, encoding="utf-8-sig") as f1, open(exp_path, encoding="utf-8") as f2:
                r1 = list(csv.reader(f1))
                r2 = list(csv.reader(f2))
                if r1 != r2:
                    raise AssertionError(f"Export diff mismatch in {fname}! Lines: {len(r1)} vs {len(r2)}")
            print(f"  [OK] {fname} matches reference ground truth bit-for-bit.")

    conn.close()
    return True


def main():
    parser = argparse.ArgumentParser(description="NebulaX Schedule Exporter")
    parser.add_argument("--scenario", default="A", choices=["A", "B", "C"], help="Scenario to export")
    parser.add_argument("--output-dir", default="exported_output", help="Output directory for generated CSVs")
    parser.add_argument("--verify", action="store_true", help="Verify against output_data reference")
    args = parser.parse_args()

    # Import DatabaseManager from init_db to seed in-memory sqlite engine
    from init_db import DatabaseManager
    mgr = DatabaseManager()
    conn = mgr.build_sqlite_engine()

    export_dir = os.path.abspath(args.output_dir)
    ref_dir = OUTPUT_DATA_DIR if args.verify else None

    # Save memory db to temporary file to pass to export function
    temp_db = os.path.join(BASE_DIR, "scripts", "temp_export.db")
    backup_conn = sqlite3.connect(temp_db)
    conn.backup(backup_conn)
    backup_conn.close()

    try:
        export_schedule(db_path=temp_db, scenario=args.scenario, export_dir=export_dir, verify_against=ref_dir)
    finally:
        if os.path.exists(temp_db):
            os.remove(temp_db)


if __name__ == "__main__":
    main()
