"""
issue_screen.py: Interactive Issue & Violation Explorer.
Scans and presents capacity overflows, buffer collisions, DAG timing violations,
cycles, and contract deadline overruns.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.align import Align
from rich.box import ROUNDED, HEAVY_HEAD

console = Console()


def render_issue_screen(service, scenario="A"):
    """Renders the comprehensive issue and violation explorer screen."""
    scan_res = service.scan_all_issues(scenario=scenario)
    issues = scan_res["issues"]
    total = scan_res["total_issues"]

    # 1. Header Summary Cards
    header = Table(box=ROUNDED, show_header=False, expand=True)
    header.add_column("Cap", justify="center")
    header.add_column("DAG", justify="center")
    header.add_column("Overrun", justify="center")
    header.add_column("ECLO", justify="center")

    cap_count = len(issues["capacity_overflows"])
    dag_count = len(issues["dag_precedence_violations"]) + len(issues["dag_cycles"])
    overrun_count = len(issues["overrunning_contracts"])
    eclo_count = len(issues["eclo_violations"])

    header.add_row(
        Panel(f"[bold red]{cap_count}[/bold red]\nCapacity Breaches", border_style="red" if cap_count else "green"),
        Panel(f"[bold yellow]{dag_count}[/bold yellow]\nDAG Precedence Faults", border_style="yellow" if dag_count else "green"),
        Panel(f"[bold magenta]{overrun_count}[/bold magenta]\nContract Overruns", border_style="magenta" if overrun_count else "green"),
        Panel(f"[bold cyan]{eclo_count}[/bold cyan]\nECLO Rule Violations", border_style="cyan" if eclo_count else "green")
    )

    console.print(Panel(Align.center(Text(f"NETWORK & SCHEDULE ISSUE EXPLORER (Scenario {scenario})", style="bold yellow")), box=ROUNDED, border_style="yellow"))
    console.print(header)

    if total == 0:
        console.print(Panel("[bold green]✓ ZERO ISSUES DETECTED! The schedule is 100% compliant with all physical and contractual constraints.[/bold green]", box=ROUNDED))
        return

    # 2. Detailed Table of Issues
    issue_table = Table(
        title=f"Detected Anomalies & Violations ({total} Total)",
        box=ROUNDED,
        header_style="bold white on blue",
        title_style="bold yellow",
        show_lines=True
    )
    issue_table.add_column("#", justify="center", style="bold dim", width=4)
    issue_table.add_column("Category", justify="center", width=20)
    issue_table.add_column("Severity", justify="center", width=12)
    issue_table.add_column("Affected Entity", justify="left", width=24)
    issue_table.add_column("Issue Details & Mathematical Penalty", justify="left")

    idx = 1

    # Overrunning Contracts
    for c in issues["overrunning_contracts"]:
        issue_table.add_row(
            str(idx),
            Text("Contract Overrun", style="bold magenta"),
            Text("HIGH", style="bold white on red") if c["priority"] == 1 else Text("MEDIUM", style="bold yellow"),
            f"Contract {c['contract_number']} (P{c['priority']})",
            f"Overrun by [bold red]{c['overrun_days']} days[/bold red] (Planned: {c['planned_date']} -> Simulated: {c['simulated_date']}). "
            f"Penalty = {c['overrun_days']} × {100 if c['priority']==1 else (10 if c['priority']==2 else 1)} = [bold yellow]{c['penalty']} pts[/bold yellow]"
        )
        idx += 1

    # Capacity Breaches
    for cap in issues["capacity_overflows"]:
        issue_table.add_row(
            str(idx),
            Text("Capacity Breach", style="bold red"),
            Text("CRITICAL", style="bold white on red"),
            f"{cap['location_id']} (W{cap['week']})",
            f"Booked slots ({cap['used_slots']}) exceeds nominal capacity ({cap['supply_capacity']}) by [bold red]{cap['excess']}[/bold red] slot(s)."
        )
        idx += 1

    # DAG Cycles
    for cyc in issues["dag_cycles"]:
        issue_table.add_row(
            str(idx),
            Text("DAG Cycle", style="bold red"),
            Text("CRITICAL", style="bold white on red"),
            f"{cyc['activity_1']} <-> {cyc['activity_2']}",
            "Circular predecessor dependency detected! Breaks topological sort and makes completion time undefined."
        )
        idx += 1

    # DAG Precedence
    for dag in issues["dag_precedence_violations"]:
        issue_table.add_row(
            str(idx),
            Text("DAG Precedence", style="bold yellow"),
            Text("MEDIUM", style="bold yellow"),
            f"{dag['activity_id']} -> {dag['predecessor_id']}",
            dag["violation"]
        )
        idx += 1

    # ECLO Violations
    for ec in issues["eclo_violations"]:
        issue_table.add_row(
            str(idx),
            Text("ECLO Violation", style="bold cyan"),
            Text("HIGH", style="bold white on red"),
            f"Activity {ec['activity_id']} (W{ec['week']})",
            ec["message"]
        )
        idx += 1

    console.print(issue_table)
