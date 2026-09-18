"""
db_service.py: Decoupled Data Access and Analytics Service.
Provides a clean Python API returning structured dictionaries/JSON.
Can be imported directly by the TUI now, and by FastAPI endpoints for Next.js later.
"""

import os
import sys
import csv
import sqlite3
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INIT_DATA_DIR = os.path.join(BASE_DIR, "init_data")
OUTPUT_DATA_DIR = os.path.join(BASE_DIR, "output_data")

# Add scripts directory to path to use DatabaseManager
sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))
from init_db import DatabaseManager


class DBAnalyticsService:
    """Service providing high-level analytical queries, parameter updates, and re-seeding."""

    REQUIRED_CSVS = [
        "01_LINES.csv", "02_STATIONS.csv", "03_SECTORS.csv", "04_LOCATION_SUPPLY.csv",
        "05_BUFFER_LOCATION.csv", "06_PARAMETERS.csv", "07_PROJECT_DETAILS.csv", "08_ACTIVITY_DETAILS.csv"
    ]

    def __init__(self, seed_dir=None):
        self.seed_dir = seed_dir or INIT_DATA_DIR
        self.mgr = DatabaseManager(seed_dir=self.seed_dir)
        self.conn = self.mgr.build_sqlite_engine()

    # -------------------------------------------------------------------------
    # Network & Topology Queries
    # -------------------------------------------------------------------------
    def get_lines(self):
        """Returns list of lines."""
        cur = self.conn.cursor()
        cur.execute("SELECT line_code, line_name FROM lines ORDER BY line_code")
        return [{"line_code": r[0], "line_name": r[1]} for r in cur.fetchall()]

    def get_topology_layout(self, line_code="ALP", bound="EB"):
        """Returns ordered layout of stations and sectors along the line/bound."""
        cur = self.conn.cursor()
        cur.execute("""
            SELECT nt.seq_coord, nt.location_id, nt.location_kind,
                   COALESCE(nt.station_id, nt.sector_id) AS physical_name,
                   ls.supply_capacity
            FROM network_topology nt
            JOIN location_supply ls ON ls.location_id = nt.location_id
            WHERE nt.line_code = ? AND nt.bound = ?
            ORDER BY nt.seq_coord ASC
        """, (line_code, bound))
        return [{
            "seq_coord": r[0],
            "location_id": r[1],
            "location_kind": r[2],
            "physical_name": r[3],
            "supply_capacity": r[4]
        } for r in cur.fetchall()]

    def get_interchange_hubs(self):
        """Dynamically discovers all interchange stations shared across 2 or more lines."""
        cur = self.conn.cursor()
        cur.execute("""
            SELECT station_id, GROUP_CONCAT(line_code, ', ') AS lines_sharing, COUNT(DISTINCT line_code) AS line_count
            FROM stations
            GROUP BY station_id
            HAVING line_count > 1
            ORDER BY station_id
        """)
        return {r[0]: {"lines": r[1].split(", "), "count": r[2]} for r in cur.fetchall()}

    def get_all_lines_network_summary(self, bound="EB", week=None, scenario="A"):
        """
        Returns high-level network topology and operational metrics across ALL lines in the database.
        """
        cur = self.conn.cursor()
        lines = self.get_lines()
        hubs = self.get_interchange_hubs()

        bookings = {}
        if week is not None:
            cur.execute("""
                SELECT location_id, COUNT(DISTINCT co_share_group) AS used
                FROM schedule_occupancy
                WHERE scenario = ? AND week = ?
                GROUP BY location_id
            """, (scenario, week))
            bookings = dict(cur.fetchall())

        summary = []
        for line in lines:
            lcode = line["line_code"]
            lname = line["line_name"]

            cur.execute("SELECT COUNT(DISTINCT station_id) FROM stations WHERE line_code = ?", (lcode,))
            station_cnt = cur.fetchone()[0]

            cur.execute("SELECT COUNT(DISTINCT sector_id) FROM sectors WHERE line_code = ?", (lcode,))
            sector_cnt = cur.fetchone()[0]

            # Interchange connections for this line
            line_interchanges = []
            for hid, hinfo in hubs.items():
                if lcode in hinfo["lines"]:
                    other_lines = [l for l in hinfo["lines"] if l != lcode]
                    line_interchanges.append(f"{hid} ({','.join(other_lines)})")

            # Weekly usage stats if week specified
            cur.execute("""
                SELECT nt.location_id, ls.supply_capacity
                FROM network_topology nt
                JOIN location_supply ls ON ls.location_id = nt.location_id
                WHERE nt.line_code = ? AND nt.bound = ?
            """, (lcode, bound))
            loc_caps = cur.fetchall()

            total_cap = sum(r[1] for r in loc_caps)
            total_used = sum(bookings.get(r[0], 0) for r in loc_caps)
            over_cap_count = sum(1 for r in loc_caps if bookings.get(r[0], 0) > r[1])

            summary.append({
                "line_code": lcode,
                "line_name": lname,
                "station_count": station_cnt,
                "sector_count": sector_cnt,
                "interchanges": line_interchanges,
                "total_capacity": total_cap,
                "total_used": total_used,
                "over_capacity_count": over_cap_count
            })

        return {
            "bound": bound,
            "week": week,
            "scenario": scenario,
            "lines_count": len(lines),
            "lines": summary,
            "interchange_hubs": hubs
        }

    def get_all_lines_tracks(self, bound="EB", week=None, scenario="A"):
        """Returns the sequential track layout for EVERY line in the database."""
        cur = self.conn.cursor()
        lines = self.get_lines()
        hubs = self.get_interchange_hubs()

        bookings = {}
        if week is not None:
            cur.execute("""
                SELECT location_id, COUNT(DISTINCT co_share_group) AS used, COUNT(DISTINCT activity_id) AS acts
                FROM schedule_occupancy
                WHERE scenario = ? AND week = ?
                GROUP BY location_id
            """, (scenario, week))
            bookings = {r[0]: {"used": r[1], "activities": r[2]} for r in cur.fetchall()}

        result = {}
        for line in lines:
            lcode = line["line_code"]
            cur.execute("""
                SELECT nt.seq_coord, nt.location_id, nt.location_kind,
                       COALESCE(nt.station_id, nt.sector_id) AS physical_name,
                       ls.supply_capacity,
                       nt.station_id
                FROM network_topology nt
                JOIN location_supply ls ON ls.location_id = nt.location_id
                WHERE nt.line_code = ? AND nt.bound = ?
                ORDER BY nt.seq_coord ASC
            """, (lcode, bound))
            nodes = []
            for r in cur.fetchall():
                lid = r[1]
                st_id = r[5]
                b_info = bookings.get(lid, {"used": 0, "activities": 0})
                is_hub = st_id in hubs if st_id else any(hid in lid for hid in hubs.keys())
                nodes.append({
                    "seq_coord": r[0],
                    "location_id": lid,
                    "location_kind": r[2],
                    "physical_name": r[3],
                    "supply_capacity": r[4],
                    "is_interchange": is_hub,
                    "interchange_lines": hubs.get(st_id, {}).get("lines", []) if is_hub and st_id else [],
                    "used_slots": b_info["used"],
                    "activities_count": b_info["activities"],
                    "is_over_capacity": b_info["used"] > r[4]
                })
            result[lcode] = {
                "line_name": line["line_name"],
                "nodes": nodes
            }
        return result

    def get_dual_line_network_layout(self, bound="EB", week=None, scenario="A", line_a=None, line_b=None):
        """
        Returns structured network layout comparing any two lines (defaults to first two lines).
        Tags dynamic interchange hubs and attaches live bookings if week specified.
        """
        all_lines = self.get_lines()
        l_codes = [l["line_code"] for l in all_lines]
        l1 = line_a if line_a in l_codes else (l_codes[0] if len(l_codes) > 0 else "ALP")
        l2 = line_b if line_b in l_codes else (l_codes[1] if len(l_codes) > 1 else l1)

        all_tracks = self.get_all_lines_tracks(bound=bound, week=week, scenario=scenario)
        hubs = self.get_interchange_hubs()

        return {
            "bound": bound,
            "week": week,
            "scenario": scenario,
            "line_a": l1,
            "line_b": l2,
            "line_a_nodes": all_tracks.get(l1, {}).get("nodes", []),
            "line_b_nodes": all_tracks.get(l2, {}).get("nodes", []),
            "hub_stations": list(hubs.keys())
        }

    # -------------------------------------------------------------------------
    # Capacity Heatmap Queries
    # -------------------------------------------------------------------------
    def get_capacity_heatmap(self, scenario="A", line_code="ALP", bound="EB", week_start=1, week_end=15):
        """
        Returns 2D grid matrix of locations vs weeks.
        Supports line_code='ALL' to return all locations across the entire network.
        """
        cur = self.conn.cursor()
        if line_code == "ALL":
            cur.execute("""
                SELECT nt.seq_coord, nt.location_id, nt.location_kind,
                       COALESCE(nt.station_id, nt.sector_id) AS physical_name,
                       ls.supply_capacity, nt.line_code
                FROM network_topology nt
                JOIN location_supply ls ON ls.location_id = nt.location_id
                WHERE nt.bound = ?
                ORDER BY nt.line_code, nt.seq_coord ASC
            """, (bound,))
            locations = [{
                "seq_coord": r[0],
                "location_id": r[1],
                "location_kind": r[2],
                "physical_name": f"{r[5]}:{r[3]}",
                "supply_capacity": r[4]
            } for r in cur.fetchall()]
        else:
            locations = self.get_topology_layout(line_code, bound)

        cur.execute("""
            SELECT location_id, week, COUNT(DISTINCT co_share_group) AS used_slots,
                   COUNT(DISTINCT activity_id) AS activities_count
            FROM schedule_occupancy
            WHERE scenario = ? AND week BETWEEN ? AND ?
            GROUP BY location_id, week
        """, (scenario, week_start, week_end))
        bookings = {(r[0], r[1]): {"used_slots": r[2], "activities_count": r[3]} for r in cur.fetchall()}

        matrix = []
        for loc in locations:
            lid = loc["location_id"]
            cap = loc["supply_capacity"]
            row = {
                "location_id": lid,
                "physical_name": loc["physical_name"],
                "seq_coord": loc["seq_coord"],
                "capacity": cap,
                "weeks": {}
            }
            for w in range(week_start, week_end + 1):
                b = bookings.get((lid, w), {"used_slots": 0, "activities_count": 0})
                row["weeks"][w] = {
                    "used": b["used_slots"],
                    "activities": b["activities_count"],
                    "capacity": cap,
                    "is_over": b["used_slots"] > cap
                }
            matrix.append(row)

        return {
            "scenario": scenario,
            "line_code": line_code,
            "bound": bound,
            "week_start": week_start,
            "week_end": week_end,
            "rows": matrix
        }

    # -------------------------------------------------------------------------
    # Issue & Violation Scanner
    # -------------------------------------------------------------------------
    def scan_all_issues(self, scenario="A"):
        """
        Comprehensive audit scanner across all 5 issue categories:
        1. Capacity Overflows
        2. Buffer Envelope Overlaps
        3. DAG Precedence Timing Violations & Cycles
        4. Contract Overrun Deadlines
        5. ECLO Violations
        """
        cur = self.conn.cursor()
        issues = {
            "capacity_overflows": [],
            "dag_precedence_violations": [],
            "dag_cycles": [],
            "overrunning_contracts": [],
            "eclo_violations": []
        }

        # 1. Capacity Overflows
        cur.execute("""
            SELECT so.location_id, so.week, COUNT(DISTINCT so.co_share_group) AS used, ls.supply_capacity
            FROM schedule_occupancy so
            JOIN location_supply ls ON ls.location_id = so.location_id
            WHERE so.scenario = ?
            GROUP BY so.location_id, so.week
            HAVING used > ls.supply_capacity
            ORDER BY so.week, so.location_id
        """, (scenario,))
        for r in cur.fetchall():
            issues["capacity_overflows"].append({
                "location_id": r[0],
                "week": r[1],
                "used_slots": r[2],
                "supply_capacity": r[3],
                "excess": r[2] - r[3]
            })

        # 2. DAG Cycles
        cur.execute("""
            SELECT a1.activity_id, a2.activity_id
            FROM activities a1
            JOIN activities a2 ON a2.activity_id = a1.predecessor_activity_id
            WHERE a2.predecessor_activity_id = a1.activity_id
        """)
        for r in cur.fetchall():
            issues["dag_cycles"].append({
                "activity_1": r[0],
                "activity_2": r[1],
                "type": "Circular Dependency"
            })

        # 3. DAG Precedence Timing Violations (Finish-to-Start: Succ week > Pred week)
        cur.execute("""
            SELECT a.activity_id, a.predecessor_activity_id,
                   MIN(succ_sa.week) AS succ_min_week,
                   MAX(pred_sa.week) AS pred_max_week
            FROM activities a
            JOIN schedule_access succ_sa ON succ_sa.activity_id = a.activity_id AND succ_sa.scenario = ?
            JOIN schedule_access pred_sa ON pred_sa.activity_id = a.predecessor_activity_id AND pred_sa.scenario = ?
            WHERE a.predecessor_activity_id IS NOT NULL AND a.predecessor_activity_id != ''
            GROUP BY a.activity_id, a.predecessor_activity_id
            HAVING succ_min_week <= pred_max_week
        """, (scenario, scenario))
        for r in cur.fetchall():
            issues["dag_precedence_violations"].append({
                "activity_id": r[0],
                "predecessor_id": r[1],
                "successor_start_week": r[2],
                "predecessor_finish_week": r[3],
                "violation": f"Started in W{r[2]} before predecessor finished in W{r[3]}"
            })

        # 4. Overrunning Contracts
        cur.execute("""
            SELECT sr.contract_number, c.contract_priority, c.planned_completion_date,
                   sr.simulated_completion_date, sr.overrun_days
            FROM schedule_results sr
            JOIN contracts c ON c.contract_number = sr.contract_number
            WHERE sr.scenario = ? AND sr.overrun_days > 0
            ORDER BY sr.overrun_days DESC
        """, (scenario,))
        for r in cur.fetchall():
            prio = r[1]
            weight = 100 if prio == 1 else (10 if prio == 2 else 1)
            issues["overrunning_contracts"].append({
                "contract_number": r[0],
                "priority": prio,
                "planned_date": r[2],
                "simulated_date": r[3],
                "overrun_days": r[4],
                "penalty": r[4] * weight
            })

        # 5. ECLO Violations in Scenario A
        if scenario == "A":
            cur.execute("""
                SELECT activity_id, week, access_seq
                FROM schedule_access
                WHERE scenario = 'A' AND eclo = 1
                ORDER BY week, activity_id
            """)
            for r in cur.fetchall():
                issues["eclo_violations"].append({
                    "activity_id": r[0],
                    "week": r[1],
                    "access_seq": r[2],
                    "message": "ECLO booked in Scenario A (prohibited)"
                })

        total_issue_count = sum(len(v) for v in issues.values())
        return {
            "scenario": scenario,
            "total_issues": total_issue_count,
            "issues": issues
        }

    # -------------------------------------------------------------------------
    # Activity & Contract Queries
    # -------------------------------------------------------------------------
    def get_activities_list(self):
        """Returns list of all activities."""
        cur = self.conn.cursor()
        cur.execute("""
            SELECT activity_id, contract_number, activity_type, activity_priority, total_accesses, start_location_id, end_location_id
            FROM activities
            ORDER BY activity_id
        """)
        return [{
            "activity_id": r[0],
            "contract_number": r[1],
            "activity_type": r[2],
            "priority": r[3],
            "volume": r[4],
            "start": r[5],
            "end": r[6]
        } for r in cur.fetchall()]

    def get_contracts_list(self):
        """Returns list of all contracts."""
        cur = self.conn.cursor()
        cur.execute("""
            SELECT contract_number, contract_description, activity_type, nature_of_activity,
                   contract_priority, planned_completion_date, number_of_workfronts,
                   number_of_maximum_access_per_week
            FROM contracts
            ORDER BY contract_number
        """)
        return [{
            "contract_number": r[0],
            "description": r[1],
            "type": r[2],
            "nature": r[3],
            "priority": r[4],
            "planned_deadline": r[5],
            "workfronts": r[6],
            "max_access_per_week": r[7]
        } for r in cur.fetchall()]

    def get_activity_details(self, activity_id):
        """Returns details, coordinates, and buffer envelopes for an activity."""
        cur = self.conn.cursor()
        cur.execute("""
            SELECT a.activity_id, a.contract_number, a.activity_type, a.start_location_id,
                   a.end_location_id, a.total_accesses, a.planned_start_date, a.predecessor_activity_id,
                   a.activity_priority, c.nature_of_activity, br.up_to_buffer_sectors, br.opposite_bound_required
            FROM activities a
            JOIN contracts c ON c.contract_number = a.contract_number
            JOIN buffer_rules br ON br.nature_of_works = c.nature_of_activity
            WHERE a.activity_id = ?
        """, (activity_id,))
        row = cur.fetchone()
        if not row:
            return None

        (aid, cnum, atype, sloc, eloc, volume, pdate, pred, prio, nature, buf_secs, opp_bound) = row

        cur.execute("SELECT line_code, bound, seq_coord, location_kind FROM network_topology WHERE location_id = ?", (sloc,))
        s_line, s_bound, s_coord, s_kind = cur.fetchone()
        cur.execute("SELECT seq_coord, location_kind FROM network_topology WHERE location_id = ?", (eloc,))
        e_coord, e_kind = cur.fetchone()

        min_c = min(s_coord - 1 if s_kind == "tunnel sector" else s_coord,
                    e_coord - 1 if e_kind == "tunnel sector" else e_coord)
        max_c = max(s_coord + 1 if s_kind == "tunnel sector" else s_coord,
                    e_coord + 1 if e_kind == "tunnel sector" else e_coord)

        buf_min = max(1, min_c - buf_secs * 2)
        buf_max = max_c + buf_secs * 2

        cur.execute("""
            SELECT location_id FROM network_topology
            WHERE line_code = ? AND bound = ? AND seq_coord BETWEEN ? AND ?
            ORDER BY seq_coord
        """, (s_line, s_bound, min_c, max_c))
        occupied_locations = [r[0] for r in cur.fetchall()]

        return {
            "activity_id": aid,
            "contract_number": cnum,
            "activity_type": atype,
            "nature_of_activity": nature,
            "activity_priority": prio,
            "planned_start_date": pdate,
            "predecessor": pred,
            "total_accesses": volume,
            "line_code": s_line,
            "bound": s_bound,
            "start_location_id": sloc,
            "end_location_id": eloc,
            "min_coord": min_c,
            "max_coord": max_c,
            "buffer_min_coord": buf_min,
            "buffer_max_coord": buf_max,
            "buffer_sectors": buf_secs,
            "opposite_bound_required": bool(opp_bound),
            "occupied_locations": occupied_locations
        }

    # -------------------------------------------------------------------------
    # Diagnostics & Scores
    # -------------------------------------------------------------------------
    def get_parameters(self):
        """Returns list of system parameters."""
        cur = self.conn.cursor()
        cur.execute("SELECT param_key, param_value, description FROM system_parameters ORDER BY param_key")
        return [{"key": r[0], "value": r[1], "description": r[2]} for r in cur.fetchall()]

    def get_buffer_rules(self):
        """Returns list of buffer rules."""
        cur = self.conn.cursor()
        cur.execute("SELECT nature_of_works, up_to_buffer_sectors, opposite_bound_required FROM buffer_rules ORDER BY nature_of_works")
        return [{"nature_of_works": r[0], "up_to_buffer_sectors": r[1], "opposite_bound_required": bool(r[2])} for r in cur.fetchall()]

    def get_scenario_scores(self):
        """Calculates penalty metrics for Scenarios A, B, and C."""
        cur = self.conn.cursor()
        cur.execute("""
            SELECT c.contract_priority, sr.overrun_days
            FROM schedule_results sr
            JOIN contracts c ON c.contract_number = sr.contract_number
            WHERE sr.scenario = 'A'
        """)
        contract_rows = cur.fetchall()

        total_overrun = sum(r[1] for r in contract_rows)
        priority_cost = sum((100 if r[0] == 1 else (10 if r[0] == 2 else 1)) * r[1] for r in contract_rows)
        overrunning_count = sum(1 for r in contract_rows if r[1] > 0)

        cur.execute("SELECT COUNT(CASE WHEN eclo = 1 THEN 1 END) FROM schedule_access WHERE scenario = 'A'")
        eclo_count = cur.fetchone()[0] or 0

        cur.execute("""
            SELECT COUNT(*) FROM (
                SELECT so.location_id, so.week, COUNT(DISTINCT so.co_share_group) AS used, ls.supply_capacity
                FROM schedule_occupancy so
                JOIN location_supply ls ON ls.location_id = so.location_id
                WHERE so.scenario = 'A'
                GROUP BY so.location_id, so.week
                HAVING used > ls.supply_capacity
            )
        """)
        excess_nights = cur.fetchone()[0] or 0

        return {
            "scenario": "A",
            "total_overrun_days": total_overrun,
            "contracts_overrunning": overrunning_count,
            "priority_overrun_penalty": priority_cost,
            "eclo_nights": eclo_count,
            "excess_access_nights": excess_nights,
            "score_a": priority_cost,
            "score_b": 7 * excess_nights + 5 * eclo_count,
            "score_c": priority_cost + 7 * excess_nights + 5 * eclo_count
        }

    def get_diagnostics_report(self):
        """Performs DAG cycle audit, coordinate continuity, and relational health checks."""
        cur = self.conn.cursor()
        stats = {}
        for tbl in ["lines", "stations", "sectors", "location_supply", "contracts", "activities", "dim_calendar_weeks"]:
            cur.execute(f"SELECT COUNT(*) FROM {tbl}")
            stats[tbl] = cur.fetchone()[0]

        cur.execute("""
            SELECT a1.activity_id, a2.activity_id
            FROM activities a1
            JOIN activities a2 ON a2.activity_id = a1.predecessor_activity_id
            WHERE a2.predecessor_activity_id = a1.activity_id
        """)
        cycles = cur.fetchall()

        cur.execute("""
            SELECT COUNT(*) FROM activities a
            WHERE a.start_location_id NOT IN (SELECT location_id FROM network_topology)
               OR a.end_location_id NOT IN (SELECT location_id FROM network_topology)
        """)
        disconnected = cur.fetchone()[0]

        return {
            "stats": stats,
            "dag_cycles": cycles,
            "is_dag_clean": len(cycles) == 0,
            "disconnected_activities_count": disconnected,
            "is_topology_clean": disconnected == 0
        }

    # -------------------------------------------------------------------------
    # Database Update Operations
    # -------------------------------------------------------------------------
    def update_parameter(self, param_key, param_value):
        """Updates a system parameter and recalculates calendar weeks if horizon changes."""
        cur = self.conn.cursor()
        cur.execute("UPDATE system_parameters SET param_value = ? WHERE param_key = ?", (str(param_value), param_key))
        if cur.rowcount == 0:
            cur.execute("INSERT INTO system_parameters (param_key, param_value, description) VALUES (?, ?, 'User parameter')", (param_key, str(param_value)))

        if param_key in ("horizon_start", "horizon_weeks"):
            cur.execute("SELECT param_key, param_value FROM system_parameters WHERE param_key IN ('horizon_start', 'horizon_weeks')")
            p_dict = dict(cur.fetchall())
            h_start = datetime.strptime(p_dict.get("horizon_start", "2027-01-04"), "%Y-%m-%d").date()
            h_weeks = int(p_dict.get("horizon_weeks", 30))

            cur.execute("DELETE FROM dim_calendar_weeks")
            for w in range(1, h_weeks + 1):
                w_start = h_start + timedelta(days=(w - 1) * 7)
                w_end = w_start + timedelta(days=6)
                cur.execute("INSERT INTO dim_calendar_weeks VALUES (?, ?, ?)", (w, w_start.isoformat(), w_end.isoformat()))

        self.conn.commit()
        return True

    def update_buffer_rule(self, nature_of_works, buffer_sectors, opposite_bound):
        """Updates buffer rule settings."""
        cur = self.conn.cursor()
        cur.execute("""
            UPDATE buffer_rules 
            SET up_to_buffer_sectors = ?, opposite_bound_required = ?
            WHERE nature_of_works = ?
        """, (int(buffer_sectors), 1 if opposite_bound else 0, nature_of_works))
        self.conn.commit()
        return True

    def update_contract(self, contract_number, priority=None, planned_completion=None, workfronts=None, max_access_per_week=None):
        """Updates contract attributes."""
        cur = self.conn.cursor()
        fields, vals = [], []
        if priority is not None:
            fields.append("contract_priority = ?")
            vals.append(int(priority))
        if planned_completion is not None:
            fields.append("planned_completion_date = ?")
            vals.append(str(planned_completion))
        if workfronts is not None:
            fields.append("number_of_workfronts = ?")
            vals.append(int(workfronts))
        if max_access_per_week is not None:
            fields.append("number_of_maximum_access_per_week = ?")
            vals.append(int(max_access_per_week))

        if not fields:
            return False

        vals.append(contract_number)
        cur.execute(f"UPDATE contracts SET {', '.join(fields)} WHERE contract_number = ?", tuple(vals))
        self.conn.commit()
        return True

    def update_activity(self, activity_id, priority=None, planned_start_date=None, total_accesses=None):
        """Updates activity attributes."""
        cur = self.conn.cursor()
        fields, vals = [], []
        if priority is not None:
            fields.append("activity_priority = ?")
            vals.append(int(priority))
        if planned_start_date is not None:
            fields.append("planned_start_date = ?")
            vals.append(str(planned_start_date))
        if total_accesses is not None:
            fields.append("total_accesses = ?")
            vals.append(int(total_accesses))

        if not fields:
            return False

        vals.append(activity_id)
        cur.execute(f"UPDATE activities SET {', '.join(fields)} WHERE activity_id = ?", tuple(vals))
        self.conn.commit()
        return True

    # -------------------------------------------------------------------------
    # Database Manager: Pre-Flight Validation, Flush, Re-seed
    # -------------------------------------------------------------------------
    def validate_upload_directory(self, folder_path):
        """
        Pre-flight dry-run validator for an incoming database folder.
        Verifies presence of all 8 CSVs, exact column headers, foreign key consistency,
        and DAG cycle freedom before committing changes.
        """
        if not os.path.exists(folder_path):
            return {"is_valid": False, "errors": [f"Directory does not exist: {folder_path}"], "warnings": [], "stats": {}}

        errors = []
        warnings = []
        stats = {}

        # 1. Check all required CSV files
        for fname in self.REQUIRED_CSVS:
            fpath = os.path.join(folder_path, fname)
            if not os.path.isfile(fpath):
                errors.append(f"Missing required CSV: {fname}")
            else:
                try:
                    with open(fpath, encoding="utf-8-sig") as f:
                        reader = csv.reader(f)
                        header = next(reader, None)
                        rows = list(reader)
                        stats[fname] = len(rows)
                        if not header:
                            errors.append(f"Empty CSV file or missing headers: {fname}")
                except Exception as e:
                    errors.append(f"Error reading {fname}: {e}")

        if errors:
            return {"is_valid": False, "errors": errors, "warnings": warnings, "stats": stats}

        # 2. Dry-run relational engine in a scratch memory database
        try:
            temp_mgr = DatabaseManager(seed_dir=folder_path)
            temp_mgr.validate_csv_integrity()
            temp_conn = temp_mgr.build_sqlite_engine()
            temp_cur = temp_conn.cursor()

            # Check DAG cycles
            temp_cur.execute("""
                SELECT a1.activity_id, a2.activity_id
                FROM activities a1
                JOIN activities a2 ON a2.activity_id = a1.predecessor_activity_id
                WHERE a2.predecessor_activity_id = a1.activity_id
            """)
            cycles = temp_cur.fetchall()
            if cycles:
                warnings.append(f"Predecessor DAG contains cyclic dependencies: {cycles}")

            temp_conn.close()
        except Exception as e:
            errors.append(f"Relational dry-run failed: {e}")

        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "stats": stats
        }

    def flush_database(self):
        """Purges all core tables."""
        cur = self.conn.cursor()
        tables = [
            "schedule_occupancy", "schedule_access", "schedule_results",
            "activities", "contracts", "location_supply", "sectors",
            "stations", "lines", "network_topology", "dim_calendar_weeks"
        ]
        for tbl in tables:
            cur.execute(f"DELETE FROM {tbl}")
        self.conn.commit()
        return True

    def flush_and_reseed(self, seed_dir):
        """Flushes the database and re-seeds from a specified folder."""
        self.seed_dir = seed_dir
        self.mgr = DatabaseManager(seed_dir=seed_dir)
        self.mgr.validate_csv_integrity()
        self.conn = self.mgr.build_sqlite_engine()
        return True
