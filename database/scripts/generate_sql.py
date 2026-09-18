#!/usr/bin/env python3
"""
generate_sql.py: Generates pure SQL seed scripts (03_seed_init.sql and 05_seed_output.sql)
from init_data/ and output_data/ CSV files.
"""

import os
import csv
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INIT_DIR = os.path.join(BASE_DIR, "init_data")
OUTPUT_DIR = os.path.join(BASE_DIR, "output_data")
SQL_DIR = os.path.join(BASE_DIR, "sql")


def read_csv(path):
    with open(path, mode="r", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def escape_sql(val):
    if val is None or val == "":
        return "NULL"
    val = str(val).replace("'", "''")
    return f"'{val}'"


def generate_seed_init():
    lines_csv = read_csv(os.path.join(INIT_DIR, "01_LINES.csv"))
    stations_csv = read_csv(os.path.join(INIT_DIR, "02_STATIONS.csv"))
    sectors_csv = read_csv(os.path.join(INIT_DIR, "03_SECTORS.csv"))
    supply_csv = read_csv(os.path.join(INIT_DIR, "04_LOCATION_SUPPLY.csv"))
    buffer_csv = read_csv(os.path.join(INIT_DIR, "05_BUFFER_LOCATION.csv"))
    params_csv = read_csv(os.path.join(INIT_DIR, "06_PARAMETERS.csv"))
    contracts_csv = read_csv(os.path.join(INIT_DIR, "07_PROJECT_DETAILS.csv"))
    activities_csv = read_csv(os.path.join(INIT_DIR, "08_ACTIVITY_DETAILS.csv"))

    out = []
    out.append("-- =============================================================================")
    out.append("-- NebulaX Railway Track Access Optimisation")
    out.append("-- 03_seed_init.sql: Seed Initial Problem Data & Temporal Dimension")
    out.append("-- =============================================================================\n")
    out.append("SET search_path TO nebula, public;\n")

    # 1. Lines
    out.append("-- 1. LINES")
    for r in lines_csv:
        out.append(f"INSERT INTO lines (line_code, line_name) VALUES ({escape_sql(r['line_code'])}, {escape_sql(r['line_name'])}) ON CONFLICT (line_code) DO NOTHING;")
    out.append("")

    # 2. Stations
    out.append("-- 2. STATIONS")
    for r in stations_csv:
        is_inter = "TRUE" if r["is_interchange"] in ("1", "true", "True") else "FALSE"
        out.append(f"INSERT INTO stations (station_id, line_code, seq, is_interchange) VALUES ({escape_sql(r['station_id'])}, {escape_sql(r['line_code'])}, {r['seq']}, {is_inter}) ON CONFLICT (station_id, line_code) DO NOTHING;")
    out.append("")

    # 3. Sectors
    out.append("-- 3. SECTORS")
    for r in sectors_csv:
        is_shared = "TRUE" if r["is_shared"] in ("1", "true", "True") else "FALSE"
        out.append(f"INSERT INTO sectors (sector_id, line_code, from_station_id, to_station_id, seq, is_shared) VALUES ({escape_sql(r['sector_id'])}, {escape_sql(r['line_code'])}, {escape_sql(r['from_station_id'])}, {escape_sql(r['to_station_id'])}, {r['seq']}, {is_shared}) ON CONFLICT (sector_id) DO NOTHING;")
    out.append("")

    # 4. Location Supply
    out.append("-- 4. LOCATION_SUPPLY")
    for r in supply_csv:
        out.append(f"INSERT INTO location_supply (location_id, location_kind, line_code, bound, supply_capacity) VALUES ({escape_sql(r['location_id'])}, {escape_sql(r['location_kind'])}, {escape_sql(r['line_code'])}, {escape_sql(r['bound'])}, {r['supply_capacity']}) ON CONFLICT (location_id) DO NOTHING;")
    out.append("")

    # 5. Buffer Rules
    out.append("-- 5. BUFFER_RULES")
    for r in buffer_csv:
        opp = "TRUE" if r["opposite_bound_required"] in ("1", "true", "True") else "FALSE"
        out.append(f"INSERT INTO buffer_rules (nature_of_works, up_to_buffer_sectors, opposite_bound_required) VALUES ({escape_sql(r['nature_of_works'])}, {r['up_to_buffer_sectors']}, {opp}) ON CONFLICT (nature_of_works) DO NOTHING;")
    out.append("")

    # 6. System Parameters
    out.append("-- 6. SYSTEM_PARAMETERS")
    horizon_start_str = "2027-01-04"
    horizon_weeks = 30
    for r in params_csv:
        if r["key"] == "horizon_start":
            horizon_start_str = r["value"]
        elif r["key"] == "horizon_weeks":
            horizon_weeks = int(r["value"])
        out.append(f"INSERT INTO system_parameters (param_key, param_value, description) VALUES ({escape_sql(r['key'])}, {escape_sql(r['value'])}, {escape_sql('System parameter ' + r['key'])}) ON CONFLICT (param_key) DO UPDATE SET param_value = EXCLUDED.param_value;")
    out.append("")

    # 7. Calendar Weeks Dimension
    out.append("-- 7. DIM_CALENDAR_WEEKS (Dynamically populated from horizon parameters)")
    h_start = datetime.strptime(horizon_start_str, "%Y-%m-%d").date()
    for w in range(1, horizon_weeks + 1):
        w_start = h_start + timedelta(days=(w - 1) * 7)
        w_end = w_start + timedelta(days=6)
        out.append(f"INSERT INTO dim_calendar_weeks (week_number, start_date, end_date) VALUES ({w}, '{w_start.isoformat()}', '{w_end.isoformat()}') ON CONFLICT (week_number) DO NOTHING;")
    out.append("")

    # 8. Contracts
    out.append("-- 8. CONTRACTS")
    for r in contracts_csv:
        out.append(f"INSERT INTO contracts (contract_number, contract_description, contract_award_date, activity_type, nature_of_activity, contract_priority, contract_completion_date, planned_completion_date, number_of_workfronts, access_type, number_of_maximum_access_per_week) VALUES ({escape_sql(r['contract_number'])}, {escape_sql(r['contract_description'])}, '{r['contract_award_date']}', {escape_sql(r['activity_type'])}, {escape_sql(r['nature_of_activity'])}, {r['contract_priority']}, '{r['contract_completion_date']}', '{r['planned_completion_date']}', {r['number_of_workfronts']}, {escape_sql(r['access_type'])}, {r['number_of_maximum_access_per_week']}) ON CONFLICT (contract_number) DO NOTHING;")
    out.append("")

    # 9. Activities
    out.append("-- 9. ACTIVITIES")
    # First insert activities without predecessors to prevent FK constraint violation
    for r in activities_csv:
        pred = escape_sql(r["predecessor_activity_id"]) if r.get("predecessor_activity_id") else "NULL"
        out.append(f"INSERT INTO activities (activity_id, contract_number, activity_type, start_location_id, end_location_id, total_accesses, planned_start_date, predecessor_activity_id, activity_priority) VALUES ({escape_sql(r['activity_id'])}, {escape_sql(r['contract_number'])}, {escape_sql(r['activity_type'])}, {escape_sql(r['start_location_id'])}, {escape_sql(r['end_location_id'])}, {r['total_accesses']}, '{r['planned_start_date']}', {pred}, {r['activity_priority']}) ON CONFLICT (activity_id) DO NOTHING;")
    out.append("")

    # 10. Rebuild Spatial Topology
    out.append("-- 10. REBUILD 1D SPATIAL TOPOLOGY")
    out.append("SELECT rebuild_network_topology();\n")

    output_path = os.path.join(SQL_DIR, "03_seed_init.sql")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"Generated {output_path} ({len(out)} lines)")


