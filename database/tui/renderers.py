"""
renderers.py: ANSI Terminal Renderers for Railway Topology, Capacity Heatmap,
Activity Envelopes, Scorecards, and Diagnostics.
Uses pure Python standard library for 100% portability on Windows PowerShell and Linux.
"""

import sys

# ANSI Colors & Styles
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
MAGENTA = "\033[35m"
BLUE = "\033[34m"
WHITE = "\033[37m"
BG_BLUE = "\033[44m"
BG_RED = "\033[41m"
BG_GREEN = "\033[42m"


def styled(text, *styles):
    return "".join(styles) + str(text) + RESET


def render_header(title, scenario="A", horizon_info="30 Weeks (from 2027-01-04)"):
    width = 80
    border = "=" * width
    print(styled(border, CYAN))
    print(f"{styled(' NEBULAX RAILWAY OPTIMISER ', BOLD, BG_BLUE, WHITE)}  |  {styled(title, BOLD, YELLOW)}")
    print(f"Active Scenario: {styled('[' + scenario + ']', BOLD, GREEN)}  |  Horizon: {styled(horizon_info, DIM)}")
    print(styled(border, CYAN))


def render_topology_ascii(layout, line_code="ALP", bound="EB"):
    """Renders an ASCII linear track schematic with stations, sectors, and coordinates."""
    print(f"\n{styled('Physical Track Schematic:', BOLD, WHITE)} Line {styled(line_code, CYAN, BOLD)} ({bound})")
    print(styled("-" * 80, DIM))

    track_nodes = []
    coord_labels = []

    for item in layout:
        c = item["seq_coord"]
        name = item["physical_name"]
        cap = item["supply_capacity"]

        if item["location_kind"] == "platform sector":
            node_str = styled(f"[{name}]", BOLD, GREEN if "H" not in name else MAGENTA)
            cap_str = styled(f"c={c}", DIM)
        else:
            # Tunnel sector
            sec_short = name.split(":")[-1] if ":" in name else name
            node_str = styled(f"==({sec_short})==", CYAN)
            cap_str = styled(f"c={c}", DIM)

        track_nodes.append(node_str)
        coord_labels.append(cap_str)

    # Print track line in chunks of 5 nodes for readability
    chunk_size = 5
    for i in range(0, len(track_nodes), chunk_size):
        chunk_track = " ".join(track_nodes[i:i + chunk_size])
        chunk_coords = "  ".join(coord_labels[i:i + chunk_size])
        print(f" Track: {chunk_track}")
        print(f" Coord: {chunk_coords}\n")

    # Legend
    print(styled("Legend: ", BOLD) +
          styled("[S01]", GREEN) + " Regular Station Platform  |  " +
          styled("[H01]", MAGENTA) + " Interchange Hub Platform  |  " +
          styled("==(SEC)==", CYAN) + " Tunnel Sector")
    print(styled("-" * 80, DIM))


def render_capacity_heatmap(heatmap_data):
    """Renders a 2D ASCII matrix of locations vs weeks with colored load indicators."""
    scenario = heatmap_data["scenario"]
    line_code = heatmap_data["line_code"]
    bound = heatmap_data["bound"]
    w_start = heatmap_data["week_start"]
    w_end = heatmap_data["week_end"]
    rows = heatmap_data["rows"]

    print(f"\n{styled('Capacity Utilization Heatmap:', BOLD, WHITE)} Line {styled(line_code, CYAN, BOLD)} ({bound}) | Weeks {w_start}..{w_end}")
    print(styled("-" * 80, DIM))

    # Header row (Weeks)
    header = f"{'Location':<22} | {'Cap':<3} |"
    for w in range(w_start, w_end + 1):
        header += f" {w:>2} "
    print(styled(header, BOLD, YELLOW))
    print(styled("-" * len(header), DIM))

    over_capacity_found = False

    for row in rows:
        loc_name = row["physical_name"]
        if row["location_id"].startswith("PLAT:"):
            loc_label = f"PLAT:{loc_name}"
        else:
            loc_label = loc_name.split(":")[-1] if ":" in loc_name else loc_name

        line_str = f"{loc_label:<22} | {row['capacity']:<3} |"
        for w in range(w_start, w_end + 1):
            w_info = row["weeks"][w]
            used = w_info["used"]
            cap = w_info["capacity"]
            is_over = w_info["is_over"]

            if is_over:
                over_capacity_found = True
                cell = styled(f" {used}! ", BOLD, BG_RED, WHITE)
            elif used == cap and cap > 0:
                cell = styled(f" {used}* ", BOLD, YELLOW)
            elif used > 0:
                cell = styled(f" {used}  ", GREEN)
            else:
                cell = styled(" .  ", DIM)
            line_str += cell
        print(line_str)

    print(styled("-" * len(header), DIM))
    print(styled("Heatmap Legend: ", BOLD) +
          styled(" . ", DIM) + " Idle (0%)  |  " +
          styled(" 1 ", GREEN) + " Normal Bookings  |  " +
          styled(" 2* ", YELLOW) + " At Max Capacity  |  " +
          styled(" 3! ", BG_RED, WHITE) + " OVER CAPACITY BREACH")

    if over_capacity_found:
        print(styled(" [!] Bottleneck Alert: Some locations have exceeded nominal capacity!", BOLD, RED))
    else:
        print(styled(" [OK] All locations are within nominal capacity limits for these weeks.", BOLD, GREEN))


