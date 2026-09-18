"""
network_screen.py: Dynamic Multi-Line Railway Network Visualizer.
Dynamically handles any N lines (e.g. 2, 3, 5, or more), discovers interchange hubs,
renders all-line overview tables, stacked track schematics, and side-by-side line comparison.
Powered 100% by native Rich styles for cross-platform contrast and consistency.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.align import Align
from rich.box import ROUNDED, DOUBLE_EDGE

console = Console()


def render_network_screen(service, bound="EB", week=None, scenario="A", line_a=None, line_b=None):
    """
    Renders the dynamic multi-line network visualizer.
    Adapts to any number of lines in the database.
    """
    summary_data = service.get_all_lines_network_summary(bound=bound, week=week, scenario=scenario)
    all_tracks = service.get_all_lines_tracks(bound=bound, week=week, scenario=scenario)
    hubs = summary_data["interchange_hubs"]
    lines_count = summary_data["lines_count"]

    week_label = f"Week {week}" if week is not None else "Static Topology"
    title_text = Text()
    title_text.append("MULTI-LINE RAILWAY NETWORK VISUALIZER", style="bold bright_yellow")
    title_text.append(f"  ({bound} Bound │ {week_label} │ Scenario [{scenario}] │ {lines_count} Lines Detected)", style="bold bright_cyan")

    console.print(Panel(Align.center(title_text), box=DOUBLE_EDGE, border_style="bright_yellow"))

    # 1. All-Lines Network Overview Table
    overview_table = Table(
        title="Network Lines & Interchange Junctions Overview",
        box=ROUNDED,
        header_style="bold bright_white on blue",
        title_style="bold bright_yellow",
        show_lines=True
    )
    overview_table.add_column("Line Code", justify="center", style="bold bright_cyan", width=11)
    overview_table.add_column("Line Name", justify="left", style="bright_white", width=22)
    overview_table.add_column("Stations", justify="center", width=10)
    overview_table.add_column("Sectors", justify="center", width=10)
    overview_table.add_column("Interchange Hub Connections", justify="left", width=30)
    overview_table.add_column("Total Cap", justify="center", width=11)
    overview_table.add_column("Booked Slots", justify="center", width=14)
    overview_table.add_column("Bottlenecks", justify="center", width=13)

    for l_info in summary_data["lines"]:
        hub_str = ", ".join(l_info["interchanges"]) if l_info["interchanges"] else "Independent"
        hub_text = Text(hub_str, style="bold bright_magenta" if l_info["interchanges"] else "dim")

        used_val = l_info["total_used"]
        cap_val = l_info["total_capacity"]
        used_style = "bold bright_green" if used_val <= cap_val else "bold bright_white on red"

        over_cnt = l_info["over_capacity_count"]
        over_text = Text(f"{over_cnt} Over", style="bold bright_white on red") if over_cnt > 0 else Text("0 (Clean)", style="bright_green")

        overview_table.add_row(
            l_info["line_code"],
            l_info["line_name"],
            str(l_info["station_count"]),
            str(l_info["sector_count"]),
            hub_text,
            str(cap_val),
            Text(f"{used_val} / {cap_val}", style=used_style),
            over_text
        )

    console.print(overview_table)

    # 2. Dynamic Stacked Track Schematics for ALL Lines
    print()
    schematic_panel_title = f"Sequential Track Layouts for All {lines_count} Lines ({bound})"
    schematic_table = Table(title=schematic_panel_title, box=ROUNDED, header_style="bold bright_cyan", title_style="bold bright_yellow", show_lines=True)
    schematic_table.add_column("Line", justify="center", style="bold bright_cyan", width=8)
    schematic_table.add_column("Sequential Corridor Schematic (Stations [ ] and Tunnel Sectors == )", justify="left")

    for lcode, t_info in all_tracks.items():
        line_text = Text()
        for idx, node in enumerate(t_info["nodes"]):
            name = node["physical_name"]
            is_hub = node["is_interchange"]
            is_over = node["is_over_capacity"]
            used = node["used_slots"]
            cap = node["supply_capacity"]

            if node["location_kind"] == "platform sector":
                if is_hub:
                    style = "bold bright_white on dark_magenta" if not is_over else "bold bright_white on red"
                    line_text.append(f"[{name}]★", style=style)
                else:
                    style = "bold bright_green" if not is_over else "bold bright_white on red"
                    line_text.append(f"[{name}]", style=style)
            else:
                s_short = name.split(":")[-1] if ":" in name else name
                if is_hub:
                    style = "bold bright_magenta" if not is_over else "bold bright_white on red"
                    line_text.append(f"==({s_short})==", style=style)
                else:
                    style = "bright_cyan" if not is_over else "bold bright_white on red"
                    line_text.append(f"==({s_short})==", style=style)

            # Add separator or spacing
            if idx < len(t_info["nodes"]) - 1:
                line_text.append(" ", style="dim")

        schematic_table.add_row(lcode, line_text)

    console.print(schematic_table)

    # Legend Panel
    legend_text = Text()
    legend_text.append("Legend: ", style="bold bright_white")
    legend_text.append("[S01] ", style="bold bright_green")
    legend_text.append("Regular Platform  │ ", style="dim")
    legend_text.append("[H01]★ ", style="bold bright_white on dark_magenta")
    legend_text.append("Interchange Hub Platform  │ ", style="dim")
    legend_text.append("==(SEC)== ", style="bright_cyan")
    legend_text.append("Tunnel Track  │ ", style="dim")
    legend_text.append(" [OVER] ", style="bold bright_white on red")
    legend_text.append("Bottlenecked Segment", style="bright_red")
    console.print(Panel(Align.center(legend_text), box=ROUNDED, border_style="dim"))

    # 3. Dynamic Side-by-Side Line Comparison Table
    dual_data = service.get_dual_line_network_layout(bound=bound, week=week, scenario=scenario, line_a=line_a, line_b=line_b)
    l1 = dual_data["line_a"]
    l2 = dual_data["line_b"]

    if l1 != l2:
        compare_table = Table(
            title=f"Side-by-Side Track Comparator: Line {l1} vs Line {l2} ({bound})",
            box=ROUNDED,
            header_style="bold bright_white on blue",
            title_style="bold bright_yellow",
            show_lines=True
        )
        compare_table.add_column("Coord", justify="center", style="bold bright_yellow", width=6)
        compare_table.add_column(f"Line {l1} Physical Segment", justify="left", width=32)
        compare_table.add_column(f"{l1} Load", justify="center", width=14)
        compare_table.add_column(f"Line {l2} Physical Segment", justify="left", width=32)
        compare_table.add_column(f"{l2} Load", justify="center", width=14)
        compare_table.add_column("Junction Status", justify="center", width=18)

        nodes_1 = dual_data["line_a_nodes"]
        nodes_2 = dual_data["line_b_nodes"]
        max_rows = max(len(nodes_1), len(nodes_2))

        for i in range(max_rows):
            n1 = nodes_1[i] if i < len(nodes_1) else None
            n2 = nodes_2[i] if i < len(nodes_2) else None
            coord = n1["seq_coord"] if n1 else (n2["seq_coord"] if n2 else i + 1)

            def format_comp_node(n):
                if not n:
                    return Text("-", style="dim")
                t = Text()
                name = n["physical_name"]
                if n["location_kind"] == "platform sector":
                    t.append(f"[{name}]", style="bold bright_green" if not n["is_interchange"] else "bold bright_magenta")
                    t.append(" (Platform)", style="dim")
                else:
                    s_short = name.split(":")[-1] if ":" in name else name
                    t.append(f"==({s_short})==", style="bright_cyan" if not n["is_interchange"] else "bold bright_magenta")
                    t.append(" (Tunnel)", style="dim")
                return t

            def format_comp_load(n):
                if not n:
                    return Text("-", style="dim")
                t = Text()
                used = n["used_slots"]
                cap = n["supply_capacity"]
                if n["is_over_capacity"]:
                    t.append(f"{used}/{cap} OVER", style="bold bright_white on red")
                elif used == cap and cap > 0:
                    t.append(f"{used}/{cap} (Full)", style="bold bright_yellow")
                elif used > 0:
                    t.append(f"{used}/{cap}", style="bold bright_green")
                else:
                    t.append(f"0/{cap} (Idle)", style="dim")
                return t

            is_junc = (n1 and n1["is_interchange"]) or (n2 and n2["is_interchange"])
            junc_text = Text("★ INTERCHANGE", style="bold bright_magenta") if is_junc else Text("-", style="dim")

            compare_table.add_row(
                str(coord),
                format_comp_node(n1),
                format_comp_load(n1),
                format_comp_node(n2),
                format_comp_load(n2),
                junc_text
            )

        print()
        console.print(compare_table)
