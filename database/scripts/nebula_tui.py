#!/usr/bin/env python3
"""
nebula_tui.py: Interactive Full-Featured Terminal User Interface for NebulaX Database.
Powered 100% by Python's `rich` library with high-contrast cross-platform themes.
Features:
  - Dynamic Multi-Line Network Visualizer (arbitrary N lines, dynamic interchange hubs, line comparator)
  - Issue & Violation Explorer (Capacity breaches, DAG faults/cycles, Overruns, ECLO violations)
  - Diagnostics & System Health Dashboard (Table counts, FK checks, DAG acyclicity)
  - Database Update Studio (Live editing of parameters, buffers, contracts, activities)
  - Database Operations Manager (Flush, Pre-flight Ingestion/Upload, Submission CSV Export)
  - Weekly Capacity Heatmaps with 'ALL' lines matrix & Activity Buffer Inspector
"""

import os
import sys
import argparse
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.prompt import Prompt
from rich.align import Align
from rich.box import ROUNDED, DOUBLE_EDGE

# Add parent directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))

from tui.db_service import DBAnalyticsService
from tui.ui_components import render_app_header, render_nav_footer
from tui.screens.network_screen import render_network_screen
from tui.screens.issue_screen import render_issue_screen
from tui.screens.diagnostic_screen import render_diagnostic_screen
from tui.screens.editor_screen import render_editor_screen
from tui.screens.manager_screen import render_manager_screen
from tui.renderers import render_capacity_heatmap, render_activity_card, render_score_card

console = Console()


