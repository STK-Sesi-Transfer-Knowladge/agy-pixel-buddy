import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "companion"))

import floating_buddy as fb


class FloatingBuddyLogicTests(unittest.TestCase):
    def test_resolve_effective_state_transitions(self):
        done_fresh = fb.resolve_effective_state(
            {"state": "done", "detail": "Task complete!", "updatedAt": 10_000},
            now_ms=12_000,
        )
        self.assertEqual(done_fresh["state"], "done")

        done_expired = fb.resolve_effective_state(
            {"state": "done", "detail": "Task complete!", "updatedAt": 10_000},
            now_ms=16_000,
        )
        self.assertEqual(done_expired["state"], "idle")

        stale_coding = fb.resolve_effective_state(
            {"state": "coding", "detail": "Coding a.js", "updatedAt": 10_000},
            now_ms=150_000,
            idle_timeout_ms=120_000,
        )
        self.assertEqual(stale_coding["state"], "idle")

    def test_normalize_config_maps_legacy_modes_and_validates_language(self):
        cfg = fb.normalize_config(
            {"character": "unknown", "trainer": "unknown", "moveMode": "hover", "language": "fr", "scale": 99},
            fallback_char="bot",
            fallback_lang="id",
            fallback_trainer="girl",
        )
        self.assertEqual(cfg["character"], "bot")
        self.assertEqual(cfg["trainer"], "girl")
        self.assertEqual(cfg["moveMode"], "sticky")
        self.assertEqual(cfg["language"], "id")
        self.assertEqual(cfg["bubbleMode"], "auto")
        self.assertEqual(cfg["scale"], 3)

        cfg_fly = fb.normalize_config({"moveMode": "fly", "language": "en", "trainer": "sensei"})
        self.assertEqual(cfg_fly["moveMode"], "random")
        self.assertEqual(cfg_fly["language"], "en")
        self.assertEqual(cfg_fly["trainer"], "sensei")

    def test_localize_detail_translates_id_and_preserves_en(self):
        self.assertEqual(fb.localize_detail("Coding extension.js", "id"), "Ngoding extension.js")
        self.assertEqual(fb.localize_detail("Thinking...", "id"), "Lagi mikir...")
        self.assertEqual(fb.localize_detail("Coding extension.js", "en"), "Coding extension.js")

    def test_should_trigger_prompt_reaction_respects_enabled_trigger_mode_and_freshness(self):
        now = 100_000
        fresh_pre = {"event": "PreInvocation", "state": "thinking", "updatedAt": 99_500}
        fresh_tool = {"event": "PreToolUse", "tool": "edit_file", "state": "coding", "updatedAt": 99_600}
        stop_prev = {"event": "Stop", "state": "done", "updatedAt": 95_000}

        # Prompt mode: only PreInvocation from Stop/SessionStart/idle/done
        self.assertTrue(fb.should_trigger_prompt_reaction(stop_prev, fresh_pre, "done", 0, now, enabled=True, trigger_mode="prompt"))
        self.assertFalse(fb.should_trigger_prompt_reaction(stop_prev, fresh_pre, "done", 0, now, enabled=False, trigger_mode="prompt"))
        self.assertFalse(fb.should_trigger_prompt_reaction(stop_prev, fresh_pre, "done", 99_500, now, enabled=True, trigger_mode="prompt"))
        post_tool = {"event": "PostToolUse", "state": "thinking", "updatedAt": 99_000}
        self.assertFalse(fb.should_trigger_prompt_reaction(post_tool, fresh_pre, "thinking", 0, now, enabled=True, trigger_mode="prompt"))

        # Hook mode: triggers on any fresh hook change (PreToolUse, PostToolUse, Stop, etc.)
        self.assertTrue(fb.should_trigger_prompt_reaction(post_tool, fresh_tool, "thinking", 99_000, now, enabled=True, trigger_mode="hook"))
        self.assertFalse(fb.should_trigger_prompt_reaction(post_tool, fresh_tool, "thinking", 99_600, now, enabled=True, trigger_mode="hook"))

        # Stale startup event never triggers in either mode
        stale_pre = {"event": "PreInvocation", "state": "thinking", "updatedAt": 50_000}
        self.assertFalse(fb.should_trigger_prompt_reaction(None, stale_pre, "idle", 0, now, enabled=True, trigger_mode="hook"))

    def test_step_flight_position_bounces_within_screen_bounds(self):
        nx, ny, nvx, nvy = fb.step_flight_position(
            x=990.0,
            y=5.0,
            vx=50.0,
            vy=-40.0,
            bounds=(0, 0, 1000, 600),
            win_w=100,
            win_h=80,
            dt=0.5,
        )
        self.assertLessEqual(nx, 1000 - 100 - 16)
        self.assertLess(nvx, 0)
        self.assertGreaterEqual(ny, 16)
        self.assertGreater(nvy, 0)

    def test_is_ide_window_class_matches_only_antigravity(self):
        self.assertTrue(fb.is_ide_window_class(b"antigravity ide\x00Antigravity IDE\x00"))
        self.assertFalse(fb.is_ide_window_class(b"google-chrome\x00Google-chrome\x00"))
        self.assertFalse(fb.is_ide_window_class(b"gnome-terminal-server\x00Gnome-terminal\x00"))
        self.assertFalse(fb.is_ide_window_class(b""))

    def test_should_trigger_click_reaction_only_on_non_drag_idle_click(self):
        self.assertTrue(fb.should_trigger_click_reaction({"state": "idle"}, drag_moved=False))
        self.assertFalse(fb.should_trigger_click_reaction({"state": "idle"}, drag_moved=True))
        self.assertFalse(fb.should_trigger_click_reaction({"state": "coding"}, drag_moved=False))
        self.assertFalse(fb.should_trigger_click_reaction(None, drag_moved=False))

    def test_select_state_for_ide_title_isolates_workspaces(self):
        store = {
            "workspaces": {
                "/mnt/project/agy-pixel-buddy": {
                    "workspaceName": "agy-pixel-buddy",
                    "state": "coding",
                    "detail": "Coding app.js",
                    "updatedAt": 10_000,
                },
                "/mnt/project/kasirv2": {
                    "workspaceName": "kasirv2",
                    "state": "thinking",
                    "detail": "Thinking...",
                    "updatedAt": 12_000,
                },
                "__global__": {
                    "workspaceName": "",
                    "state": "terminal",
                    "detail": "Running ls",
                    "updatedAt": 11_000,
                },
            }
        }
        st1, k1 = fb.select_state_for_ide_title(store, "agy-pixel-buddy - Antigravity IDE - extension.js")
        self.assertEqual(st1["state"], "coding")
        self.assertEqual(k1, "/mnt/project/agy-pixel-buddy")

        st2, k2 = fb.select_state_for_ide_title(store, "kasirv2 - Antigravity IDE")
        self.assertEqual(st2["state"], "thinking")
        self.assertEqual(k2, "/mnt/project/kasirv2")

        # Window 3 with idle project never seen by hooks -> returns None (idle)
        st3, _k3 = fb.select_state_for_ide_title(store, "other-empty-app - Antigravity IDE")
        self.assertIsNone(st3)

        # Empty Antigravity IDE window uses __global__ if any
        st4, k4 = fb.select_state_for_ide_title(store, "Antigravity IDE")
        self.assertEqual(st4["state"], "terminal")
        self.assertEqual(k4, "__global__")


if __name__ == "__main__":
    unittest.main()
