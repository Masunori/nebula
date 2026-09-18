#!/usr/bin/env python3
"""
test_all_tui_options.py: Automated End-to-End Test Suite for All TUI Menu Options.
Executes every screen, sub-action, form, and data service method to catch any runtime bugs,
formatting glitches, or input exceptions.
"""

import sys
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))

from tui.db_service import DBAnalyticsService
from tui.screens.network_screen import render_network_screen
from tui.screens.issue_screen import render_issue_screen
from tui.screens.diagnostic_screen import render_diagnostic_screen
from tui.screens.editor_screen import render_editor_screen
from tui.screens.manager_screen import render_manager_screen
from tui.renderers import render_capacity_heatmap, render_activity_card, render_score_card
from scripts.nebula_tui import NebulaRichTUI


def run_all_tests():
    print("=" * 70)
    print("RUNNING COMPREHENSIVE TUI MENU OPTIONS & SCREENS BUG-CHECK SUITE")
    print("=" * 70)

    # 1. Initialize Service & App
    print("\n[TEST 1] Initializing DBAnalyticsService & NebulaRichTUI...")
    service = DBAnalyticsService()
    app = NebulaRichTUI()
    assert service is not None
    assert app is not None
    print("  -> [PASS] Initialization successful.")

    # 2. Test Option 1: Network Screen (All lines, custom lines, bounds, weeks)
    print("\n[TEST 2] Testing Option 1: Network Screen...")
    orig_inp = __builtins__.input
    try:
        # Default 2 lines
        render_network_screen(service, bound="EB", week=9, scenario="A")
        render_network_screen(service, bound="WB", week=12, scenario="B")
        # Multi-line Tier 1
        s_tier1 = DBAnalyticsService(seed_dir="test_fixtures/tier_1")
        render_network_screen(s_tier1, bound="EB", week=5, scenario="A", line_a="ALP", line_b="GAM")
        # Multi-line Tier 2
        s_tier2 = DBAnalyticsService(seed_dir="test_fixtures/tier_2")
        render_network_screen(s_tier2, bound="WB", week=1, scenario="A", line_a="DEL", line_b="EPS")

        # Test app.show_network_screen interactive handler directly with options W, B, C, Enter
        net_inputs = iter(["W", "14", "B", "C", "ALP", "BET", ""])
        __builtins__.input = lambda prompt="": next(net_inputs)
        app.show_network_screen()
        __builtins__.input = orig_inp
        assert app.active_week == 14
        assert app.active_bound == "WB"
        assert app.selected_line_a == "ALP"
        assert app.selected_line_b == "BET"
        print("  -> [PASS] Network screen renders cleanly across all datasets, bounds, and interactive controls.")
    except Exception as e:
        __builtins__.input = orig_inp
        print(f"  -> [FAIL] Network screen raised: {e}")
        raise e

    # 3. Test Option 2: Issue Screen (Default & Fault-injected Tier 3)
    print("\n[TEST 3] Testing Option 2: Issue Screen...")
    try:
        render_issue_screen(service, scenario="A")
        render_issue_screen(service, scenario="B")
        s_tier3 = DBAnalyticsService(seed_dir="test_fixtures/tier_3")
        render_issue_screen(s_tier3, scenario="A")

        # Test app.show_issue_screen() handler
        issue_inputs = iter([""])
        __builtins__.input = lambda prompt="": next(issue_inputs)
        app.show_issue_screen()
        __builtins__.input = orig_inp
        print("  -> [PASS] Issue screen renders cleanly with zero issues, overruns, and DAG cycles.")
    except Exception as e:
        __builtins__.input = orig_inp
        print(f"  -> [FAIL] Issue screen raised: {e}")
        raise e

    # 4. Test Option 3: Diagnostics Screen
    print("\n[TEST 4] Testing Option 3: Diagnostics Screen...")
    try:
        render_diagnostic_screen(service)
        render_diagnostic_screen(s_tier1)
        render_diagnostic_screen(s_tier2)

        # Test app.show_diagnostic_screen() handler
        diag_inputs = iter([""])
        __builtins__.input = lambda prompt="": next(diag_inputs)
        app.show_diagnostic_screen()
        __builtins__.input = orig_inp
        print("  -> [PASS] Diagnostics screen renders cleanly with all table audits.")
    except Exception as e:
        __builtins__.input = orig_inp
        print(f"  -> [FAIL] Diagnostics screen raised: {e}")
        raise e

    # 5. Test Option 4: Editor Screen & Operations
    print("\n[TEST 5] Testing Option 4: Editor Operations...")
    try:
        # Test simulated inputs for editor screen:
        # Action 1: edit param 'horizon_weeks' -> 32
        # Action 2: edit buffer 'Live' -> 2 sectors, opp: y
        # Action 3: edit contract C001 -> prio 1, wf 2, max 3, deadline 2026-06-30
        # Action 4: edit activity A001 -> prio 1, vol 6, date 2026-01-05
        # Action B: back
        simulated_inputs = iter([
            "1", "horizon_weeks", "32", "",
            "2", "Live", "2", "y", "",
            "3", "C001", "1", "2", "3", "2026-06-30", "",
            "4", "A001", "1", "6", "2026-01-05", "",
            "B"
        ])
        __builtins__.input = lambda prompt="": next(simulated_inputs)
        render_editor_screen(service)
        __builtins__.input = orig_inp

        # Verify values changed in DB
        params = {p["key"]: p["value"] for p in service.get_parameters()}
        assert params["horizon_weeks"] == "32", f"Expected 32, got {params['horizon_weeks']}"
        act = service.get_activity_details("A001")
        assert act["total_accesses"] == 6, f"Expected 6, got {act['total_accesses']}"
        print("  -> [PASS] Editor screen interactive flow and DB updates verified successfully.")
    except Exception as e:
        __builtins__.input = orig_inp
        print(f"  -> [FAIL] Editor screen raised: {e}")
        raise e

    # 6. Test Option 5: Manager Screen Operations (Upload Validation, Flush, Export)
    print("\n[TEST 6] Testing Option 5: Manager Operations...")
    try:
        # Test Pre-Flight Validation directly
        v1 = service.validate_upload_directory("init_data")
        assert v1["is_valid"] is True
        assert len(v1["stats"]) == 8

        v2 = service.validate_upload_directory("test_fixtures/tier_3")
        assert len(v2["warnings"]) > 0  # Should flag DAG cycles as warning

        # Test simulated inputs for manager:
        # Option 1: Upload dataset tier_1
        # Option 3: Export schedule
        # Option B: Exit
        simulated_inputs = iter([
            "1", "1", "y", "",         # Upload Tier 1 and confirm
            "3", "test_export_tmp", "", # Export to test_export_tmp
            "B"                         # Exit
        ])
        __builtins__.input = lambda prompt="": next(simulated_inputs)
        render_manager_screen(service, active_scenario="A")
        __builtins__.input = orig_inp

        # Clean up export tmp
        export_dir = os.path.join(BASE_DIR, "test_export_tmp")
        if os.path.exists(export_dir):
            for f in os.listdir(export_dir):
                os.remove(os.path.join(export_dir, f))
            os.rmdir(export_dir)

        # Re-seed back to default
        service.flush_and_reseed("init_data")
        assert len(service.get_activities_list()) == 54
        print("  -> [PASS] Manager screen pre-flight upload, export, and flush operations verified.")
    except Exception as e:
        __builtins__.input = orig_inp
        print(f"  -> [FAIL] Manager screen raised: {e}")
        raise e

    # 7. Test Option 6: Capacity Heatmap
    print("\n[TEST 7] Testing Option 6: Capacity Heatmap...")
    try:
        # Test individual line
        d_alp = service.get_capacity_heatmap(scenario="A", line_code="ALP", bound="EB", week_start=1, week_end=10)
        render_capacity_heatmap(d_alp)
        # Test 'ALL' lines
        d_all = service.get_capacity_heatmap(scenario="A", line_code="ALL", bound="EB", week_start=1, week_end=10)
        render_capacity_heatmap(d_all)

        # Test app.show_heatmap_screen() handler
        hm_inputs = iter(["ALP", ""])
        __builtins__.input = lambda prompt="": next(hm_inputs)
        app.show_heatmap_screen()
        __builtins__.input = orig_inp
        print("  -> [PASS] Capacity heatmap renders cleanly for single and ALL lines.")
    except Exception as e:
        __builtins__.input = orig_inp
        print(f"  -> [FAIL] Capacity heatmap raised: {e}")
        raise e

    # 8. Test Option 7: Activity Inspector
    print("\n[TEST 8] Testing Option 7: Activity Inspector...")
    try:
        for aid in ["A001", "A004", "A011"]:
            det = service.get_activity_details(aid)
            assert det is not None, f"Expected {aid} to exist"
            render_activity_card(det)
        # Verify nonexistent activity handled gracefully
        det_invalid = service.get_activity_details("A999")
        assert det_invalid is None
        render_activity_card(det_invalid)

        # Test app.show_activity_screen() handler
        act_inputs = iter(["A001", ""])
        __builtins__.input = lambda prompt="": next(act_inputs)
        app.show_activity_screen()
        __builtins__.input = orig_inp
        print("  -> [PASS] Activity inspector card renders cleanly for valid and invalid IDs.")
    except Exception as e:
        __builtins__.input = orig_inp
        print(f"  -> [FAIL] Activity inspector raised: {e}")
        raise e

    # 9. Test Option 8: Scenario Scores Comparison
    print("\n[TEST 9] Testing Option 8: Scenario Scores Comparison...")
    try:
        scores = service.get_scenario_scores()
        assert len(scores) >= 3
        render_score_card(scores)

        # Test app.show_scores_screen() handler
        sc_inputs = iter([""])
        __builtins__.input = lambda prompt="": next(sc_inputs)
        app.show_scores_screen()
        __builtins__.input = orig_inp
        print("  -> [PASS] Scenario scorecard renders cleanly.")
    except Exception as e:
        __builtins__.input = orig_inp
        print(f"  -> [FAIL] Scenario scores raised: {e}")
        raise e

    # 10. Test Full Main Application Event Loop Exercising All Menu Keys:
    # 1, 2, 3, 4, 5, 6, 7, 8, S, B, Q
    print("\n[TEST 10] Testing Complete Main Application Event Loop with ALL Menu Keys...")
    try:
        full_session_inputs = iter([
            "1", "",           # [1] Network -> return
            "2", "",           # [2] Issues -> return
            "3", "",           # [3] Diagnostics -> return
            "4", "B",          # [4] Editor -> Back
            "5", "B",          # [5] DB Manager -> Back
            "6", "ALP", "",    # [6] Heatmap -> Line ALP -> return
            "7", "A001", "",   # [7] Activity -> A001 -> return
            "8", "",           # [8] Scores -> return
            "S", "B", "",      # [S] Switch scenario to B
            "B", "",           # [B] Toggle bound
            "Q"                # [Q] Quit
        ])
        __builtins__.input = lambda prompt="": next(full_session_inputs)
        fresh_app = NebulaRichTUI()
        fresh_app.run()
        __builtins__.input = orig_inp
        print("  -> [PASS] Full event loop exercised all 11 menu keys without error.")
    except Exception as e:
        __builtins__.input = orig_inp
        print(f"  -> [FAIL] Main application loop raised: {e}")
        raise e

    print("\n" + "=" * 70)
    print("ALL 10 TEST SUITES PASSED! ZERO BUGS DETECTED IN TUI MENU OPTIONS!")
    print("=" * 70)


if __name__ == "__main__":
    run_all_tests()