class NebulaRichTUI:
    """Main Application Controller for the Rich Railway Database Terminal."""

    def __init__(self, seed_dir=None):
        self.service = DBAnalyticsService(seed_dir=seed_dir)
        self.service.active_db_label = "Default (init_data/)" if not seed_dir else os.path.basename(seed_dir)
        self.active_scenario = "A"
        self.active_bound = "EB"
        self.active_week = 9
        self.selected_line_a = None
        self.selected_line_b = None

    def get_header_context(self, screen_name):
        params = {p["key"]: p["value"] for p in self.service.get_parameters()}
        h_info = f"{params.get('horizon_weeks', '30')} Weeks"
        scan = self.service.scan_all_issues(scenario=self.active_scenario)
        return render_app_header(
            active_screen=screen_name,
            scenario=self.active_scenario,
            db_name=getattr(self.service, "active_db_label", "Default"),
            issues_count=scan["total_issues"],
            horizon=h_info
        )

    def run(self):
        """Main interactive menu loop."""
        while True:
            console.clear()
            console.print(self.get_header_context("Main Dashboard"))
            console.print(render_nav_footer())

            # Formatted Rich Menu Table
            menu_table = Table(
                title="SELECT VIEW OR OPERATION",
                box=ROUNDED,
                header_style="bold bright_white on dark_blue",
                title_style="bold bright_yellow",
                show_lines=True,
                expand=True
            )
            menu_table.add_column("Key", justify="center", style="bold bright_yellow", width=7)
            menu_table.add_column("Screen / Tool", justify="left", style="bold bright_white", width=34)
            menu_table.add_column("Features & Capabilities", justify="left", style="dim")

            menu_table.add_row("[1]", "🗺️  Multi-Line Network Visualizer", "Dynamic all-lines overview, stacked tracks, and side-by-side line comparator")
            menu_table.add_row("[2]", "⚠️  Issue & Violation Explorer", "Capacity bottlenecks, DAG precedence/cycles, contract overrun penalties, ECLO")
            menu_table.add_row("[3]", "🩺  Diagnostics & Health Dashboard", "Table populations, FK integrity, DAG acyclicity, coordinate continuity")
            menu_table.add_row("[4]", "✏️  Database Update Studio", "Live editing of parameters, safety buffers, contracts, and activity priorities")
            menu_table.add_row("[5]", "🔄  Database Operations Manager", "Upload new dataset with pre-flight dry-run check, flush database, export CSVs")
            menu_table.add_row("[6]", "📊  Weekly Capacity Utilization Heatmap", "2D grid of locations vs weeks 1..30 across individual lines or ALL lines")
            menu_table.add_row("[7]", "🔍  Activity Footprint Inspector", "1D continuous interval working span and safety exclusion envelope bar")
            menu_table.add_row("[8]", "🏆  Scenario Penalty Scores & Breakdown", "Side-by-side comparison of Scenarios A, B, and C with overrun days")
            menu_table.add_row("[S]", f"🔀  Switch Active Scenario [{self.active_scenario}]", "Toggle active evaluation context between Scenario A, B, and C")
            menu_table.add_row("[B]", f"🧭  Toggle Track Bound [{self.active_bound}]", "Toggle active track direction between Eastbound (EB) and Westbound (WB)")
            menu_table.add_row("[Q]", "🚪  Exit Terminal Application", "Gracefully terminate application")

            print()
            console.print(menu_table)

            try:
                choice = Prompt.ask("\nEnter selection", choices=["1", "2", "3", "4", "5", "6", "7", "8", "S", "B", "Q"], default="1").upper()
            except (EOFError, KeyboardInterrupt):
                print("\nExiting TUI.")
                break

            if choice == "1":
                self.show_network_screen()
            elif choice == "2":
                self.show_issue_screen()
            elif choice == "3":
                self.show_diagnostic_screen()
            elif choice == "4":
                self.show_editor_screen()
            elif choice == "5":
                self.show_manager_screen()
            elif choice == "6":
                self.show_heatmap_screen()
            elif choice == "7":
                self.show_activity_screen()
            elif choice == "8":
                self.show_scores_screen()
            elif choice == "S":
                self.switch_scenario()
            elif choice == "B":
                self.active_bound = "WB" if self.active_bound == "EB" else "EB"
                console.print(f"[bold bright_green]✓ Bound toggled to: {self.active_bound}[/bold bright_green]")
                Prompt.ask("Press Enter to continue")
            elif choice == "Q":
                console.print("\n[bold bright_cyan]Thank you for using NebulaX Database Terminal.[/bold bright_cyan]")
                break

    # Screen Handlers
    def show_network_screen(self):
        while True:
            console.clear()
            console.print(self.get_header_context("Multi-Line Network Visualizer"))
            render_network_screen(
                self.service,
                bound=self.active_bound,
                week=self.active_week,
                scenario=self.active_scenario,
                line_a=self.selected_line_a,
                line_b=self.selected_line_b
            )
            print()
            options_text = Text()
            options_text.append("Screen Actions: ", style="bold bright_white")
            options_text.append("[W] ", style="bold bright_yellow"); options_text.append("Change Week  │ ", style="dim")
            options_text.append("[B] ", style="bold bright_cyan"); options_text.append("Toggle Bound  │ ", style="dim")
            options_text.append("[C] ", style="bold bright_magenta"); options_text.append("Select Line Pair to Compare  │ ", style="dim")
            options_text.append("[Enter] ", style="bold bright_green"); options_text.append("Return to Main Menu", style="bright_white")
            console.print(Panel(Align.center(options_text), box=ROUNDED, border_style="dim"))

            sub = input("Selection: ").strip().upper()
            if sub == "W":
                try:
                    self.active_week = int(Prompt.ask("Enter week number (1-30)", default=str(self.active_week)))
                except ValueError:
                    pass
            elif sub == "B":
                self.active_bound = "WB" if self.active_bound == "EB" else "EB"
            elif sub == "C":
                all_l = [l["line_code"] for l in self.service.get_lines()]
                if len(all_l) >= 2:
                    self.selected_line_a = Prompt.ask("Select first line", choices=all_l, default=all_l[0])
                    self.selected_line_b = Prompt.ask("Select second line", choices=all_l, default=all_l[1])
                else:
                    console.print("[dim]Only 1 line exists in this database.[/dim]")
                    Prompt.ask("Press Enter to continue")
            else:
                break

    def show_issue_screen(self):
        console.clear()
        console.print(self.get_header_context("Issue & Violation Explorer"))
        render_issue_screen(self.service, scenario=self.active_scenario)
        Prompt.ask("\nPress Enter to return to main menu")

    def show_diagnostic_screen(self):
        console.clear()
        console.print(self.get_header_context("System Health Diagnostics"))
        render_diagnostic_screen(self.service)
        Prompt.ask("\nPress Enter to return to main menu")

    def show_editor_screen(self):
        render_editor_screen(self.service)

    def show_manager_screen(self):
        render_manager_screen(self.service, active_scenario=self.active_scenario)

    def show_heatmap_screen(self):
        console.clear()
        console.print(self.get_header_context("Capacity Utilization Heatmap"))
        lines = [l["line_code"] for l in self.service.get_lines()]
        line_choices = lines + ["ALL"]
        line = Prompt.ask("Select Line to view", choices=line_choices, default=lines[0] if lines else "ALL")
        data = self.service.get_capacity_heatmap(scenario=self.active_scenario, line_code=line, bound=self.active_bound, week_start=1, week_end=15)
        render_capacity_heatmap(data)
        Prompt.ask("\nPress Enter to return to main menu")

    def show_activity_screen(self):
        console.clear()
        console.print(self.get_header_context("Activity Footprint Inspector"))
        acts = self.service.get_activities_list()
        print(f"\nAvailable Activities (First 10 shown):")
        for a in acts[:10]:
            print(f"  - {a['activity_id']}: {a['contract_number']} (P{a['priority']}, {a['volume']} nights)")
        aid = Prompt.ask("\nEnter Activity ID to inspect", default="A001").upper()
        details = self.service.get_activity_details(aid)
        if not details:
            console.print(f"\n[bold bright_red]Error: Activity '{aid}' was not found in the database![/bold bright_red]")
        else:
            render_activity_card(details)
        Prompt.ask("\nPress Enter to return to main menu")

    def show_scores_screen(self):
        console.clear()
        console.print(self.get_header_context("Scenario Scores Comparison"))
        scores = self.service.get_scenario_scores()
        render_score_card(scores)
        Prompt.ask("\nPress Enter to return to main menu")

    def switch_scenario(self):
        scen = Prompt.ask("Select new active scenario", choices=["A", "B", "C"], default=self.active_scenario).upper()
        self.active_scenario = scen
        console.print(f"[bold bright_green]✓ Active scenario switched to: [{scen}][/bold bright_green]")
        Prompt.ask("Press Enter to continue")