def generate_seed_output():
    results_csv = read_csv(os.path.join(OUTPUT_DIR, "RESULTS.csv"))
    access_csv = read_csv(os.path.join(OUTPUT_DIR, "SCHEDULE_ACCESS.csv"))
    occupancy_csv = read_csv(os.path.join(OUTPUT_DIR, "SCHEDULE_OCCUPANCY.csv"))

    out = []
    out.append("-- =============================================================================")
    out.append("-- NebulaX Railway Track Access Optimisation")
    out.append("-- 05_seed_output.sql: Seed Reference Solution Data (Scenario A)")
    out.append("-- =============================================================================\n")
    out.append("SET search_path TO nebula, public;\n")

    # 1. Schedule Results
    out.append("-- 1. SCHEDULE_RESULTS")
    for r in results_csv:
        scen = r.get("scenario", "A")
        out.append(f"INSERT INTO schedule_results (scenario, contract_number, simulated_completion_date, overrun_days) VALUES ({escape_sql(scen)}, {escape_sql(r['contract_number'])}, '{r['simulated_completion_date']}', {r['overrun_days']}) ON CONFLICT (scenario, contract_number) DO UPDATE SET simulated_completion_date = EXCLUDED.simulated_completion_date, overrun_days = EXCLUDED.overrun_days;")
    out.append("")

    # 2. Schedule Access
    out.append("-- 2. SCHEDULE_ACCESS (Batched Inserts)")
    batch = []
    for r in access_csv:
        scen = "A"
        eclo = int(r.get("eclo", 0))
        batch.append(f"({escape_sql(scen)}, {escape_sql(r['activity_id'])}, {r['access_seq']}, {r['week']}, {eclo}, {r['access_night']})")
        if len(batch) >= 50:
            out.append(f"INSERT INTO schedule_access (scenario, activity_id, access_seq, week, eclo, access_night) VALUES\n  " + ",\n  ".join(batch) + "\nON CONFLICT (scenario, activity_id, access_seq) DO UPDATE SET week = EXCLUDED.week, eclo = EXCLUDED.eclo, access_night = EXCLUDED.access_night;")
            batch = []
    if batch:
        out.append(f"INSERT INTO schedule_access (scenario, activity_id, access_seq, week, eclo, access_night) VALUES\n  " + ",\n  ".join(batch) + "\nON CONFLICT (scenario, activity_id, access_seq) DO UPDATE SET week = EXCLUDED.week, eclo = EXCLUDED.eclo, access_night = EXCLUDED.access_night;")
    out.append("")

    # 3. Schedule Occupancy
    out.append("-- 3. SCHEDULE_OCCUPANCY (Batched Inserts)")
    batch = []
    for r in occupancy_csv:
        scen = "A"
        batch.append(f"({escape_sql(scen)}, {escape_sql(r['activity_id'])}, {r['week']}, {escape_sql(r['location_id'])}, {escape_sql(r['co_share_group'])})")
        if len(batch) >= 50:
            out.append(f"INSERT INTO schedule_occupancy (scenario, activity_id, week, location_id, co_share_group) VALUES\n  " + ",\n  ".join(batch) + "\nON CONFLICT (scenario, activity_id, week, location_id) DO UPDATE SET co_share_group = EXCLUDED.co_share_group;")
            batch = []
    if batch:
        out.append(f"INSERT INTO schedule_occupancy (scenario, activity_id, week, location_id, co_share_group) VALUES\n  " + ",\n  ".join(batch) + "\nON CONFLICT (scenario, activity_id, week, location_id) DO UPDATE SET co_share_group = EXCLUDED.co_share_group;")
    out.append("")

    output_path = os.path.join(SQL_DIR, "05_seed_output.sql")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"Generated {output_path} ({len(out)} lines)")


if __name__ == "__main__":
    generate_seed_init()
    generate_seed_output()
