"""
editor_screen.py: Database Update Studio.
Provides forms to edit system parameters, buffer rules, contracts, and activities.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.prompt import Prompt, Confirm
from rich.align import Align
from rich.box import ROUNDED

console = Console()


def render_editor_screen(service):
    """Renders the database editing interface and handles update interactions."""
    while True:
        console.clear()
        console.print(Panel(Align.center(Text("DATABASE UPDATE STUDIO", style="bold magenta")), box=ROUNDED, border_style="magenta"))

        params = service.get_parameters()
        buffers = service.get_buffer_rules()
        contracts = service.get_contracts_list()

        # 1. System Parameters Table
        param_table = Table(title="1. System Parameters", box=ROUNDED, header_style="bold cyan", title_style="bold yellow", show_lines=True)
        param_table.add_column("Parameter Key", style="bold cyan", width=20)
        param_table.add_column("Current Value", style="bold yellow", width=16)
        param_table.add_column("Description", style="dim")
        for p in params:
            param_table.add_row(p["key"], p["value"], p["description"])

        # 2. Buffer Rules Table
        buf_table = Table(title="2. Safety Exclusion Buffer Rules", box=ROUNDED, header_style="bold cyan", title_style="bold yellow", show_lines=True)
        buf_table.add_column("Nature of Works", style="bold white", width=24)
        buf_table.add_column("Buffer Sectors", justify="center", style="bold yellow", width=16)
        buf_table.add_column("Opposite Bound Enforced", justify="center", width=24)
        for b in buffers:
            opp_text = Text("YES", style="bold red") if b["opposite_bound_required"] else Text("NO", style="dim")
            buf_table.add_row(b["nature_of_works"], str(b["up_to_buffer_sectors"]) + " sectors", opp_text)

        console.print(param_table)
        console.print(buf_table)

        print("\n[EDIT ACTIONS]")
        print("  [1] Edit a System Parameter (e.g. horizon_weeks, horizon_start)")
        print("  [2] Edit a Buffer Rule (e.g. Live, Non-live consist)")
        print("  [3] Edit a Contract (Workfronts, Max Weekly Access, Priority, Deadline)")
        print("  [4] Edit an Activity (Priority, Volume, Start Date)")
        print("  [B] Back to Main Menu")

        choice = Prompt.ask("\nSelect action", choices=["1", "2", "3", "4", "B"], default="B").upper()

        if choice == "B":
            break

        if choice == "1":
            keys = [p["key"] for p in params]
            key = Prompt.ask("Enter parameter key to edit", choices=keys)
            val = Prompt.ask(f"Enter new value for '{key}'")
            service.update_parameter(key, val)
            console.print(f"[bold green]✓ Parameter '{key}' successfully updated to '{val}'![/bold green]")
            Prompt.ask("Press Enter to continue")

        elif choice == "2":
            natures = [b["nature_of_works"] for b in buffers]
            nature = Prompt.ask("Select nature of works to edit", choices=natures)
            sectors = Prompt.ask("Enter buffer sectors (0-3)", default="2")
            opp = Confirm.ask("Require opposite bound buffer?")
            service.update_buffer_rule(nature, int(sectors), opp)
            console.print(f"[bold green]✓ Buffer rule for '{nature}' updated![/bold green]")
            Prompt.ask("Press Enter to continue")

        elif choice == "3":
            c_nums = [c["contract_number"] for c in contracts]
            c_num = Prompt.ask("Enter Contract Number to edit (e.g. C001)", choices=c_nums)
            current_c = next(c for c in contracts if c["contract_number"] == c_num)
            console.print(f"Editing {c_num} (Current: P{current_c['priority']}, {current_c['workfronts']} workfronts, max {current_c['max_access_per_week']} acc/wk, deadline: {current_c['planned_deadline']})")

            prio = Prompt.ask("New Priority (1-3, or Enter to keep)", default=str(current_c["priority"]))
            wf = Prompt.ask("New Workfronts (1-3, or Enter to keep)", default=str(current_c["workfronts"]))
            max_acc = Prompt.ask("New Max Access/Wk (1-5, or Enter to keep)", default=str(current_c["max_access_per_week"]))
            deadline = Prompt.ask("New Planned Deadline (YYYY-MM-DD, or Enter to keep)", default=str(current_c["planned_deadline"]))

            service.update_contract(c_num, priority=int(prio), planned_completion=deadline, workfronts=int(wf), max_access_per_week=int(max_acc))
            console.print(f"[bold green]✓ Contract {c_num} updated![/bold green]")
            Prompt.ask("Press Enter to continue")

        elif choice == "4":
            aid = Prompt.ask("Enter Activity ID to edit (e.g. A001)")
            act = service.get_activity_details(aid)
            if not act:
                console.print(f"[bold red]Activity {aid} not found![/bold red]")
            else:
                console.print(f"Editing {aid} (Current: P{act['activity_priority']}, {act['total_accesses']} accesses, start: {act['planned_start_date']})")
                prio = Prompt.ask("New Priority (1-3, or Enter to keep)", default=str(act["activity_priority"]))
                vol = Prompt.ask("New Total Accesses (or Enter to keep)", default=str(act["total_accesses"]))
                pdate = Prompt.ask("New Planned Start Date (YYYY-MM-DD, or Enter to keep)", default=str(act["planned_start_date"]))
                service.update_activity(aid, priority=int(prio), planned_start_date=pdate, total_accesses=int(vol))
                console.print(f"[bold green]✓ Activity {aid} updated![/bold green]")
            Prompt.ask("Press Enter to continue")