def main():
    parser = argparse.ArgumentParser(description="NebulaX Interactive Rich TUI")
    parser.add_argument("--view", choices=["network", "issues", "diagnostics", "editor", "manager", "heatmap", "activity", "scores"], help="Headless view rendering")
    parser.add_argument("--scenario", default="A", choices=["A", "B", "C"], help="Active scenario")
    parser.add_argument("--bound", default="EB", choices=["EB", "WB"], help="Active bound")
    parser.add_argument("--week", type=int, default=9, help="Week number for live occupancy")
    parser.add_argument("--line-a", default=None, help="First line for comparison")
    parser.add_argument("--line-b", default=None, help="Second line for comparison")
    parser.add_argument("--activity-id", default="A004", help="Activity ID for activity inspector")
    parser.add_argument("--seed-dir", default=None, help="Initial dataset directory")
    args = parser.parse_args()

    app = NebulaRichTUI(seed_dir=args.seed_dir)
    app.active_scenario = args.scenario
    app.active_bound = args.bound
    app.active_week = args.week
    app.selected_line_a = args.line_a
    app.selected_line_b = args.line_b

    if args.view:
        if args.view == "network":
            render_network_screen(
                app.service,
                bound=app.active_bound,
                week=app.active_week,
                scenario=app.active_scenario,
                line_a=app.selected_line_a,
                line_b=app.selected_line_b
            )
        elif args.view == "issues":
            render_issue_screen(app.service, scenario=app.active_scenario)
        elif args.view == "diagnostics":
            render_diagnostic_screen(app.service)
        elif args.view == "heatmap":
            line = app.selected_line_a or "ALL"
            data = app.service.get_capacity_heatmap(scenario=app.active_scenario, line_code=line, bound=app.active_bound, week_start=1, week_end=15)
            render_capacity_heatmap(data)
        elif args.view == "activity":
            details = app.service.get_activity_details(args.activity_id)
            render_activity_card(details)
        elif args.view == "scores":
            scores = app.service.get_scenario_scores()
            render_score_card(scores)
    else:
        app.run()


if __name__ == "__main__":
    main()
