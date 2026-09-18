"""
ui_components.py: Rich UI Components, Headers, Panels, Tables, and Navigation Bars.
Powered by Python's `rich` library with high-contrast colors for seamless cross-platform display.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.align import Align
from rich.box import ROUNDED, HEAVY_HEAD, SIMPLE

console = Console()


def render_app_header(active_screen="Dashboard", scenario="A", db_name="Default (init_data/)", issues_count=0, horizon="30 Weeks"):
    """Renders the top application header panel with live high-contrast badges."""
    header_text = Text()
    header_text.append("NEBULAX ", style="bold bright_white on dark_blue")
    header_text.append(" RAILWAY TRACK ACCESS OPTIMISER ", style="bold bright_cyan")
    header_text.append("│ ", style="dim")
    header_text.append(f"View: {active_screen} ", style="bold bright_yellow")
    header_text.append("│ ", style="dim")
    header_text.append(f"Scenario: [{scenario}] ", style="bold bright_green" if scenario == "A" else "bold bright_cyan")
    header_text.append("│ ", style="dim")
    header_text.append(f"DB: {db_name} ", style="bold bright_magenta")
    header_text.append("│ ", style="dim")
    header_text.append(f"Horizon: {horizon} ", style="bright_white")

    if issues_count > 0:
        header_text.append("│ ", style="dim")
        header_text.append(f"⚠️ {issues_count} Issues ", style="bold bright_white on red")
    else:
        header_text.append("│ ", style="dim")
        header_text.append("✓ 0 Issues ", style="bold bright_green")

    return Panel(
        Align.center(header_text),
        box=ROUNDED,
        border_style="bright_cyan",
        padding=(0, 1)
    )


def render_nav_footer():
    """Renders the bottom navigation bar with shortcut hotkeys in high contrast."""
    nav_text = Text()
    shortcuts = [
        ("[1]", "Network", "bright_cyan"),
        ("[2]", "Issues", "bright_yellow"),
        ("[3]", "Diagnostics", "bright_green"),
        ("[4]", "Editor", "bright_magenta"),
        ("[5]", "DB Manager", "sky_blue1"),
        ("[6]", "Heatmap", "bright_cyan"),
        ("[S]", "Scenario", "bright_white"),
        ("[Q]", "Quit", "bright_red")
    ]
    for key, label, col in shortcuts:
        nav_text.append(f" {key} ", style=f"bold {col}")
        nav_text.append(f"{label}  ", style="bright_white")

    return Panel(
        Align.center(nav_text),
        box=ROUNDED,
        border_style="dim",
        padding=(0, 1)
    )


def create_styled_table(title, columns):
    """Helper to create a formatted Rich Table."""
    table = Table(
        title=title,
        box=ROUNDED,
        header_style="bold bright_cyan",
        title_style="bold bright_yellow",
        show_lines=True
    )
    for col_name, justify, style in columns:
        table.add_column(col_name, justify=justify, style=style)
    return table