def render_activity_card(act):
    """Renders detailed card for an activity with 1D spatial interval illustration."""
    if not act:
        print(styled("Activity not found.", RED))
        return

    print(f"\n{styled('Activity Profile: ', BOLD, WHITE)}{styled(act['activity_id'], BOLD, CYAN)}  (Contract: {styled(act['contract_number'], YELLOW)})")
    print(styled("-" * 80, DIM))

    prio_color = RED if act["activity_priority"] == 1 else (YELLOW if act["activity_priority"] == 2 else GREEN)

    print(f" Type: {act['activity_type']:<20} | Priority: {styled('P' + str(act['activity_priority']), BOLD, prio_color)}")
    print(f" Nature: {act['nature_of_activity']:<18} | Buffer Sectors: {act['buffer_sectors']} (Opposite Bound: {act['opposite_bound_required']})")
    print(f" Workload: {act['total_accesses']} Access Nights      | Predecessor: {act['predecessor'] or 'None (Independent)'}")
    print(f" Planned Start: {act['planned_start_date']}       | Line / Bound: {act['line_code']} / {act['bound']}")
    print(f" Start Location: {act['start_location_id']}")
    print(f" End Location:   {act['end_location_id']}")

    print(f"\n{styled('1D Continuous Topological Footprint:', BOLD)}")
    print(f" Working Span:     Coord [{act['min_coord']} .. {act['max_coord']}]")
    print(f" Safety Exclusion: Coord [{act['buffer_min_coord']} .. {act['buffer_max_coord']}]")

    # ASCII 1D track interval diagram
    track_len = 19
    bar = ["."] * track_len
    # Mark buffer zone
    for i in range(act["buffer_min_coord"] - 1, min(track_len, act["buffer_max_coord"])):
        bar[i] = styled("~", YELLOW)
    # Mark work zone
    for i in range(act["min_coord"] - 1, min(track_len, act["max_coord"])):
        bar[i] = styled("#", BOLD, GREEN)

    scale_nums = "".join(f"{i % 10}" for i in range(1, track_len + 1))
    print(f"\n Track Scale:  1234567890123456789 (Coordinates 1..19)")
    print(f" Footprint:    {''.join(bar)}")
    print(f"               {styled('#', BOLD, GREEN)} = Active Work Zone  |  {styled('~', YELLOW)} = Safety Exclusion Buffer")

    print(f"\nTraversed Physical Locations ({len(act['occupied_locations'])}):")
    for loc in act["occupied_locations"]:
        print(f"  - {loc}")
    print(styled("-" * 80, DIM))


def render_score_card(score):
    """Renders side-by-side scenario scorecard."""
    print(f"\n{styled('Scenario Evaluation & Penalty Score Breakdown', BOLD, WHITE)}")
    print(styled("-" * 80, DIM))

    print(f"{'Metric':<35} | {'Scenario A':<13} | {'Scenario B':<13} | {'Scenario C':<13}")
    print(styled("-" * 80, DIM))
    print(f"{'Overrunning Contracts':<35} | {score['contracts_overrunning']:<13} | {'0 (Enforced)':<13} | {score['contracts_overrunning']:<13}")
    print(f"{'Total Overrun Days':<35} | {score['total_overrun_days']:<13} | {'0 (Enforced)':<13} | {score['total_overrun_days']:<13}")
    print(f"{'Priority Overrun Penalty':<35} | {score['priority_overrun_penalty']:<13} | {'0':<13} | {score['priority_overrun_penalty']:<13}")
    print(f"{'Excess Access Nights Scheduled':<35} | {'0 (Strict)':<13} | {score['excess_access_nights']:<13} | {score['excess_access_nights']:<13}")
    print(f"{'ECLO Nights Booked':<35} | {'0 (Forbidden)':<13} | {score['eclo_nights']:<13} | {score['eclo_nights']:<13}")
    print(styled("-" * 80, DIM))
    print(f"{styled('TOTAL PENALTY SCORE', BOLD):<35} | {styled(score['score_a'], BOLD, GREEN):<13} | {styled(score['score_b'], BOLD, CYAN):<13} | {styled(score['score_c'], BOLD, YELLOW):<13}")
    print(styled("-" * 80, DIM))


def render_diagnostics(diag):
    """Renders system health and integrity check results."""
    print(f"\n{styled('Database & Network Diagnostics Report', BOLD, WHITE)}")
    print(styled("-" * 80, DIM))

    # Entity counts
    print(styled("Entity Population Summary:", BOLD))
    for tbl, count in diag["stats"].items():
        print(f"  - {tbl:<22}: {styled(count, CYAN, BOLD)} records")

    print(f"\n{styled('Predecessor DAG Cycle Check:', BOLD)}")
    if diag["is_dag_clean"]:
        print(f"  {styled('[PASS] 0 DAG cycles found. Precedence hierarchy is valid.', BOLD, GREEN)}")
    else:
        print(f"  {styled('[FAIL] Cyclic dependencies detected!', BOLD, RED)}")
        for c1, c2 in diag["dag_cycles"]:
            print(f"    * Cycle between {styled(c1, RED)} and {styled(c2, RED)}")

    print(f"\n{styled('Topological Continuity Check:', BOLD)}")
    if diag["is_topology_clean"]:
        print(f"  {styled('[PASS] 100% of activities map to continuous topological coordinates.', BOLD, GREEN)}")
    else:
        print(f"  {styled('[FAIL] ' + str(diag['disconnected_activities_count']) + ' activities have disconnected coordinates!', BOLD, RED)}")

    print(styled("-" * 80, DIM))
