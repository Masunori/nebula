"""
manager_screen.py: Database Operations Manager.
Handles Flushing, Pre-flight Ingestion & Upload of new databases, and CSV Exports.
"""

import os
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.prompt import Prompt, Confirm
from rich.align import Align
from rich.box import ROUNDED

console = Console()
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def render_manager_screen(service, active_scenario="A"):
    """Renders the database management console and handles actions."""
    while True:
        console.clear()
        console.print(Panel(Align.center(Text("DATABASE OPERATIONS MANAGER", style="bold blue")), box=ROUNDED, border_style="blue"))

        print("\n[DATABASE ACTIONS]")
        print("  [1] 🔄 Upload / Load New Database (with Pre-Flight Validation)")
        print("  [2] 🗑️  Flush Database (Clear all tables)")
        print("  [3] 💾 Export Competition Submission CSVs (RESULTS, SCHEDULE_ACCESS, SCHEDULE_OCCUPANCY)")
        print("  [B] Back to Main Menu")

        choice = Prompt.ask("\nSelect action", choices=["1", "2", "3", "B"], default="B").upper()

        if choice == "B":
            break

        if choice == "1":
            handle_upload(service)
        elif choice == "2":
            handle_flush(service)
        elif choice == "3":
            handle_export(service, active_scenario)


def handle_upload(service):
    """Handles dataset selection, pre-flight validation, and ingestion."""
    fixtures_dir = os.path.join(BASE_DIR, "test_fixtures")
    init_dir = os.path.join(BASE_DIR, "init_data")

    print("\n[SELECT DATASET SOURCE]")
    print(f"  [0] Default Competition Initial Data ({init_dir})")
    print(f"  [1] Tier 1: Scaled Realistic (3 lines, 30 stations, 150 activities)")
    print(f"  [2] Tier 2: Extreme Stress (5 lines, 50 stations, 1,000 activities)")
    print(f"  [3] Tier 3: Chaos / Fault Injection (Injected DAG cycles)")
    print(f"  [C] Custom Directory Path")
    print(f"  [B] Cancel")

    sub = Prompt.ask("Select dataset", choices=["0", "1", "2", "3", "C", "B"], default="0").upper()
    if sub == "B":
        return

    target_dir = init_dir
    db_label = "Default (init_data/)"
    if sub == "1":
        target_dir = os.path.join(fixtures_dir, "tier_1")
        db_label = "Tier 1: Scaled Realistic"
    elif sub == "2":
        target_dir = os.path.join(fixtures_dir, "tier_2")
        db_label = "Tier 2: Extreme Stress"
    elif sub == "3":
        target_dir = os.path.join(fixtures_dir, "tier_3")
        db_label = "Tier 3: Fault Injection"
    elif sub == "C":
        target_dir = Prompt.ask("Enter folder path containing 8 CSVs")
        db_label = f"Custom ({os.path.basename(target_dir)})"

    console.print(f"\n[*] Running Pre-Flight Dry-Run Validation on: [bold cyan]{target_dir}[/bold cyan]...")
    val_res = service.validate_upload_directory(target_dir)

    # Validation Results Table
    val_table = Table(title="Pre-Flight Validation Report", box=ROUNDED, header_style="bold cyan", title_style="bold yellow", show_lines=True)
    val_table.add_column("CSV File", style="bold white", width=26)
    val_table.add_column("Row Count", justify="center", style="bold cyan", width=14)
    val_table.add_column("Validation Status", justify="center", width=20)

    for fname, count in val_res["stats"].items():
        val_table.add_row(fname, str(count), Text("✓ Valid Schema", style="bold green"))

    console.print(val_table)

    if val_res["errors"]:
        console.print("[bold red]Pre-Flight Validation Failed with Errors:[/bold red]")
        for err in val_res["errors"]:
            console.print(f"  - [red]{err}[/red]")
        Prompt.ask("Cannot proceed with ingestion. Press Enter to continue")
        return

    if val_res["warnings"]:
        console.print("[bold yellow]Pre-Flight Warnings:[/bold yellow]")
        for w in val_res["warnings"]:
            console.print(f"  - [yellow]{w}[/yellow]")

    if Confirm.ask(f"\nCommit and re-seed database with '{db_label}'?"):
        service.flush_and_reseed(target_dir)
        console.print(f"[bold green]✓ Database successfully re-seeded from {target_dir}![/bold green]")
        service.active_db_label = db_label
    else:
        console.print("[dim]Ingestion cancelled.[/dim]")

    Prompt.ask("Press Enter to continue")


def handle_flush(service):
    """Handles table purging."""
    console.print("[bold red]WARNING: Flushing will delete all activities, contracts, topology, and schedule results![/bold red]")
    if Confirm.ask("Are you absolutely sure you want to flush the database?"):
        service.flush_database()
        console.print("[bold green]✓ All database tables successfully flushed and purged![/bold green]")
    else:
        console.print("[dim]Flush aborted.[/dim]")
    Prompt.ask("Press Enter to continue")


def handle_export(service, scenario):
    """Handles CSV export."""
    out_dir = Prompt.ask("Enter output folder name", default="submission_output")
    out_path = os.path.join(BASE_DIR, out_dir)

    temp_db = os.path.join(BASE_DIR, "scripts", "temp_export.db")
    backup_conn = __import__("sqlite3").connect(temp_db)
    service.conn.backup(backup_conn)
    backup_conn.close()

    try:
        from export_schedule import export_schedule
        export_schedule(db_path=temp_db, scenario=scenario, export_dir=out_path)
        console.print(f"[bold green]✓ All 3 competition CSVs successfully exported to: {out_path}[/bold green]")
    finally:
        if os.path.exists(temp_db):
            os.remove(temp_db)

    Prompt.ask("Press Enter to continue")
