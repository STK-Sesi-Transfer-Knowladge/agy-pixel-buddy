#!/usr/bin/env python3
"""
Transparent always-on-top desktop pixel buddy for Antigravity IDE.
Supports Random Move, Sticky (stay wherever dragged), Hide (disable), and EN/ID localization.
"""

from __future__ import annotations

import argparse
import ctypes
import json
import math
import os
import random
import signal
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

try:
    import fcntl
except ImportError:
    fcntl = None  # type: ignore[assignment]

try:
    import msvcrt
except ImportError:
    msvcrt = None  # type: ignore[assignment]

DEFAULT_STATE_PATH = Path.home() / ".gemini" / "antigravity" / "buddy-state.json"
DEFAULT_WORKSPACES_PATH = Path.home() / ".gemini" / "antigravity" / "buddy-workspaces.json"
DEFAULT_CONFIG_PATH = Path.home() / ".gemini" / "antigravity" / "buddy-floating-config.json"
DEFAULT_LOCK_PATH = Path.home() / ".gemini" / "antigravity" / "buddy-floating.lock"
DEFAULT_PID_PATH = Path.home() / ".gemini" / "antigravity" / "buddy-floating.pid"

VALID_CHARS = ("cat", "bot", "dev", "kyubi", "jokowi", "prabowo", "trump", "putin", "kim", "fufufafa")
VALID_TRAINERS = ("boss", "girl", "sensei", "naruto", "jokowi", "prabowo", "trump", "putin", "kim", "fufufafa")
VALID_MODES = ("random", "sticky")
ALL_MODES = ("random", "sticky", "hidden")
VALID_BUBBLE_MODES = ("auto", "always", "off")
VALID_LANGS = ("en", "id")
VALID_REACTION_TRIGGERS = ("hook", "prompt")

STATE_META = {
    "idle": {"en": "IDLE", "id": "DIAM", "accent": "#94a3b8", "badge_bg": "#1e293b"},
    "thinking": {"en": "THINKING", "id": "MIKIR", "accent": "#fbbf24", "badge_bg": "#3b2f13"},
    "coding": {"en": "CODING", "id": "NGODING", "accent": "#34d399", "badge_bg": "#133829"},
    "reading": {"en": "READING", "id": "BACA", "accent": "#60a5fa", "badge_bg": "#172e4d"},
    "terminal": {"en": "TERMINAL", "id": "TERMINAL", "accent": "#a3e635", "badge_bg": "#222e18"},
    "searching": {"en": "SEARCHING", "id": "CARI", "accent": "#c084fc", "badge_bg": "#2f1f4a"},
    "delegating": {"en": "DELEGATING", "id": "DELEGASI", "accent": "#f472b6", "badge_bg": "#3b1d36"},
    "working": {"en": "WORKING", "id": "KERJA", "accent": "#2dd4bf", "badge_bg": "#1e3a3a"},
    "done": {"en": "DONE!", "id": "SELESAI!", "accent": "#fde047", "badge_bg": "#3a2d10"},
}

DETAIL_EXACT_ID = {
    "Standing by": "Standby",
    "Ready to help!": "Siap bantu!",
    "Thinking...": "Lagi mikir...",
    "Writing code...": "Lagi ngoding...",
    "Reading code...": "Lagi baca kode...",
    "Running command...": "Jalanin perintah...",
    "Searching web...": "Lagi nyari...",
    "Coordinating agents...": "Koordinasi agen...",
    "Analyzing error...": "Analisa error...",
    "Reviewing result...": "Cek hasil...",
    "Wrapping up...": "Merapikan...",
    "Task complete!": "Tugas selesai!",
    "Stopped (error)": "Berhenti (error)",
    "Paused by user": "Dijeda user",
    "Working...": "Lagi kerja...",
}

DETAIL_PREFIX_ID = (
    ("Coding ", "Ngoding "),
    ("Reading ", "Baca "),
    ("Running ", "Jalanin "),
    ("Searching ", "Cari "),
    ("Exploring ", "Telusuri "),
    ("Delegating: ", "Delegasi: "),
    ("Using ", "Pakai "),
)

UI_STRINGS = {
    "en": {
        "character": "Character",
        "char_cat": "Cat",
        "char_bot": "Bot",
        "char_dev": "Dev",
        "char_kyubi": "Kyubi",
        "char_jokowi": "Father of Fufufafa",
        "char_prabowo": "El Gemoy",
        "char_trump": "Mr. Tariff",
        "char_putin": "Mr. Long Table",
        "char_kim": "Rocket Man",
        "char_fufufafa": "Fufufafa",
        "trainer": "Caretaker / Whipper",
        "trainer_boss": "Boss",
        "trainer_girl": "Girl",
        "trainer_sensei": "Sensei",
        "trainer_naruto": "Naruto",
        "trainer_jokowi": "Father of Fufufafa",
        "trainer_prabowo": "El Gemoy",
        "trainer_trump": "Mr. Tariff",
        "trainer_putin": "Mr. Long Table",
        "trainer_kim": "Rocket Man",
        "trainer_fufufafa": "Fufufafa",
        "movement": "Movement",
        "mode_random": "Random Move",
        "mode_sticky": "Sticky (Stay Here)",
        "mode_hidden": "Hide (Disable)",
        "bubble": "Status Bubble",
        "bubble_auto": "Auto (Active & Hover)",
        "bubble_always": "Always Show",
        "bubble_off": "Hidden",
        "size": "Size",
        "language": "Language",
        "lang_en": "English",
        "lang_id": "Bahasa Indonesia",
        "prompt_reaction": "Reaction (Pet / Whip)",
        "trigger_hook": "Every Hook Change",
        "trigger_prompt": "New Prompt Only",
        "trigger_off": "Disabled (Off)",
        "test_reaction": "Test Reaction Animation",
    },
    "id": {
        "character": "Karakter",
        "char_cat": "Kucing (Cat)",
        "char_bot": "Robot (Bot)",
        "char_dev": "Dev",
        "char_kyubi": "Kyubi",
        "char_jokowi": "Bapak Fufufafa",
        "char_prabowo": "El Gemoy",
        "char_trump": "Mr. Tariff",
        "char_putin": "Bos Meja Panjang",
        "char_kim": "Rocket Man",
        "char_fufufafa": "Fufufafa",
        "trainer": "Pengasuh / Pencambuk",
        "trainer_boss": "Bos (Boss)",
        "trainer_girl": "Cewek (Girl)",
        "trainer_sensei": "Sensei",
        "trainer_naruto": "Naruto",
        "trainer_jokowi": "Bapak Fufufafa",
        "trainer_prabowo": "El Gemoy",
        "trainer_trump": "Mr. Tariff",
        "trainer_putin": "Bos Meja Panjang",
        "trainer_kim": "Rocket Man",
        "trainer_fufufafa": "Fufufafa",
        "movement": "Mode Gerak",
        "mode_random": "Gerak Acak (Random)",
        "mode_sticky": "Sticky (Diam di Sini)",
        "mode_hidden": "Sembunyikan (Nonaktif)",
        "bubble": "Balon Status",
        "bubble_auto": "Otomatis (Aktif & Hover)",
        "bubble_always": "Selalu Tampil",
        "bubble_off": "Sembunyikan",
        "size": "Ukuran",
        "language": "Bahasa",
        "lang_en": "English",
        "lang_id": "Bahasa Indonesia",
        "prompt_reaction": "Reaksi (Elus / Cambuk)",
        "trigger_hook": "Tiap Ganti Hook",
        "trigger_prompt": "Prompt Baru Saja",
        "trigger_off": "Nonaktif (Off)",
        "test_reaction": "Tes Animasi Reaksi",
    },
}


def localize_detail(detail: str, lang: str) -> str:
    """Translate standard buddy detail strings when Indonesian is selected."""
    if lang != "id" or not detail:
        return detail
    if detail in DETAIL_EXACT_ID:
        return DETAIL_EXACT_ID[detail]
    for src, dst in DETAIL_PREFIX_ID:
        if detail.startswith(src):
            return dst + detail[len(src):]
    return detail


def resolve_effective_state(
    raw_state: Optional[Dict[str, Any]],
    now_ms: Optional[int] = None,
    idle_timeout_ms: int = 120_000,
    done_duration_ms: int = 5_000,
) -> Dict[str, Any]:
    """Mirror src/stateMapper.js resolveEffectiveState for exact state parity."""
    if now_ms is None:
        now_ms = int(time.time() * 1000)

    if not isinstance(raw_state, dict):
        return {"state": "idle", "detail": "Standing by", "tool": "", "updatedAt": 0}

    updated_at = raw_state.get("updatedAt")
    updated_ms = int(updated_at) if isinstance(updated_at, (int, float)) else 0
    age = max(0, now_ms - updated_ms)
    state = raw_state.get("state") if isinstance(raw_state.get("state"), str) else "idle"

    if state == "done" and age >= done_duration_ms:
        return {**raw_state, "state": "idle", "detail": "Standing by"}

    if state not in ("idle", "done") and updated_ms > 0 and age >= idle_timeout_ms:
        return {**raw_state, "state": "idle", "detail": "Standing by"}

    detail = raw_state.get("detail")
    return {
        **raw_state,
        "state": state if state in STATE_META else "idle",
        "detail": detail if isinstance(detail, str) else "",
    }


def load_json_safe(file_path: Path) -> Optional[Dict[str, Any]]:
    """Read and parse a JSON file safely, returning None on missing or corrupt data."""
    try:
        if not file_path.exists():
            return None
        text = file_path.read_text(encoding="utf-8").strip()
        if not text:
            return None
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def save_json_atomic(file_path: Path, data: Dict[str, Any]) -> None:
    """Atomically write JSON data to disk."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, indent=2)
    tmp_path = file_path.with_name(f".{file_path.name}.{os.getpid()}.tmp")
    tmp_path.write_text(payload, encoding="utf-8")
    try:
        os.replace(tmp_path, file_path)
    except PermissionError:
        file_path.write_text(payload, encoding="utf-8")
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass


def normalize_move_mode(raw_mode: Any, fallback: str = "random") -> str:
    """Normalize moveMode, mapping legacy values (fly/hover/perch) to random/sticky/hidden."""
    if raw_mode in ALL_MODES:
        return str(raw_mode)
    if raw_mode == "fly":
        return "random"
    if raw_mode in ("hover", "perch"):
        return "sticky"
    return fallback if fallback in ALL_MODES else "random"


def normalize_config(
    raw: Optional[Dict[str, Any]],
    fallback_char: str = "cat",
    fallback_mode: str = "random",
    fallback_lang: str = "id",
    fallback_reaction: bool = True,
    fallback_trigger: str = "hook",
    fallback_trainer: str = "boss",
) -> Dict[str, Any]:
    """Normalize persisted floating buddy preferences with safe defaults."""
    data = raw if isinstance(raw, dict) else {}
    char = data.get("character") if data.get("character") in VALID_CHARS else fallback_char
    if char not in VALID_CHARS:
        char = "cat"

    trainer = data.get("trainer") if data.get("trainer") in VALID_TRAINERS else fallback_trainer
    if trainer not in VALID_TRAINERS:
        trainer = "boss"

    mode = normalize_move_mode(data.get("moveMode"), fallback_mode)
    bubble = data.get("bubbleMode") if data.get("bubbleMode") in VALID_BUBBLE_MODES else "auto"
    lang = data.get("language") if data.get("language") in VALID_LANGS else fallback_lang
    if lang not in VALID_LANGS:
        lang = "id"

    prompt_reaction = data.get("promptReaction")
    if not isinstance(prompt_reaction, bool):
        prompt_reaction = bool(fallback_reaction)

    trigger = data.get("reactionTrigger")
    if trigger not in VALID_REACTION_TRIGGERS:
        trigger = fallback_trigger if fallback_trigger in VALID_REACTION_TRIGGERS else "hook"

    scale = data.get("scale")
    if not isinstance(scale, int) or scale not in (2, 3, 4):
        scale = 3

    pos = data.get("position")
    position = None
    if (
        isinstance(pos, dict)
        and isinstance(pos.get("x"), (int, float))
        and isinstance(pos.get("y"), (int, float))
    ):
        position = {"x": int(pos["x"]), "y": int(pos["y"])}

    rel = data.get("relPosition")
    rel_position = None
    if (
        isinstance(rel, dict)
        and isinstance(rel.get("rx"), (int, float))
        and isinstance(rel.get("ry"), (int, float))
    ):
        rel_position = {"rx": int(rel["rx"]), "ry": int(rel["ry"])}

    return {
        "character": char,
        "trainer": trainer,
        "moveMode": mode,
        "bubbleMode": bubble,
        "language": lang,
        "promptReaction": prompt_reaction,
        "reactionTrigger": trigger,
        "scale": scale,
        "position": position,
        "relPosition": rel_position,
    }


def is_ide_window_class(wm_class_raw: bytes) -> bool:
    """Return True when X11 WM_CLASS belongs to Antigravity IDE."""
    if not wm_class_raw:
        return False
    text = wm_class_raw.decode("utf-8", errors="ignore").lower()
    return "antigravity" in text


def extract_title_candidates(ide_title: str) -> list:
    """Extract workspace name candidates from an Antigravity IDE window title."""
    if not ide_title or not isinstance(ide_title, str):
        return []
    parts = [p.strip() for p in ide_title.split(" - ") if p.strip()]
    candidates = []
    for part in parts:
        if "antigravity" in part.lower():
            continue
        candidates.append(part)
        if "," in part:
            for sub in part.split(","):
                cleaned = sub.strip()
                if cleaned:
                    candidates.append(cleaned)
    return candidates


def select_state_for_ide_title(
    workspaces_store: Optional[Dict[str, Any]],
    ide_title: str,
    fallback_raw: Optional[Dict[str, Any]] = None,
) -> Tuple[Optional[Dict[str, Any]], str]:
    """Match focused IDE window title to its per-workspace state entry."""
    if not isinstance(workspaces_store, dict) or not isinstance(workspaces_store.get("workspaces"), dict):
        return fallback_raw, "__fallback__"

    ws_map: Dict[str, Any] = workspaces_store["workspaces"]
    candidates = extract_title_candidates(ide_title)

    if not candidates:
        if ide_title and "antigravity" in ide_title.lower():
            return ws_map.get("__global__"), "__global__"
        return fallback_raw, "__fallback__"

    best_entry = None
    best_key = ""
    best_ts = -1
    for ws_key, entry in ws_map.items():
        if ws_key == "__global__" or not isinstance(entry, dict):
            continue
        ws_name = entry.get("workspaceName") or ws_key.replace("\\", "/").rstrip("/").rsplit("/", 1)[-1]
        if ws_name and ws_name in candidates:
            ts = int(entry.get("updatedAt") or 0)
            if ts > best_ts:
                best_ts = ts
                best_entry = entry
                best_key = ws_key

    if best_entry is not None:
        return best_entry, best_key

    # Focused IDE window has a workspace title that hasn't logged any hooks yet -> idle
    return None, f"title:{'|'.join(candidates)}"


class X11IdeTracker:
    """Tracks the active X11 window via libX11 to detect Antigravity IDE focus & bounds."""

    class _XWindowAttributes(ctypes.Structure):
        _fields_ = [
            ("x", ctypes.c_int), ("y", ctypes.c_int),
            ("width", ctypes.c_int), ("height", ctypes.c_int),
            ("border_width", ctypes.c_int), ("depth", ctypes.c_int),
            ("visual", ctypes.c_void_p), ("root", ctypes.c_ulong),
            ("c_class", ctypes.c_int), ("bit_gravity", ctypes.c_int),
            ("win_gravity", ctypes.c_int), ("backing_store", ctypes.c_int),
            ("backing_planes", ctypes.c_ulong), ("backing_pixel", ctypes.c_ulong),
            ("save_under", ctypes.c_int), ("colormap", ctypes.c_ulong),
            ("map_installed", ctypes.c_int), ("map_state", ctypes.c_int),
            ("all_event_masks", ctypes.c_long), ("your_event_mask", ctypes.c_long),
            ("do_not_propagate_mask", ctypes.c_long), ("override_redirect", ctypes.c_int),
            ("screen", ctypes.c_void_p),
        ]

    def __init__(self, own_pid: int) -> None:
        self.own_pid = own_pid
        self.x11 = None
        self.dpy = None
        self.root = 0
        self._err_cb = None
        self.last_ide_bounds: Optional[Tuple[int, int, int, int]] = None
        self._init_x11()

    def _init_x11(self) -> None:
        try:
            lib = ctypes.cdll.LoadLibrary("libX11.so.6")
            lib.XOpenDisplay.restype = ctypes.c_void_p
            lib.XCloseDisplay.argtypes = [ctypes.c_void_p]
            lib.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
            lib.XDefaultRootWindow.restype = ctypes.c_ulong
            lib.XInternAtom.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
            lib.XInternAtom.restype = ctypes.c_ulong
            lib.XGetWindowProperty.argtypes = [
                ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_long, ctypes.c_long,
                ctypes.c_int, ctypes.c_ulong, ctypes.POINTER(ctypes.c_ulong),
                ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_ulong),
                ctypes.POINTER(ctypes.c_ulong), ctypes.POINTER(ctypes.c_void_p),
            ]
            lib.XGetWindowProperty.restype = ctypes.c_int
            lib.XFree.argtypes = [ctypes.c_void_p]
            lib.XGetWindowAttributes.argtypes = [
                ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(self._XWindowAttributes)
            ]
            lib.XGetWindowAttributes.restype = ctypes.c_int
            lib.XTranslateCoordinates.argtypes = [
                ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_int, ctypes.c_int,
                ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_ulong),
            ]
            lib.XTranslateCoordinates.restype = ctypes.c_int

            err_type = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p)
            self._err_cb = err_type(lambda _d, _e: 0)
            lib.XSetErrorHandler.argtypes = [err_type]
            lib.XSetErrorHandler(self._err_cb)

            dpy = lib.XOpenDisplay(None)
            if not dpy:
                return
            self.x11 = lib
            self.dpy = dpy
            self.root = lib.XDefaultRootWindow(dpy)
            self.atom_active = lib.XInternAtom(dpy, b"_NET_ACTIVE_WINDOW", 0)
            self.atom_wm_class = lib.XInternAtom(dpy, b"WM_CLASS", 0)
            self.atom_wm_pid = lib.XInternAtom(dpy, b"_NET_WM_PID", 0)
            self.atom_net_wm_name = lib.XInternAtom(dpy, b"_NET_WM_NAME", 0)
            self.atom_wm_name = lib.XInternAtom(dpy, b"WM_NAME", 0)
            self.last_ide_title: str = ""
        except Exception:
            self.x11 = None
            self.dpy = None

    def _get_prop(self, win_id: int, atom: int, long_len: int) -> Optional[bytes]:
        if not self.x11 or not self.dpy or not win_id:
            return None
        actual_type = ctypes.c_ulong()
        actual_fmt = ctypes.c_int()
        nitems = ctypes.c_ulong()
        bytes_after = ctypes.c_ulong()
        prop = ctypes.c_void_p()
        rc = self.x11.XGetWindowProperty(
            self.dpy, win_id, atom, 0, long_len, 0, 0,
            ctypes.byref(actual_type), ctypes.byref(actual_fmt),
            ctypes.byref(nitems), ctypes.byref(bytes_after), ctypes.byref(prop),
        )
        if rc != 0 or not prop.value:
            if prop.value:
                self.x11.XFree(prop)
            return None
        try:
            item_size = max(1, actual_fmt.value // 8)
            if actual_fmt.value == 32:
                item_size = ctypes.sizeof(ctypes.c_ulong)
            return ctypes.string_at(prop.value, nitems.value * item_size)
        finally:
            self.x11.XFree(prop)

    def poll(self) -> Tuple[bool, Optional[Tuple[int, int, int, int]], str]:
        """Return (is_ide_focused, ide_bounds_or_last, ide_window_title) safely."""
        if not self.x11 or not self.dpy:
            return True, self.last_ide_bounds, self.last_ide_title
        try:
            raw_active = self._get_prop(self.root, self.atom_active, 2)
            if not raw_active or len(raw_active) < ctypes.sizeof(ctypes.c_ulong):
                return False, self.last_ide_bounds, self.last_ide_title
            win_id = ctypes.c_ulong.from_buffer_copy(raw_active[:ctypes.sizeof(ctypes.c_ulong)]).value
            if not win_id:
                return False, self.last_ide_bounds, self.last_ide_title

            raw_pid = self._get_prop(win_id, self.atom_wm_pid, 2)
            if raw_pid and len(raw_pid) >= 4:
                win_pid = int.from_bytes(raw_pid[:4], sys.byteorder, signed=False)
                if win_pid == self.own_pid:
                    return True, self.last_ide_bounds, self.last_ide_title

            wm_class = self._get_prop(win_id, self.atom_wm_class, 256) or b""
            if not is_ide_window_class(wm_class):
                return False, self.last_ide_bounds, self.last_ide_title

            raw_title = self._get_prop(win_id, self.atom_net_wm_name, 512)
            if not raw_title:
                raw_title = self._get_prop(win_id, self.atom_wm_name, 512)
            if raw_title:
                self.last_ide_title = raw_title.decode("utf-8", errors="ignore").rstrip("\x00").strip()

            attrs = self._XWindowAttributes()
            if self.x11.XGetWindowAttributes(self.dpy, win_id, ctypes.byref(attrs)) == 0:
                return True, self.last_ide_bounds, self.last_ide_title
            abs_x, abs_y = ctypes.c_int(), ctypes.c_int()
            child = ctypes.c_ulong()
            if self.x11.XTranslateCoordinates(
                self.dpy, win_id, self.root, 0, 0, ctypes.byref(abs_x), ctypes.byref(abs_y), ctypes.byref(child)
            ) == 0:
                return True, self.last_ide_bounds, self.last_ide_title

            if attrs.width > 120 and attrs.height > 120:
                self.last_ide_bounds = (abs_x.value, abs_y.value, attrs.width, attrs.height)
            return True, self.last_ide_bounds, self.last_ide_title
        except Exception:
            return True, self.last_ide_bounds, self.last_ide_title

    def close(self) -> None:
        if self.x11 and self.dpy:
            try:
                self.x11.XCloseDisplay(self.dpy)
            except Exception:
                pass
            self.dpy = None


def is_win32_ide_window(exe_path: str, class_name: str, title: str) -> bool:
    """Return True when a foreground Win32 window belongs to Antigravity IDE."""
    exe_low = (exe_path or "").lower()
    if exe_low:
        return "antigravity" in exe_low
    cls_low = (class_name or "").lower()
    title_low = (title or "").lower()
    return cls_low == "chrome_widgetwin_1" and "antigravity" in title_low


class Win32IdeTracker:
    """Tracks the active Win32 window via user32/kernel32 to detect Antigravity IDE focus & bounds."""

    def __init__(self, own_pid: int) -> None:
        self.own_pid = own_pid
        self.user32 = None
        self.kernel32 = None
        self.wintypes = None
        self.last_ide_bounds: Optional[Tuple[int, int, int, int]] = None
        self.last_ide_title: str = ""
        self._init_win32()

    def _init_win32(self) -> None:
        if sys.platform != "win32":
            return
        try:
            from ctypes import wintypes

            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32

            user32.GetForegroundWindow.restype = wintypes.HWND
            user32.IsIconic.argtypes = [wintypes.HWND]
            user32.IsIconic.restype = wintypes.BOOL
            user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
            user32.GetWindowThreadProcessId.restype = wintypes.DWORD
            user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
            user32.GetWindowTextLengthW.restype = ctypes.c_int
            user32.GetWindowTextW.argtypes = [wintypes.HWND, ctypes.c_wchar_p, ctypes.c_int]
            user32.GetWindowTextW.restype = ctypes.c_int
            user32.GetClassNameW.argtypes = [wintypes.HWND, ctypes.c_wchar_p, ctypes.c_int]
            user32.GetClassNameW.restype = ctypes.c_int
            user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
            user32.GetWindowRect.restype = wintypes.BOOL

            kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
            kernel32.OpenProcess.restype = wintypes.HANDLE
            kernel32.QueryFullProcessImageNameW.argtypes = [
                wintypes.HANDLE, wintypes.DWORD, ctypes.c_wchar_p, ctypes.POINTER(wintypes.DWORD)
            ]
            kernel32.QueryFullProcessImageNameW.restype = wintypes.BOOL
            kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
            kernel32.CloseHandle.restype = wintypes.BOOL

            self.user32 = user32
            self.kernel32 = kernel32
            self.wintypes = wintypes
        except Exception:
            self.user32 = None
            self.kernel32 = None

    def _get_exe_path(self, pid: int) -> str:
        if not self.kernel32 or not self.wintypes or not pid:
            return ""
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        handle = self.kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if not handle:
            return ""
        try:
            size = self.wintypes.DWORD(512)
            buf = ctypes.create_unicode_buffer(size.value)
            if self.kernel32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(size)):
                return buf.value
            return ""
        finally:
            self.kernel32.CloseHandle(handle)

    def poll(self) -> Tuple[bool, Optional[Tuple[int, int, int, int]], str]:
        """Return (is_ide_focused, ide_bounds_or_last, ide_window_title) safely."""
        if not self.user32 or not self.wintypes:
            return True, self.last_ide_bounds, self.last_ide_title
        try:
            hwnd = self.user32.GetForegroundWindow()
            if not hwnd or self.user32.IsIconic(hwnd):
                return False, self.last_ide_bounds, self.last_ide_title

            pid = self.wintypes.DWORD()
            self.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
            if pid.value == self.own_pid:
                return True, self.last_ide_bounds, self.last_ide_title

            title_len = self.user32.GetWindowTextLengthW(hwnd)
            title = ""
            if title_len > 0:
                title_buf = ctypes.create_unicode_buffer(title_len + 1)
                self.user32.GetWindowTextW(hwnd, title_buf, title_len + 1)
                title = title_buf.value.strip()

            cls_buf = ctypes.create_unicode_buffer(128)
            self.user32.GetClassNameW(hwnd, cls_buf, 128)
            exe_path = self._get_exe_path(pid.value)

            if not is_win32_ide_window(exe_path, cls_buf.value, title):
                return False, self.last_ide_bounds, self.last_ide_title

            if title:
                self.last_ide_title = title

            rect = self.wintypes.RECT()
            if self.user32.GetWindowRect(hwnd, ctypes.byref(rect)):
                w = rect.right - rect.left
                h = rect.bottom - rect.top
                if w > 120 and h > 120:
                    self.last_ide_bounds = (rect.left, rect.top, w, h)
            return True, self.last_ide_bounds, self.last_ide_title
        except Exception:
            return True, self.last_ide_bounds, self.last_ide_title

    def close(self) -> None:
        self.user32 = None
        self.kernel32 = None


def create_ide_tracker(own_pid: int) -> Any:
    """Create the platform-appropriate IDE window focus/bounds tracker."""
    if sys.platform == "win32":
        return Win32IdeTracker(own_pid)
    return X11IdeTracker(own_pid)


def should_trigger_prompt_reaction(
    prev_raw: Optional[Dict[str, Any]],
    new_raw: Optional[Dict[str, Any]],
    prev_effective_state: str,
    last_prompt_ts: int,
    now_ms: int,
    enabled: bool = True,
    trigger_mode: str = "hook",
) -> bool:
    """Return True when reaction should play ('hook' = every fresh hook change, 'prompt' = new prompt only)."""
    if not enabled or not isinstance(new_raw, dict):
        return False
    updated_at = new_raw.get("updatedAt")
    if not isinstance(updated_at, (int, float)):
        return False
    updated_ms = int(updated_at)
    if updated_ms <= 0 or updated_ms == last_prompt_ts:
        return False
    if (now_ms - updated_ms) > 10_000:
        return False

    if trigger_mode == "hook":
        return True

    if new_raw.get("event") != "PreInvocation":
        return False
    prev_event = prev_raw.get("event") if isinstance(prev_raw, dict) else None
    return prev_event in (None, "Stop", "SessionStart") or prev_effective_state in ("idle", "done")


def should_trigger_click_reaction(
    effective_state: Optional[Dict[str, Any]],
    drag_moved: bool,
) -> bool:
    """Trigger pet/whip reaction when user left-clicks (without dragging) an idle buddy."""
    if drag_moved or not isinstance(effective_state, dict):
        return False
    return effective_state.get("state") == "idle"


def step_flight_position(
    x: float,
    y: float,
    vx: float,
    vy: float,
    bounds: Tuple[int, int, int, int],
    win_w: int,
    win_h: int,
    dt: float,
    speed_factor: float = 1.0,
) -> Tuple[float, float, float, float]:
    """Advance floating buddy position inside screen bounds with gentle edge bouncing."""
    bx, by, bw, bh = bounds
    margin = 16
    min_x = bx + margin
    min_y = by + margin
    max_x = max(min_x, bx + bw - win_w - margin)
    max_y = max(min_y, by + bh - win_h - margin)

    nx = x + vx * dt * speed_factor
    ny = y + vy * dt * speed_factor
    nvx, nvy = vx, vy

    if nx <= min_x:
        nx = float(min_x)
        nvx = abs(vx)
    elif nx >= max_x:
        nx = float(max_x)
        nvx = -abs(vx)

    if ny <= min_y:
        ny = float(min_y)
        nvy = abs(vy)
    elif ny >= max_y:
        ny = float(max_y)
        nvy = -abs(vy)

    return nx, ny, nvx, nvy


def run_gui(args: argparse.Namespace) -> int:
    """Start the PyQt5 transparent overlay window."""
    from PyQt5.QtCore import QPoint, QRect, Qt, QTimer
    from PyQt5.QtGui import QColor, QFont, QFontMetrics, QPainter, QRegion
    from PyQt5.QtWidgets import QAction, QApplication, QMenu, QWidget

    class FloatingBuddyWindow(QWidget):
        """Frameless, always-on-top, click-through-outside floating pixel buddy."""

        def __init__(self) -> None:
            super().__init__()
            self.state_path = Path(args.state_file)
            self.workspaces_path = Path(args.workspaces_file)
            self.config_path = Path(args.config_file)
            self.idle_timeout_ms = max(10_000, int(args.idle_timeout))

            loaded = load_json_safe(self.config_path)
            self.config = normalize_config(
                loaded,
                fallback_char=args.character,
                fallback_mode=args.mode,
                fallback_lang=args.language,
                fallback_reaction=args.prompt_reaction,
                fallback_trigger=args.reaction_trigger,
                fallback_trainer=args.trainer,
            )
            if self.config["moveMode"] == "hidden":
                self.config["moveMode"] = normalize_move_mode(args.mode, "random")

            self.raw_state: Optional[Dict[str, Any]] = None
            self.fallback_raw_state: Optional[Dict[str, Any]] = None
            self.workspaces_store: Optional[Dict[str, Any]] = None
            self.effective_state: Dict[str, Any] = resolve_effective_state(None)
            self.last_state_mtime: int = -1
            self.last_workspaces_mtime: int = -1
            self.last_config_mtime: int = -1
            self.last_active_change_ts: float = time.monotonic()
            self.last_prompt_ts: int = 0
            self.reaction_ticks_left: int = 0
            self.last_test_nonce: Any = loaded.get("testReactionNonce") if isinstance(loaded, dict) else None
            self.current_workspace_key: Optional[str] = None
            self.ide_title: str = ""

            self.tick: int = 0
            self.hovered: bool = False
            self.dragging: bool = False
            self.drag_moved: bool = False
            self.menu_open: bool = False
            self.drag_offset = QPoint(0, 0)
            self.press_global_pos = QPoint(0, 0)
            self.ide_tracker = create_ide_tracker(os.getpid())
            self.ide_focused: bool = True
            self.ide_bounds: Optional[Tuple[int, int, int, int]] = None
            self.unfocused_polls: int = 0
            self.drag_grace_until: float = 0.0

            self.pos_x: float = 0.0
            self.pos_y: float = 0.0
            self.vx: float = 52.0
            self.vy: float = 24.0
            self.facing_right: bool = True
            self.last_step_ts: float = time.monotonic()
            self.next_steer_ts: float = time.monotonic() + 4.0

            self.setWindowTitle("Agy Pixel Buddy")
            self.setWindowFlags(
                Qt.FramelessWindowHint
                | Qt.WindowStaysOnTopHint
                | Qt.Tool
                | Qt.WindowDoesNotAcceptFocus
            )
            self.setAttribute(Qt.WA_TranslucentBackground, True)
            self.setAttribute(Qt.WA_ShowWithoutActivating, True)
            self.setMouseTracking(True)

            self._apply_window_size()
            self._sync_ide_window(initial=True)
            self._init_position()
            self._poll_files(force=True)

            self.anim_timer = QTimer(self)
            self.anim_timer.timeout.connect(self._on_frame)
            self.anim_timer.start(80)

            self.poll_timer = QTimer(self)
            self.poll_timer.timeout.connect(self._on_poll_tick)
            self.poll_timer.start(200)

        def _lang(self) -> str:
            lang = self.config.get("language", "id")
            return lang if lang in VALID_LANGS else "id"

        def _tr(self, key: str) -> str:
            return UI_STRINGS[self._lang()].get(key, key)

        def _scale(self) -> int:
            return int(self.config.get("scale", 3))

        def _sprite_area_size(self) -> Tuple[int, int]:
            s = self._scale()
            return 38 * s, 28 * s

        def _bubble_height(self) -> int:
            return 34

        def _apply_window_size(self) -> None:
            sw, sh = self._sprite_area_size()
            s = self._scale()
            win_w = max(sw + 34 * s, 260)
            win_h = sh + self._bubble_height() + 10
            self.resize(win_w, win_h)

        def _screen_bounds(self) -> Tuple[int, int, int, int]:
            if self.ide_bounds is not None:
                return self.ide_bounds
            screen = QApplication.primaryScreen()
            if screen is None:
                return 0, 0, 1280, 720
            geo = screen.availableGeometry()
            return geo.x(), geo.y(), geo.width(), geo.height()

        def _clamp_position(self, x: float, y: float) -> Tuple[float, float]:
            bx, by, bw, bh = self._screen_bounds()
            cx = max(float(bx), min(float(x), float(bx + bw - self.width())))
            cy = max(float(by), min(float(y), float(by + bh - self.height())))
            return cx, cy

        def _init_position(self) -> None:
            bx, by, bw, bh = self._screen_bounds()
            rel = self.config.get("relPosition")
            saved = self.config.get("position")
            if self.config.get("moveMode") == "sticky" and rel is not None and self.ide_bounds is not None:
                self.pos_x, self.pos_y = self._clamp_position(bx + rel["rx"], by + rel["ry"])
            elif saved is not None:
                self.pos_x, self.pos_y = self._clamp_position(saved["x"], saved["y"])
            else:
                self.pos_x = float(bx + bw - self.width() - 36)
                self.pos_y = float(by + bh - self.height() - 44)
            self.move(int(round(self.pos_x)), int(round(self.pos_y)))

        def _save_config(self) -> None:
            bx, by, _bw, _bh = self._screen_bounds()
            self.config["position"] = {
                "x": int(round(self.pos_x)),
                "y": int(round(self.pos_y)),
            }
            self.config["relPosition"] = {
                "rx": int(round(self.pos_x - bx)),
                "ry": int(round(self.pos_y - by)),
            }
            try:
                save_json_atomic(self.config_path, self.config)
                self.last_config_mtime = self.config_path.stat().st_mtime_ns
            except Exception:
                pass

        def _sync_ide_window(self, initial: bool = False) -> None:
            if self.dragging or self.menu_open or QApplication.activePopupWidget() is not None:
                return
            if not initial and time.monotonic() < self.drag_grace_until:
                return
            focused, bounds, title = self.ide_tracker.poll()
            bounds_changed = bounds is not None and bounds != self.ide_bounds
            if bounds is not None:
                self.ide_bounds = bounds
            if title:
                self.ide_title = title

            if focused:
                self.unfocused_polls = 0
                if not initial and not self.isVisible():
                    self.show()
                    self.raise_()
            else:
                self.unfocused_polls += 1
                if not initial and self.isVisible() and self.unfocused_polls >= 2:
                    self.hide()

            self.ide_focused = focused
            if bounds_changed and self.ide_bounds is not None and not self.dragging:
                bx, by, _bw, _bh = self.ide_bounds
                if self.config.get("moveMode") == "sticky" and self.config.get("relPosition") is not None:
                    rel = self.config["relPosition"]
                    self.pos_x, self.pos_y = self._clamp_position(bx + rel["rx"], by + rel["ry"])
                else:
                    self.pos_x, self.pos_y = self._clamp_position(self.pos_x, self.pos_y)
                self.move(int(round(self.pos_x)), int(round(self.pos_y)))

        def _on_poll_tick(self) -> None:
            self._sync_ide_window()
            self._poll_files()

        def _poll_files(self, force: bool = False) -> None:
            try:
                if self.config_path.exists():
                    cfg_mtime = self.config_path.stat().st_mtime_ns
                    if force or cfg_mtime != self.last_config_mtime:
                        self.last_config_mtime = cfg_mtime
                        loaded_cfg = load_json_safe(self.config_path)
                        if loaded_cfg:
                            prev_scale = self._scale()
                            merged = normalize_config(
                                loaded_cfg,
                                fallback_char=self.config["character"],
                                fallback_mode=self.config["moveMode"],
                                fallback_lang=self._lang(),
                                fallback_reaction=self.config.get("promptReaction", True),
                                fallback_trigger=self.config.get("reactionTrigger", "hook"),
                                fallback_trainer=self.config.get("trainer", "boss"),
                            )
                            if merged["moveMode"] == "hidden":
                                QApplication.quit()
                                return
                            # Keep live dragged position unless config updated position explicitly in sticky mode
                            if merged["moveMode"] != "sticky" or merged["position"] is None:
                                merged["position"] = self.config.get("position")
                            self.config = merged
                            nonce = loaded_cfg.get("testReactionNonce")
                            if nonce is not None and nonce != self.last_test_nonce:
                                self.last_test_nonce = nonce
                                self.reaction_ticks_left = 26
                            if merged["scale"] != prev_scale:
                                self._apply_window_size()
                            if merged["moveMode"] == "sticky":
                                self.facing_right = True
            except Exception:
                pass

            prev_raw = self.raw_state
            try:
                if self.state_path.exists():
                    st_mtime = self.state_path.stat().st_mtime_ns
                    if force or st_mtime != self.last_state_mtime:
                        self.last_state_mtime = st_mtime
                        self.fallback_raw_state = load_json_safe(self.state_path)
                else:
                    self.fallback_raw_state = None
            except Exception:
                pass

            try:
                if self.workspaces_path.exists():
                    ws_mtime = self.workspaces_path.stat().st_mtime_ns
                    if force or ws_mtime != self.last_workspaces_mtime:
                        self.last_workspaces_mtime = ws_mtime
                        self.workspaces_store = load_json_safe(self.workspaces_path)
                else:
                    self.workspaces_store = None
            except Exception:
                pass

            self.raw_state, ws_key = select_state_for_ide_title(
                self.workspaces_store, self.ide_title, self.fallback_raw_state
            )
            switched_workspace = self.current_workspace_key is not None and ws_key != self.current_workspace_key
            self.current_workspace_key = ws_key

            now_ms = int(time.time() * 1000)
            prev_state = self.effective_state.get("state")
            prev_detail = self.effective_state.get("detail")
            trigger_mode = self.config.get("reactionTrigger", "hook")
            if switched_workspace:
                # Do not trigger whip/pet animation merely from Alt+Tabbing between IDE windows
                self.last_prompt_ts = int((self.raw_state or {}).get("updatedAt") or 0)
            elif not force and should_trigger_prompt_reaction(
                prev_raw,
                self.raw_state,
                str(prev_state or "idle"),
                self.last_prompt_ts,
                now_ms,
                enabled=bool(self.config.get("promptReaction", True)),
                trigger_mode=trigger_mode,
            ):
                self.last_prompt_ts = int(self.raw_state.get("updatedAt", 0))
                self.reaction_ticks_left = 16 if trigger_mode == "hook" else 26

            self.effective_state = resolve_effective_state(
                self.raw_state,
                now_ms=now_ms,
                idle_timeout_ms=self.idle_timeout_ms,
            )
            if (
                self.effective_state.get("state") != prev_state
                or self.effective_state.get("detail") != prev_detail
            ):
                self.last_active_change_ts = time.monotonic()

        def _should_show_bubble(self) -> bool:
            mode = self.config.get("bubbleMode", "auto")
            if mode == "always":
                return True
            if mode == "off":
                return False
            if self.hovered:
                return True
            st = self.effective_state.get("state", "idle")
            if st != "idle":
                return True
            return (time.monotonic() - self.last_active_change_ts) < 2.5

        def _on_frame(self) -> None:
            if not self.isVisible():
                self.last_step_ts = time.monotonic()
                return
            now = time.monotonic()
            dt = min(0.2, max(0.01, now - self.last_step_ts))
            self.last_step_ts = now
            self.tick = (self.tick + 1) % 100_000
            if self.reaction_ticks_left > 0:
                self.reaction_ticks_left -= 1

            mode = self.config.get("moveMode", "random")
            if not self.dragging and mode == "random":
                if now >= self.next_steer_ts:
                    self.next_steer_ts = now + random.uniform(3.0, 6.5)
                    angle = random.uniform(0, 2 * math.pi)
                    speed = random.uniform(42.0, 74.0)
                    self.vx = math.cos(angle) * speed
                    self.vy = math.sin(angle) * speed * 0.55

                st = self.effective_state.get("state", "idle")
                speed_factor = 0.55 if st in ("coding", "reading", "thinking") else 1.0
                if self.hovered:
                    speed_factor = 0.0

                self.pos_x, self.pos_y, self.vx, self.vy = step_flight_position(
                    self.pos_x,
                    self.pos_y,
                    self.vx,
                    self.vy,
                    self._screen_bounds(),
                    self.width(),
                    self.height(),
                    dt,
                    speed_factor=speed_factor,
                )
                if abs(self.vx) > 2.0:
                    self.facing_right = self.vx >= 0

                self.move(int(round(self.pos_x)), int(round(self.pos_y)))

            self._update_click_mask()
            self.update()

        def _sprite_origin(self) -> Tuple[int, int]:
            sw, _ = self._sprite_area_size()
            x0 = (self.width() - sw) // 2
            y0 = self._bubble_height() + 6
            return x0, y0

        def _bubble_parts(self) -> Tuple[str, str]:
            st = self.effective_state.get("state", "idle")
            meta = STATE_META.get(st, STATE_META["idle"])
            lang = self._lang()
            label = meta[lang]
            raw_detail = self.effective_state.get("detail") or ""
            detail = localize_detail(raw_detail, lang)
            if detail and detail.lower() == label.lower():
                detail = ""
            return label, detail

        def _bubble_rect(self) -> QRect:
            label, detail = self._bubble_parts()
            badge_font = QFont("Sans", 7, QFont.Bold)
            detail_font = QFont("Sans", 8)
            bfm = QFontMetrics(badge_font)
            dfm = QFontMetrics(detail_font)
            badge_w = bfm.horizontalAdvance(label) + 22
            detail_w = (dfm.horizontalAdvance(detail) + 10) if detail else 0
            total_w = badge_w + detail_w + 14
            bw = max(92, min(self.width() - 4, total_w))
            bx = (self.width() - bw) // 2
            return QRect(bx, 2, bw, 26)

        def _update_click_mask(self) -> None:
            # On Windows, WA_TranslucentBackground uses layered windows (per-pixel alpha hit-testing).
            # Calling setMask() on a layered window conflicts with UpdateLayeredWindow during drag/move.
            if sys.platform == "win32":
                return
            sx, sy = self._sprite_origin()
            sw, sh = self._sprite_area_size()
            s = self._scale()
            if self.reaction_ticks_left > 0:
                extra = 16 * s
                sprite_rect = (
                    QRect(sx, sy, sw + extra, sh)
                    if self.facing_right
                    else QRect(sx - extra, sy, sw + extra, sh)
                )
            else:
                sprite_rect = QRect(sx, sy, sw, sh)
            region = QRegion(sprite_rect)
            if self._should_show_bubble():
                r = self._bubble_rect()
                # Pixel-chamfered card + pointer tail matches _draw_bubble exactly (zero jagged corner clipping)
                card_h = QRect(r.x() + 2, r.y(), r.width() - 4, r.height())
                card_v = QRect(r.x(), r.y() + 2, r.width(), r.height() - 4)
                cx = r.x() + r.width() // 2
                tail_1 = QRect(cx - 3, r.y() + r.height(), 6, 2)
                tail_2 = QRect(cx - 1, r.y() + r.height() + 2, 2, 2)
                region = region.united(QRegion(card_h)).united(QRegion(card_v)).united(QRegion(tail_1)).united(QRegion(tail_2))
            self.setMask(region)

        def paintEvent(self, _event: Any) -> None:
            painter = QPainter(self)
            painter.setRenderHint(QPainter.Antialiasing, False)
            painter.fillRect(self.rect(), QColor(0, 0, 0, 0))

            st = self.effective_state.get("state", "idle")
            accent_hex = STATE_META.get(st, STATE_META["idle"])["accent"]

            if self._should_show_bubble():
                self._draw_bubble(painter, st, accent_hex)

            sx, sy = self._sprite_origin()
            s = self._scale()
            is_sticky = self.config.get("moveMode") == "sticky"
            bob_px = 0 if is_sticky else int(round(math.sin(self.tick * 0.25) * 1.1))

            def px(gx: float, gy: float, gw: float, gh: float, color_hex: str, alpha: int = 255) -> None:
                c = QColor(color_hex)
                c.setAlpha(alpha)
                draw_x = (38 - gx - gw) if not self.facing_right else gx
                painter.fillRect(
                    int(round(sx + draw_x * s)),
                    int(round(sy + (gy + bob_px) * s)),
                    max(1, int(round(gw * s))),
                    max(1, int(round(gh * s))),
                    c,
                )

            # Subtle desk glow shadow under mini station & buddy
            shadow_alpha = 75 if is_sticky else (65 + int(25 * math.sin(self.tick * 0.3)))
            px(2, 25, 30, 2, accent_hex, shadow_alpha)

            self._draw_mini_station(px, st, accent_hex)

            char = self.config.get("character", "cat")
            reacting = self.reaction_ticks_left > 0
            if char == "bot":
                self._draw_bot(px, st, reacting)
            elif char == "dev":
                self._draw_dev(px, st, reacting)
            elif char == "kyubi":
                self._draw_kyubi(px, st, reacting)
            elif char == "jokowi":
                self._draw_jokowi(px, st, reacting)
            elif char == "prabowo":
                self._draw_prabowo(px, st, reacting)
            elif char == "trump":
                self._draw_trump(px, st, reacting)
            elif char == "putin":
                self._draw_putin(px, st, reacting)
            elif char == "kim":
                self._draw_kim(px, st, reacting)
            elif char == "fufufafa":
                self._draw_fufufafa(px, st, reacting)
            else:
                self._draw_cat(px, st, reacting)

            if reacting:
                self._draw_prompt_reaction(px, char)
            else:
                self._draw_particles(px, st, accent_hex)

        def _draw_bubble(self, painter: QPainter, st: str, accent_hex: str) -> None:
            painter.save()
            painter.setRenderHint(QPainter.Antialiasing, False)
            r = self._bubble_rect()
            meta = STATE_META.get(st, STATE_META["idle"])
            label, detail = self._bubble_parts()

            # Pixel-art chamfered dark glass card
            border_c = QColor(accent_hex)
            border_c.setAlpha(210)
            bg_c = QColor("#12151f")
            bg_c.setAlpha(242)

            # Outer border shape
            painter.fillRect(r.x() + 2, r.y(), r.width() - 4, r.height(), border_c)
            painter.fillRect(r.x(), r.y() + 2, r.width(), r.height() - 4, border_c)
            # Inner fill
            painter.fillRect(r.x() + 2, r.y() + 1, r.width() - 4, r.height() - 2, bg_c)
            painter.fillRect(r.x() + 1, r.y() + 2, r.width() - 2, r.height() - 4, bg_c)

            # Pixel speech pointer tail below center
            cx = r.x() + r.width() // 2
            painter.fillRect(cx - 3, r.y() + r.height(), 6, 2, border_c)
            painter.fillRect(cx - 2, r.y() + r.height() - 1, 4, 2, bg_c)
            painter.fillRect(cx - 1, r.y() + r.height() + 2, 2, 2, border_c)

            # State badge pill on left (matching sidebar .badge)
            badge_font = QFont("Sans", 7, QFont.Bold)
            bfm = QFontMetrics(badge_font)
            badge_w = min(r.width() - 12, bfm.horizontalAdvance(label) + 20)
            badge_x = r.x() + 5
            badge_y = r.y() + 4
            badge_h = r.height() - 8
            badge_bg = QColor(meta["badge_bg"])
            painter.fillRect(badge_x + 1, badge_y, badge_w - 2, badge_h, badge_bg)
            painter.fillRect(badge_x, badge_y + 1, badge_w, badge_h - 2, badge_bg)

            # Animated status dot inside badge
            pulse = 1 if (st not in ("idle", "done") and (self.tick % 8 < 4)) else 0
            dot_c = QColor(accent_hex)
            dot_size = 4 + (2 if pulse else 0)
            dot_x = badge_x + 6 - (1 if pulse else 0)
            dot_y = badge_y + (badge_h - dot_size) // 2
            painter.fillRect(dot_x, dot_y, dot_size, dot_size, dot_c)

            painter.setFont(badge_font)
            painter.setPen(dot_c)
            painter.drawText(
                QRect(badge_x + 13, badge_y, badge_w - 15, badge_h),
                Qt.AlignVCenter | Qt.AlignLeft,
                label,
            )

            # Detail text on right
            detail_x = badge_x + badge_w + 6
            avail_w = r.x() + r.width() - 6 - detail_x
            if detail and avail_w > 18:
                detail_font = QFont("Sans", 8)
                dfm = QFontMetrics(detail_font)
                elided = dfm.elidedText(detail, Qt.ElideRight, avail_w)
                painter.setFont(detail_font)
                painter.setPen(QColor("#cbd5e1"))
                painter.drawText(
                    QRect(detail_x, r.y() + 2, avail_w, r.height() - 4),
                    Qt.AlignVCenter | Qt.AlignLeft,
                    elided,
                )
            painter.restore()

        def _draw_mini_station(self, px: Any, st: str, accent_hex: str) -> None:
            # Mini desk monitor on the left (matching sidebar preview monitor & keyboard)
            px(1, 13, 12, 9, "#2d3548")
            px(2, 14, 10, 7, "#0b1220")
            px(6, 22, 2, 2, "#3b4459")
            px(4, 24, 6, 1, "#4b5568")

            frame = self.tick // 3
            if st == "coding":
                colors = ("#34d399", "#60a5fa", "#fbbf24", "#f472b6")
                for row in range(3):
                    idx = (row + frame) % 4
                    length = 3 + ((idx * 2 + row) % 6)
                    px(3, 15 + row * 2, length, 1, colors[idx])
                if self.tick % 6 < 3:
                    px(10, 19, 1, 1, "#ffffff")
            elif st == "terminal":
                px(3, 15, 1, 1, "#a3e635")
                px(4, 16, 1, 1, "#a3e635")
                px(3, 17, 1, 1, "#a3e635")
                bar_w = 2 + (frame % 5)
                px(6, 16, bar_w, 1, "#4ade80")
                px(3, 19, 6, 1, "#22c55e")
                if self.tick % 4 < 2:
                    px(10, 19, 1, 1, "#bef264")
            elif st == "thinking":
                pulse = (self.tick // 5) % 3
                px(3, 15, 8, 1, "#334155")
                px(3 + pulse * 3, 17, 2, 2, "#fbbf24")
            elif st == "reading":
                scan = (self.tick // 4) % 3
                px(3, 15, 7, 1, "#60a5fa")
                px(3, 17, 6, 1, "#93c5fd")
                px(3, 19, 5, 1, "#60a5fa")
                px(3, 15 + scan * 2, 8, 1, "#ffffff")
            elif st in ("searching", "delegating"):
                rad = (frame % 3) + 1
                col = "#c084fc" if st == "searching" else "#f472b6"
                px(6 - rad, 17, 1, 1, col)
                px(7 + rad, 17, 1, 1, col)
                px(6, 17 - rad, 2, 1, "#e879f9")
                px(6, 17 + rad, 2, 1, "#e879f9")
            elif st == "done":
                px(4, 17, 2, 2, "#fde047")
                px(6, 18, 2, 2, "#fde047")
                px(8, 16, 2, 2, "#fde047")
            else:
                sx = 3 + (self.tick // 4) % 7
                sy = 15 + (self.tick // 7) % 4
                px(sx, sy, 2, 2, accent_hex)

            # Mini keyboard in front of character
            px(12, 23, 9, 2, "#64748b")
            px(13, 23, 7, 1, "#94a3b8")

        def _draw_cat(self, px: Any, st: str, reacting: bool = False) -> None:
            cx, cy = 14, 3
            if reacting and (self.tick % 4 < 2):
                cy += 1  # gentle head nod while being petted
            blink = st == "idle" and (self.tick % 48 > 44)
            fast_type = st in ("coding", "terminal")
            l_paw_up = fast_type and (self.tick % 4 < 2)
            r_paw_up = fast_type and (self.tick % 4 >= 2)

            tail_shift = (self.tick // 3 if reacting else self.tick // 6) % 2
            px(cx + 13, cy + 14 - tail_shift, 3, 2, "#ea580c")
            px(cx + 15, cy + 11 - tail_shift, 2, 4, "#f97316")

            px(cx + 2, cy + 11, 11, 10, "#f97316")
            px(cx + 4, cy + 13, 7, 7, "#fed7aa")

            px(cx + 2, cy, 3, 4, "#ea580c")
            px(cx + 10, cy, 3, 4, "#ea580c")
            px(cx + 3, cy + 1, 1, 2, "#fda4af")
            px(cx + 11, cy + 1, 1, 2, "#fda4af")

            px(cx + 1, cy + 3, 13, 9, "#fb923c")
            px(cx + 3, cy + 8, 9, 4, "#fed7aa")

            if reacting:
                # Happy squinted eyes ^ ^ and pink blush
                px(cx + 4, cy + 6, 2, 1, "#1e293b")
                px(cx + 5, cy + 5, 1, 1, "#1e293b")
                px(cx + 9, cy + 6, 2, 1, "#1e293b")
                px(cx + 10, cy + 5, 1, 1, "#1e293b")
                px(cx + 2, cy + 8, 2, 1, "#fda4af")
                px(cx + 11, cy + 8, 2, 1, "#fda4af")
            elif blink or st == "done":
                eye_y = cy + (6 if blink else 5)
                px(cx + 4, eye_y, 2, 1, "#1e293b")
                px(cx + 9, eye_y, 2, 1, "#1e293b")
            else:
                look = -1 if (st == "reading" and (self.tick // 6) % 2 == 0) else 0
                px(cx + 4 + look, cy + 5, 2, 2, "#0f172a")
                px(cx + 9 + look, cy + 5, 2, 2, "#0f172a")
                px(cx + 4 + look, cy + 5, 1, 1, "#ffffff")
                px(cx + 9 + look, cy + 5, 1, 1, "#ffffff")

            px(cx + 7, cy + 8, 1, 1, "#f43f5e")

            if st == "thinking":
                px(cx + 1, cy + 11, 3, 3, "#fed7aa")
                px(cx + 10, cy + 17, 3, 3, "#fed7aa")
            else:
                px(cx - 1, cy + 17 - (2 if l_paw_up else 0), 4, 3, "#fed7aa")
                px(cx + 5, cy + 18 - (2 if r_paw_up else 0), 4, 3, "#fed7aa")

        def _draw_bot(self, px: Any, st: str, reacting: bool = False) -> None:
            phase = (26 - self.reaction_ticks_left) % 10
            hit = reacting and phase in (4, 5, 6)
            bx = 14 - (1 if hit else 0)
            by = 4 + (1 if hit else 0)
            ant_color = (
                "#fb7185"
                if hit
                else "#fbbf24"
                if st == "thinking" and self.tick % 6 < 3
                else "#f59e0b"
                if st == "thinking"
                else "#fde047"
                if st == "done"
                else "#38bdf8"
            )
            px(bx + 7, by - 2, 1, 3, "#94a3b8")
            px(bx + 6, by - 4, 3, 2, ant_color)

            px(bx + 1, by + 1, 13, 10, "#334155")
            px(bx + 2, by + 2, 11, 8, "#0f172a")

            if reacting:
                # Startled > < visor eyes when whipped
                eye_c = "#fde047" if hit else "#fb7185"
                px(bx + 4, by + 5, 1, 1, eye_c)
                px(bx + 5, by + 6, 1, 1, eye_c)
                px(bx + 4, by + 7, 1, 1, eye_c)
                px(bx + 10, by + 5, 1, 1, eye_c)
                px(bx + 9, by + 6, 1, 1, eye_c)
                px(bx + 10, by + 7, 1, 1, eye_c)
            elif st == "thinking":
                step = (self.tick // 4) % 3
                px(bx + 4 + step * 3, by + 5, 2, 2, "#fbbf24")
            elif st == "done":
                px(bx + 4, by + 5, 2, 1, "#fde047")
                px(bx + 9, by + 5, 2, 1, "#fde047")
                px(bx + 6, by + 7, 3, 1, "#fde047")
            elif st == "idle" and self.tick % 40 > 37:
                px(bx + 4, by + 6, 2, 1, "#38bdf8")
                px(bx + 9, by + 6, 2, 1, "#38bdf8")
            else:
                eye_color = "#34d399" if st == "coding" else "#a3e635" if st == "terminal" else "#38bdf8"
                shift = (-1 if (self.tick // 6) % 2 == 0 else 1) if st == "reading" else 0
                px(bx + 4 + shift, by + 5, 2, 2, eye_color)
                px(bx + 9 + shift, by + 5, 2, 2, eye_color)

            px(bx + 2, by + 12, 11, 9, "#475569")
            px(bx + 5, by + 14, 5, 4, "#1e293b")
            px(bx + 6, by + 15, 3, 2, ant_color)

            fast_type = st in ("coding", "terminal")
            l_up = 4 if reacting else (2 if (fast_type and self.tick % 4 < 2) else 0)
            r_up = 4 if reacting else (2 if (fast_type and self.tick % 4 >= 2) else 0)
            if st == "thinking" and not reacting:
                px(bx, by + 11, 2, 4, "#64748b")
                px(bx + 13, by + 15, 2, 5, "#64748b")
            else:
                px(bx - 1, by + 16 - l_up, 3, 3, "#64748b")
                px(bx + 12, by + 16 - r_up, 3, 3, "#64748b")

        def _draw_dev(self, px: Any, st: str, reacting: bool = False) -> None:
            phase = (26 - self.reaction_ticks_left) % 10
            hit = reacting and phase in (4, 5, 6)
            dx = 14 - (1 if hit else 0)
            dy = 3 + (1 if hit else 0)
            blink = st == "idle" and (self.tick % 46 > 42)
            px(dx + 2, dy, 11, 4, "#312e81")
            px(dx + 1, dy + 3, 2, 6, "#ec4899")
            px(dx + 12, dy + 3, 2, 6, "#ec4899")

            px(dx + 3, dy + 3, 9, 8, "#fde68a")
            px(dx + 3, dy + 2, 9, 2, "#1e1b4b")

            if reacting:
                # Startled wide eyes & open mouth
                px(dx + 4, dy + 5, 2, 2, "#0f172a")
                px(dx + 9, dy + 5, 2, 2, "#0f172a")
                px(dx + 4, dy + 5, 1, 1, "#ffffff")
                px(dx + 9, dy + 5, 1, 1, "#ffffff")
                px(dx + 7, dy + 9, 2, 1, "#b45309")
            elif blink:
                px(dx + 4, dy + 6, 2, 1, "#1e293b")
                px(dx + 9, dy + 6, 2, 1, "#1e293b")
            else:
                shift = -1 if (st == "reading" and (self.tick // 6) % 2 == 0) else 0
                px(dx + 4 + shift, dy + 5, 2, 2, "#0f172a")
                px(dx + 9 + shift, dy + 5, 2, 2, "#0f172a")

            px(dx + 1, dy + 11, 13, 10, "#4f46e5")
            px(dx + 4, dy + 11, 7, 2, "#6366f1")

            fast_type = st in ("coding", "terminal")
            l_up = 4 if reacting else (2 if (fast_type and self.tick % 4 < 2) else 0)
            r_up = 4 if reacting else (2 if (fast_type and self.tick % 4 >= 2) else 0)
            if st == "thinking" and not reacting:
                px(dx + 1, dy + 11, 3, 3, "#fde68a")
                px(dx + 10, dy + 17, 3, 3, "#fde68a")
            else:
                px(dx - 1, dy + 17 - l_up, 4, 3, "#fde68a")
                px(dx + 5, dy + 18 - r_up, 4, 3, "#fde68a")

        def _draw_kyubi(self, px: Any, st: str, reacting: bool = False) -> None:
            phase = (26 - self.reaction_ticks_left) % 10
            hit = reacting and phase in (4, 5, 6)
            kx = 14 - (1 if hit else 0)
            ky = 3 + (1 if hit else 0)
            blink = st == "idle" and (self.tick % 46 > 42)
            sway = (self.tick // (2 if reacting else 6)) % 2

            # Swaying nine-tails fan behind Kyubi
            px(kx + 12, ky + 15 - sway, 4, 2, "#c2410c")
            px(kx + 15, ky + 13 - sway, 4, 2, "#ea580c")
            px(kx + 18, ky + 12 - sway, 2, 2, "#fed7aa")

            px(kx + 12, ky + 11 + sway, 5, 2, "#ea580c")
            px(kx + 16, ky + 9 + sway, 4, 2, "#f97316")
            px(kx + 19, ky + 8 + sway, 2, 2, "#fde68a")

            px(kx + 11, ky + 7 - sway, 5, 2, "#f97316")
            px(kx + 15, ky + 5 - sway, 3, 2, "#fb923c")
            px(kx + 17, ky + 4 - sway, 2, 2, "#fed7aa")

            px(kx + 11, ky + 18, 4, 2, "#9a3412")
            px(kx + 14, ky + 17 + sway, 4, 2, "#ea580c")

            # Body & chest fur
            px(kx + 2, ky + 11, 11, 10, "#ea580c")
            px(kx + 4, ky + 12, 7, 8, "#fdba74")
            px(kx + 5, ky + 14, 5, 5, "#fed7aa")

            # Tall pointed fox ears with dark tips
            px(kx + 1, ky - 1, 3, 5, "#ea580c")
            px(kx + 1, ky - 1, 2, 2, "#431407")
            px(kx + 2, ky + 1, 1, 2, "#fdba74")

            px(kx + 11, ky - 1, 3, 5, "#ea580c")
            px(kx + 12, ky - 1, 2, 2, "#431407")
            px(kx + 12, ky + 1, 1, 2, "#fdba74")

            # Head & spiky cheek tufts
            px(kx + 1, ky + 3, 13, 9, "#f97316")
            px(kx, ky + 6, 1, 3, "#ea580c")
            px(kx + 14, ky + 6, 1, 3, "#ea580c")
            px(kx + 3, ky + 8, 9, 4, "#fed7aa")

            # Dark eye markings
            px(kx + 3, ky + 5, 3, 2, "#7c2d12")
            px(kx + 9, ky + 5, 3, 2, "#7c2d12")

            if reacting:
                eye_c = "#fde047" if hit else "#ef4444"
                px(kx + 3, ky + 5, 1, 1, eye_c)
                px(kx + 4, ky + 6, 1, 1, eye_c)
                px(kx + 3, ky + 7, 1, 1, eye_c)
                px(kx + 11, ky + 5, 1, 1, eye_c)
                px(kx + 10, ky + 6, 1, 1, eye_c)
                px(kx + 11, ky + 7, 1, 1, eye_c)
                px(kx + 6, ky + 10, 3, 1, "#7c2d12")
            elif blink or st == "done":
                px(kx + 4, ky + 6, 2, 1, "#dc2626")
                px(kx + 9, ky + 6, 2, 1, "#dc2626")
            else:
                shift = -1 if (st == "reading" and (self.tick // 6) % 2 == 0) else 0
                px(kx + 4 + shift, ky + 5, 2, 2, "#dc2626")
                px(kx + 9 + shift, ky + 5, 2, 2, "#dc2626")
                px(kx + 4 + shift, ky + 5, 1, 2, "#0f172a")
                px(kx + 10 + shift, ky + 5, 1, 2, "#0f172a")

            # Nose & fangs
            px(kx + 7, ky + 8, 1, 1, "#1e293b")
            px(kx + 5, ky + 10, 1, 1, "#ffffff")
            px(kx + 9, ky + 10, 1, 1, "#ffffff")

            fast_type = st in ("coding", "terminal")
            l_up = 4 if reacting else (2 if (fast_type and self.tick % 4 < 2) else 0)
            r_up = 4 if reacting else (2 if (fast_type and self.tick % 4 >= 2) else 0)
            if st == "thinking" and not reacting:
                px(kx + 1, ky + 11, 3, 3, "#fed7aa")
                px(kx + 10, ky + 17, 3, 3, "#fed7aa")
            else:
                px(kx - 1, ky + 17 - l_up, 4, 3, "#fed7aa")
                px(kx + 5, ky + 18 - r_up, 4, 3, "#fed7aa")

        def _draw_jokowi(self, px: Any, st: str, reacting: bool = False) -> None:
            phase = (26 - self.reaction_ticks_left) % 10
            hit = reacting and phase in (4, 5, 6)
            jx = 14 - (1 if hit else 0)
            jy = 3 + (1 if hit else 0)
            blink = st == "idle" and (self.tick % 46 > 42)

            # Sleek side-parted black hair with higher forehead
            px(jx + 4, jy, 7, 2, "#0f172a")
            px(jx + 3, jy + 1, 9, 2, "#1e293b")
            px(jx + 5, jy + 1, 2, 1, "#475569")
            px(jx + 3, jy + 3, 1, 3, "#0f172a")
            px(jx + 11, jy + 3, 1, 3, "#0f172a")

            # Slimmer oval face with warm tan skin & cheekbones
            px(jx + 4, jy + 3, 7, 8, "#dfa670")
            px(jx + 3, jy + 5, 9, 4, "#dfa670")
            px(jx + 5, jy + 11, 5, 1, "#c98a55")
            px(jx + 3, jy + 7, 1, 2, "#c98a55")
            px(jx + 11, jy + 7, 1, 2, "#c98a55")

            # Subtle eyebrows & nose bridge
            px(jx + 4, jy + 5, 2, 1, "#1e293b")
            px(jx + 9, jy + 5, 2, 1, "#1e293b")
            px(jx + 7, jy + 7, 1, 2, "#c98a55")

            if reacting:
                px(jx + 4, jy + 6, 2, 2, "#0f172a")
                px(jx + 9, jy + 6, 2, 2, "#0f172a")
                px(jx + 4, jy + 6, 1, 1, "#ffffff")
                px(jx + 9, jy + 6, 1, 1, "#ffffff")
                px(jx + 6, jy + 10, 3, 1, "#7c2d12")
            elif blink or st == "idle":
                px(jx + 4, jy + 7, 2, 1, "#1e293b")
                px(jx + 9, jy + 7, 2, 1, "#1e293b")
                px(jx + 6, jy + 10, 3, 1, "#ffffff")
            else:
                shift = -1 if (st == "reading" and (self.tick // 6) % 2 == 0) else 0
                px(jx + 4 + shift, jy + 6, 2, 2, "#0f172a")
                px(jx + 9 + shift, jy + 6, 2, 2, "#0f172a")
                px(jx + 6, jy + 10, 3, 1, "#ffffff")

            # Slimmer white shirt with collar, chest pocket, rolled sleeves & black belt
            px(jx + 2, jy + 12, 11, 8, "#f8fafc")
            px(jx + 4, jy + 12, 7, 2, "#e2e8f0")
            px(jx + 7, jy + 14, 1, 6, "#cbd5e1")
            px(jx + 9, jy + 15, 3, 2, "#e2e8f0")
            px(jx + 1, jy + 13, 2, 3, "#e2e8f0")
            px(jx + 12, jy + 13, 2, 3, "#e2e8f0")
            px(jx + 1, jy + 16, 2, 2, "#dfa670")
            px(jx + 12, jy + 16, 2, 2, "#dfa670")
            px(jx + 2, jy + 20, 11, 2, "#0f172a")

            fast_type = st in ("coding", "terminal")
            l_up = 4 if reacting else (2 if (fast_type and self.tick % 4 < 2) else 0)
            r_up = 4 if reacting else (2 if (fast_type and self.tick % 4 >= 2) else 0)
            if st == "thinking" and not reacting:
                px(jx + 1, jy + 12, 3, 3, "#dfa670")
                px(jx + 10, jy + 18, 3, 3, "#dfa670")
            else:
                px(jx - 1, jy + 18 - l_up, 4, 3, "#dfa670")
                px(jx + 5, jy + 19 - r_up, 4, 3, "#dfa670")

        def _draw_prabowo(self, px: Any, st: str, reacting: bool = False) -> None:
            phase = (26 - self.reaction_ticks_left) % 10
            hit = reacting and phase in (4, 5, 6)
            px0 = 14 - (1 if hit else 0)
            py0 = 3 + (1 if hit else 0)
            blink = st == "idle" and (self.tick % 46 > 42)

            # Iconic black Peci cap + dark hair sides
            px(px0 + 3, py0, 9, 4, "#0f172a")
            px(px0 + 4, py0, 7, 1, "#1e293b")
            px(px0 + 2, py0 + 4, 1, 3, "#334155")
            px(px0 + 12, py0 + 4, 1, 3, "#334155")

            # Face & thick eyebrows
            px(px0 + 3, py0 + 4, 9, 8, "#f3c99b")
            px(px0 + 4, py0 + 5, 2, 1, "#1e293b")
            px(px0 + 9, py0 + 5, 2, 1, "#1e293b")

            if reacting:
                px(px0 + 4, py0 + 6, 2, 2, "#0f172a")
                px(px0 + 9, py0 + 6, 2, 2, "#0f172a")
                px(px0 + 4, py0 + 6, 1, 1, "#ffffff")
                px(px0 + 9, py0 + 6, 1, 1, "#ffffff")
                px(px0 + 6, py0 + 10, 3, 1, "#9a3412")
            elif blink:
                px(px0 + 4, py0 + 7, 2, 1, "#1e293b")
                px(px0 + 9, py0 + 7, 2, 1, "#1e293b")
            else:
                shift = -1 if (st == "reading" and (self.tick // 6) % 2 == 0) else 0
                px(px0 + 4 + shift, py0 + 6, 2, 2, "#0f172a")
                px(px0 + 9 + shift, py0 + 6, 2, 2, "#0f172a")
                px(px0 + 6, py0 + 10, 3, 1, "#9a3412")

            # Cream/khaki safari shirt with chest pockets
            px(px0 + 1, py0 + 12, 13, 10, "#e5d5b5")
            px(px0 + 4, py0 + 12, 7, 2, "#f5efe2")
            px(px0 + 2, py0 + 15, 3, 3, "#c7b28a")
            px(px0 + 10, py0 + 15, 3, 3, "#c7b28a")
            px(px0 + 7, py0 + 14, 1, 6, "#b8a074")

            fast_type = st in ("coding", "terminal")
            l_up = 4 if reacting else (2 if (fast_type and self.tick % 4 < 2) else 0)
            r_up = 4 if reacting else (2 if (fast_type and self.tick % 4 >= 2) else 0)
            if st == "thinking" and not reacting:
                px(px0 + 1, py0 + 12, 3, 3, "#f3c99b")
                px(px0 + 10, py0 + 18, 3, 3, "#f3c99b")
            else:
                px(px0 - 1, py0 + 18 - l_up, 4, 3, "#f3c99b")
                px(px0 + 5, py0 + 19 - r_up, 4, 3, "#f3c99b")

        def _draw_trump(self, px: Any, st: str, reacting: bool = False) -> None:
            phase = (26 - self.reaction_ticks_left) % 10
            hit = reacting and phase in (4, 5, 6)
            tx = 14 - (1 if hit else 0)
            ty = 3 + (1 if hit else 0)
            blink = st == "idle" and (self.tick % 46 > 42)

            # Swooped golden-blonde comb-over hair
            px(tx + 2, ty - 1, 10, 3, "#facc15")
            px(tx + 1, ty, 5, 2, "#fde047")
            px(tx + 11, ty + 1, 2, 3, "#eab308")
            px(tx + 2, ty + 2, 10, 2, "#eab308")

            # Orange-tan face with pale eye area
            px(tx + 3, ty + 4, 9, 8, "#fb923c")
            px(tx + 4, ty + 5, 3, 2, "#fdba74")
            px(tx + 8, ty + 5, 3, 2, "#fdba74")
            px(tx + 4, ty + 5, 2, 1, "#eab308")
            px(tx + 9, ty + 5, 2, 1, "#eab308")

            if reacting:
                px(tx + 4, ty + 6, 2, 2, "#0f172a")
                px(tx + 9, ty + 6, 2, 2, "#0f172a")
                px(tx + 4, ty + 6, 1, 1, "#ffffff")
                px(tx + 9, ty + 6, 1, 1, "#ffffff")
                px(tx + 6, ty + 10, 3, 1, "#9a3412")
            elif blink:
                px(tx + 4, ty + 7, 2, 1, "#1e293b")
                px(tx + 9, ty + 7, 2, 1, "#1e293b")
            else:
                shift = -1 if (st == "reading" and (self.tick // 6) % 2 == 0) else 0
                px(tx + 4 + shift, ty + 6, 2, 2, "#0f172a")
                px(tx + 9 + shift, ty + 6, 2, 2, "#0f172a")
                px(tx + 6, ty + 10, 3, 1, "#c2410c")

            # Navy suit, white collar & long red tie
            px(tx + 1, ty + 12, 13, 10, "#1e293b")
            px(tx + 5, ty + 12, 5, 3, "#f8fafc")
            px(tx + 6, ty + 13, 3, 2, "#dc2626")
            px(tx + 7, ty + 15, 1, 7, "#ef4444")

            fast_type = st in ("coding", "terminal")
            l_up = 4 if reacting else (2 if (fast_type and self.tick % 4 < 2) else 0)
            r_up = 4 if reacting else (2 if (fast_type and self.tick % 4 >= 2) else 0)
            if st == "thinking" and not reacting:
                px(tx + 1, ty + 12, 3, 3, "#fdba74")
                px(tx + 10, ty + 18, 3, 3, "#fdba74")
            else:
                px(tx - 1, ty + 18 - l_up, 4, 3, "#fdba74")
                px(tx + 5, ty + 19 - r_up, 4, 3, "#fdba74")

        def _draw_putin(self, px: Any, st: str, reacting: bool = False) -> None:
            phase = (26 - self.reaction_ticks_left) % 10
            hit = reacting and phase in (4, 5, 6)
            ux = 14 - (1 if hit else 0)
            uy = 3 + (1 if hit else 0)
            blink = st == "idle" and (self.tick % 46 > 42)

            # High receding hairline with thin ash-blonde hair on sides
            px(ux + 4, uy + 1, 7, 1, "#cbd5e1")
            px(ux + 3, uy + 2, 2, 3, "#94a3b8")
            px(ux + 10, uy + 2, 2, 3, "#94a3b8")

            # Fair cool face
            px(ux + 3, uy + 2, 9, 10, "#fde68a")
            px(ux + 4, uy + 1, 7, 1, "#fde68a")
            px(ux + 4, uy + 5, 2, 1, "#94a3b8")
            px(ux + 9, uy + 5, 2, 1, "#94a3b8")

            if reacting:
                px(ux + 4, uy + 6, 2, 2, "#0f172a")
                px(ux + 9, uy + 6, 2, 2, "#0f172a")
                px(ux + 4, uy + 6, 1, 1, "#ffffff")
                px(ux + 9, uy + 6, 1, 1, "#ffffff")
                px(ux + 6, uy + 10, 3, 1, "#b45309")
            elif blink:
                px(ux + 4, uy + 7, 2, 1, "#1e293b")
                px(ux + 9, uy + 7, 2, 1, "#1e293b")
            else:
                shift = -1 if (st == "reading" and (self.tick // 6) % 2 == 0) else 0
                px(ux + 4 + shift, uy + 6, 2, 1, "#0f172a")
                px(ux + 9 + shift, uy + 6, 2, 1, "#0f172a")
                px(ux + 6, uy + 10, 3, 1, "#b45309")

            # Dark charcoal suit, white shirt & burgundy tie
            px(ux + 1, uy + 12, 13, 10, "#0f172a")
            px(ux + 5, uy + 12, 5, 3, "#f8fafc")
            px(ux + 7, uy + 13, 1, 6, "#991b1b")

            fast_type = st in ("coding", "terminal")
            l_up = 4 if reacting else (2 if (fast_type and self.tick % 4 < 2) else 0)
            r_up = 4 if reacting else (2 if (fast_type and self.tick % 4 >= 2) else 0)
            if st == "thinking" and not reacting:
                px(ux + 1, uy + 12, 3, 3, "#fde68a")
                px(ux + 10, uy + 18, 3, 3, "#fde68a")
            else:
                px(ux - 1, uy + 18 - l_up, 4, 3, "#fde68a")
                px(ux + 5, uy + 19 - r_up, 4, 3, "#fde68a")

        def _draw_kim(self, px: Any, st: str, reacting: bool = False) -> None:
            phase = (26 - self.reaction_ticks_left) % 10
            hit = reacting and phase in (4, 5, 6)
            mx = 14 - (1 if hit else 0)
            my = 3 + (1 if hit else 0)
            blink = st == "idle" and (self.tick % 46 > 42)

            # Iconic flat-top trapezoid black hair with shaved sides
            px(mx + 3, my - 1, 9, 4, "#0f172a")
            px(mx + 2, my, 1, 2, "#1e293b")
            px(mx + 12, my, 1, 2, "#1e293b")

            # Rounder face & cheeks
            px(mx + 2, my + 3, 11, 9, "#f5cfa0")
            px(mx + 3, my + 11, 9, 1, "#e5b887")

            if reacting:
                px(mx + 4, my + 6, 2, 2, "#0f172a")
                px(mx + 9, my + 6, 2, 2, "#0f172a")
                px(mx + 4, my + 6, 1, 1, "#ffffff")
                px(mx + 9, my + 6, 1, 1, "#ffffff")
                px(mx + 6, my + 10, 3, 1, "#9a3412")
            elif blink:
                px(mx + 4, my + 7, 2, 1, "#1e293b")
                px(mx + 9, my + 7, 2, 1, "#1e293b")
            else:
                shift = -1 if (st == "reading" and (self.tick // 6) % 2 == 0) else 0
                px(mx + 4 + shift, my + 6, 2, 2, "#0f172a")
                px(mx + 9 + shift, my + 6, 2, 2, "#0f172a")
                px(mx + 6, my + 10, 3, 1, "#b45309")

            # Dark charcoal Mao suit
            px(mx + 1, my + 12, 13, 10, "#1e293b")
            px(mx + 4, my + 12, 7, 2, "#334155")
            px(mx + 7, my + 14, 1, 6, "#0f172a")

            fast_type = st in ("coding", "terminal")
            l_up = 4 if reacting else (2 if (fast_type and self.tick % 4 < 2) else 0)
            r_up = 4 if reacting else (2 if (fast_type and self.tick % 4 >= 2) else 0)
            if st == "thinking" and not reacting:
                px(mx + 1, my + 12, 3, 3, "#f5cfa0")
                px(mx + 10, my + 18, 3, 3, "#f5cfa0")
            else:
                px(mx - 1, my + 18 - l_up, 4, 3, "#f5cfa0")
                px(mx + 5, my + 19 - r_up, 4, 3, "#f5cfa0")

        def _draw_fufufafa(self, px: Any, st: str, reacting: bool = False) -> None:
            phase = (26 - self.reaction_ticks_left) % 10
            hit = reacting and phase in (4, 5, 6)
            fx = 14 - (1 if hit else 0)
            fy = 3 + (1 if hit else 0)
            blink = st == "idle" and (self.tick % 46 > 42)

            # Short neat swept black hair
            px(fx + 3, fy, 9, 4, "#0f172a")
            px(fx + 4, fy, 6, 1, "#1e293b")
            px(fx + 11, fy + 2, 1, 4, "#1e293b")

            # Face & serious focused expression
            px(fx + 3, fy + 4, 9, 8, "#f0c495")
            px(fx + 4, fy + 5, 2, 1, "#1e293b")
            px(fx + 9, fy + 5, 2, 1, "#1e293b")

            if reacting:
                px(fx + 4, fy + 6, 2, 2, "#0f172a")
                px(fx + 9, fy + 6, 2, 2, "#0f172a")
                px(fx + 4, fy + 6, 1, 1, "#ffffff")
                px(fx + 9, fy + 6, 1, 1, "#ffffff")
                px(fx + 6, fy + 10, 3, 1, "#9a3412")
            elif blink:
                px(fx + 4, fy + 7, 2, 1, "#1e293b")
                px(fx + 9, fy + 7, 2, 1, "#1e293b")
                px(fx + 6, fy + 10, 3, 1, "#9a3412")
            else:
                px(fx + 3, fy + 6, 2, 2, "#0f172a")
                px(fx + 8, fy + 6, 2, 2, "#0f172a")
                px(fx + 6, fy + 10, 3, 1, "#9a3412")

            # Light-blue & dark-slate zip-up jacket with white stand-up collar + orange swirl emblem
            px(fx + 1, fy + 12, 13, 4, "#475569")
            px(fx + 1, fy + 16, 13, 6, "#7dd3fc")
            px(fx + 4, fy + 11, 7, 3, "#f8fafc")
            px(fx + 7, fy + 14, 1, 8, "#e2e8f0")
            px(fx + 4, fy + 17, 3, 3, "#f97316")
            px(fx + 5, fy + 18, 1, 1, "#7c2d12")

            fast_type = st in ("coding", "terminal")
            l_up = 4 if reacting else (2 if (fast_type and self.tick % 4 < 2) else 0)
            r_up = 4 if reacting else (2 if (fast_type and self.tick % 4 >= 2) else 0)
            if st in ("idle", "thinking") and not reacting:
                px(fx - 2, fy + 8, 3, 7, "#7dd3fc")
                px(fx - 1, fy + 5, 4, 3, "#f0c495")
                px(fx + 10, fy + 18, 3, 3, "#f0c495")
            else:
                px(fx - 1, fy + 18 - l_up, 4, 3, "#f0c495")
                px(fx + 5, fy + 19 - r_up, 4, 3, "#f0c495")

        def _draw_human_actor(self, px: Any, hx: int, hy: int, trainer: str, mood: str) -> str:
            sleeve_map = {
                "girl": "#f43f5e",
                "sensei": "#0f766e",
                "naruto": "#f97316",
                "jokowi": "#f8fafc",
                "prabowo": "#e5d5b5",
                "trump": "#1e293b",
                "putin": "#0f172a",
                "kim": "#1e293b",
                "fufufafa": "#7dd3fc",
            }
            skin_map = {
                "jokowi": "#dfa670",
                "prabowo": "#f3c99b",
                "trump": "#fb923c",
                "kim": "#f5cfa0",
                "fufufafa": "#f0c495",
            }
            sleeve = sleeve_map.get(trainer, "#334155")
            skin = skin_map.get(trainer, "#fde68a")

            # Head & face (facing left, larger proportions)
            px(hx + 2, hy + 4, 8, 6, skin)

            if trainer == "girl":
                px(hx + 2, hy + 1, 9, 3, "#92400e")
                px(hx + 1, hy + 3, 2, 4, "#92400e")
                px(hx + 9, hy + 3, 3, 9, "#78350f")
                px(hx + 12, hy + 5, 2, 7, "#92400e")
                px(hx + 10, hy + 4, 2, 2, "#fde047")
            elif trainer == "sensei":
                px(hx + 2, hy, 9, 3, "#e2e8f0")
                px(hx + 10, hy + 1, 3, 2, "#cbd5e1")
                px(hx + 1, hy + 3, 10, 1, "#7c3aed")
                px(hx + 11, hy + 3, 2, 3, "#a855f7")
                px(hx + 9, hy + 4, 3, 4, "#cbd5e1")
            elif trainer == "naruto":
                px(hx + 1, hy, 3, 3, "#facc15")
                px(hx + 4, hy - 1, 4, 4, "#fde047")
                px(hx + 8, hy, 4, 3, "#eab308")
                px(hx + 2, hy + 2, 9, 2, "#facc15")
                px(hx + 10, hy + 2, 2, 4, "#eab308")
                px(hx + 1, hy + 3, 10, 2, "#1e293b")
                px(hx + 3, hy + 3, 4, 2, "#cbd5e1")
                px(hx + 11, hy + 3, 2, 2, "#1e293b")
            elif trainer == "jokowi":
                px(hx + 3, hy + 1, 8, 3, "#0f172a")
                px(hx + 4, hy + 1, 3, 1, "#475569")
                px(hx + 9, hy + 3, 2, 4, "#1e293b")
            elif trainer == "prabowo":
                px(hx + 2, hy, 9, 4, "#0f172a")
                px(hx + 3, hy, 6, 1, "#1e293b")
                px(hx + 9, hy + 4, 2, 3, "#334155")
            elif trainer == "trump":
                px(hx + 1, hy, 10, 3, "#facc15")
                px(hx, hy + 1, 4, 2, "#fde047")
                px(hx + 9, hy + 2, 2, 3, "#eab308")
            elif trainer == "putin":
                px(hx + 4, hy + 1, 6, 2, "#cbd5e1")
                px(hx + 9, hy + 3, 2, 4, "#94a3b8")
            elif trainer == "kim":
                px(hx + 2, hy, 9, 4, "#0f172a")
                px(hx + 9, hy + 1, 2, 2, "#1e293b")
            elif trainer == "fufufafa":
                px(hx + 2, hy, 9, 4, "#0f172a")
                px(hx + 3, hy, 5, 1, "#1e293b")
                px(hx + 9, hy + 3, 2, 4, "#1e293b")
            else:
                px(hx + 2, hy, 9, 4, "#dc2626")
                px(hx + 3, hy, 6, 1, "#ef4444")
                px(hx - 1, hy + 3, 5, 1, "#991b1b")
                px(hx + 9, hy + 4, 3, 4, "#1e293b")

            # Expression: warm/gentle while petting vs fierce focus while attacking
            if trainer == "sensei":
                px(hx + 2, hy + 5, 5, 2, "#0f172a")
                px(hx + 3, hy + 5, 2, 1, "#38bdf8")
                px(hx + 2, hy + 8, 3, 1, "#cbd5e1")
                px(hx + 3, hy + 9, 2, 1, "#b45309" if mood == "pet" else "#94a3b8")
            elif mood == "pet":
                px(hx + 3, hy + 6, 2, 1, "#0f172a")
                px(hx + 4, hy + 5, 1, 1, "#0f172a")
                px(hx + 2, hy + 8, 2, 1, "#fda4af")
                px(hx + 3, hy + 9, 3, 1, "#b45309")
            elif trainer == "naruto":
                px(hx + 3, hy + 5, 3, 1, "#b45309")
                px(hx + 4, hy + 6, 2, 2, "#0284c7")
                px(hx + 4, hy + 6, 1, 1, "#7dd3fc")
                px(hx + 3, hy + 9, 2, 1, "#b45309")
            else:
                px(hx + 3, hy + 5, 3, 1, "#eab308" if trainer == "trump" else "#1e293b")
                px(hx + 4, hy + 6, 2, 2, "#0f172a")
                px(hx + 4, hy + 6, 1, 1, "#ffffff")
                px(hx + 3, hy + 9, 2, 1, "#ffffff" if trainer == "jokowi" else "#b45309")

            if trainer == "naruto":
                px(hx + 6, hy + 7, 2, 1, "#d97706")
                px(hx + 6, hy + 9, 2, 1, "#d97706")

            # Torso, outfit details, legs & shoes (standing down to y = 25)
            px(hx + 1, hy + 10, 11, 8, sleeve)
            if trainer == "girl":
                px(hx + 2, hy + 10, 3, 5, "#fef3c7")
                px(hx + 5, hy + 11, 6, 2, "#fb7185")
                px(hx + 1, hy + 18, 11, 3, "#1e293b")
                px(hx + 3, hy + 21, 2, 2, "#fde68a")
                px(hx + 8, hy + 21, 2, 2, "#fde68a")
                px(hx + 2, hy + 23, 4, 2, "#4c1d95")
                px(hx + 7, hy + 23, 4, 2, "#4c1d95")
            elif trainer == "sensei":
                px(hx + 2, hy + 10, 3, 6, "#fef3c7")
                px(hx + 1, hy + 16, 11, 2, "#fbbf24")
                px(hx + 1, hy + 18, 5, 5, "#134e4a")
                px(hx + 7, hy + 18, 5, 5, "#134e4a")
                px(hx + 1, hy + 23, 4, 2, "#78350f")
                px(hx + 7, hy + 23, 4, 2, "#78350f")
            elif trainer == "naruto":
                px(hx + 1, hy + 10, 11, 3, "#1e293b")
                px(hx + 3, hy + 10, 2, 7, "#f8fafc")
                px(hx + 1, hy + 17, 11, 1, "#1e293b")
                px(hx + 2, hy + 18, 4, 5, "#ea580c")
                px(hx + 7, hy + 18, 4, 5, "#ea580c")
                px(hx + 1, hy + 23, 5, 2, "#0f172a")
                px(hx + 7, hy + 23, 5, 2, "#0f172a")
            elif trainer == "jokowi":
                px(hx + 2, hy + 10, 3, 2, "#e2e8f0")
                px(hx + 3, hy + 12, 1, 5, "#cbd5e1")
                px(hx + 2, hy + 18, 4, 5, "#0f172a")
                px(hx + 7, hy + 18, 4, 5, "#0f172a")
                px(hx + 1, hy + 23, 5, 2, "#0f172a")
                px(hx + 7, hy + 23, 5, 2, "#0f172a")
            elif trainer == "prabowo":
                px(hx + 2, hy + 10, 3, 2, "#f5efe2")
                px(hx + 2, hy + 13, 3, 3, "#c7b28a")
                px(hx + 2, hy + 18, 4, 5, "#c7b28a")
                px(hx + 7, hy + 18, 4, 5, "#c7b28a")
                px(hx + 1, hy + 23, 5, 2, "#0f172a")
                px(hx + 7, hy + 23, 5, 2, "#0f172a")
            elif trainer == "trump":
                px(hx + 2, hy + 10, 3, 5, "#f8fafc")
                px(hx + 2, hy + 12, 1, 6, "#dc2626")
                px(hx + 2, hy + 18, 4, 5, "#1e293b")
                px(hx + 7, hy + 18, 4, 5, "#1e293b")
                px(hx + 1, hy + 23, 5, 2, "#0f172a")
                px(hx + 7, hy + 23, 5, 2, "#0f172a")
            elif trainer == "putin":
                px(hx + 2, hy + 10, 3, 5, "#f8fafc")
                px(hx + 2, hy + 12, 1, 5, "#991b1b")
                px(hx + 2, hy + 18, 4, 5, "#0f172a")
                px(hx + 7, hy + 18, 4, 5, "#0f172a")
                px(hx + 1, hy + 23, 5, 2, "#0f172a")
                px(hx + 7, hy + 23, 5, 2, "#0f172a")
            elif trainer == "kim":
                px(hx + 2, hy + 10, 3, 2, "#334155")
                px(hx + 3, hy + 12, 1, 5, "#0f172a")
                px(hx + 2, hy + 18, 4, 5, "#1e293b")
                px(hx + 7, hy + 18, 4, 5, "#1e293b")
                px(hx + 1, hy + 23, 5, 2, "#0f172a")
                px(hx + 7, hy + 23, 5, 2, "#0f172a")
            elif trainer == "fufufafa":
                px(hx + 1, hy + 10, 11, 4, "#475569")
                px(hx + 2, hy + 9, 4, 3, "#f8fafc")
                px(hx + 4, hy + 12, 1, 6, "#e2e8f0")
                px(hx + 2, hy + 14, 2, 2, "#f97316")
                px(hx + 2, hy + 18, 4, 5, "#0f172a")
                px(hx + 7, hy + 18, 4, 5, "#0f172a")
                px(hx + 1, hy + 23, 5, 2, "#0f172a")
                px(hx + 7, hy + 23, 5, 2, "#0f172a")
            else:
                px(hx + 2, hy + 10, 3, 5, "#f8fafc")
                px(hx + 2, hy + 12, 1, 4, "#ef4444")
                px(hx + 2, hy + 18, 4, 5, "#1e293b")
                px(hx + 7, hy + 18, 4, 5, "#1e293b")
                px(hx + 1, hy + 23, 5, 2, "#0f172a")
                px(hx + 7, hy + 23, 5, 2, "#0f172a")
            return sleeve

        def _draw_prompt_reaction(self, px: Any, char: str) -> None:
            trainer = self.config.get("trainer", "boss")
            if char == "cat":
                # Selected human character standing next to cat, reaching arm to pet cat's head
                hx, hy = 30, 1
                sleeve = self._draw_human_actor(px, hx, hy, trainer, "pet")

                stroke = int(round(math.sin(self.tick * 0.75) * 2))
                hand_y = 4 + (self.tick % 2)
                px(hx - 2, hy + 9, 4, 3, sleeve)
                px(hx - 5, hy + 7, 4, 2, sleeve)
                px(20 + stroke, hand_y, 6, 2, "#fde68a")
                px(21 + stroke, hand_y + 2, 4, 1, "#f59e0b")

                # Rising pixel hearts
                lift = (26 - self.reaction_ticks_left) % 8
                for offset_x, offset_y, col in ((9, 8 - (lift % 6), "#fb7185"), (27, 7 - ((lift + 3) % 5), "#f43f5e")):
                    px(offset_x, offset_y, 1, 1, col)
                    px(offset_x + 2, offset_y, 1, 1, col)
                    px(offset_x, offset_y + 1, 3, 1, col)
                    px(offset_x + 1, offset_y + 2, 1, 1, col)
            else:
                # Larger selected human character standing on the right
                phase = (26 - self.reaction_ticks_left) % 10
                hx, hy = 35, 1
                sleeve = self._draw_human_actor(px, hx, hy, trainer, "whip")

                if trainer == "naruto":
                    # Naruto charges and strikes with a glowing spinning Rasengan (no whip)
                    if phase < 3:
                        px(hx - 2, hy + 11, 4, 3, sleeve)
                        px(hx - 4, hy + 12, 2, 2, "#fde68a")
                        rx, ry = hx - 9, hy + 10
                        px(rx, ry + 1, 5, 3, "#0284c7")
                        px(rx + 1, ry, 3, 5, "#38bdf8")
                        px(rx + 1, ry + 1, 3, 3, "#bae6fd")
                        px(rx + 2, ry + 2, 1, 1, "#ffffff")
                        if self.tick % 2 == 0:
                            px(rx - 1, ry, 1, 1, "#7dd3fc")
                            px(rx + 5, ry + 4, 1, 1, "#ffffff")
                        else:
                            px(rx + 5, ry, 1, 1, "#7dd3fc")
                            px(rx - 1, ry + 4, 1, 1, "#ffffff")
                    elif phase < 7:
                        px(hx - 6, hy + 11, 8, 3, sleeve)
                        px(hx - 8, hy + 11, 2, 2, "#fde68a")
                        rx, ry = hx - 14, hy + 9
                        px(rx, ry + 1, 6, 4, "#0284c7")
                        px(rx + 1, ry, 4, 6, "#38bdf8")
                        px(rx + 1, ry + 1, 4, 4, "#7dd3fc")
                        px(rx + 2, ry + 1, 2, 4, "#e0f2fe")
                        px(rx + 2, ry + 2, 2, 2, "#ffffff")
                        if phase in (4, 5):
                            px(rx - 2, ry, 1, 1, "#ffffff")
                            px(rx - 2, ry + 3, 2, 1, "#7dd3fc")
                            px(rx + 1, ry - 1, 1, 1, "#bae6fd")
                            px(rx + 5, ry + 5, 1, 1, "#38bdf8")
                    else:
                        px(hx - 4, hy + 13, 6, 3, sleeve)
                        px(hx - 6, hy + 13, 2, 2, "#fde68a")
                        px(24, 11, 2, 2, "#7dd3fc")
                        px(27, 9, 1, 1, "#ffffff")
                        px(22, 15, 2, 1, "#38bdf8")
                else:
                    # Animated arm & whip (wind-up -> crack -> follow-through)
                    if phase < 3:
                        px(hx + 6, hy + 8, 3, 4, sleeve)
                        px(hx + 8, hy + 6, 2, 2, "#fde68a")
                        px(hx + 9, hy + 3, 2, 3, "#78350f")
                        px(hx + 11, hy + 1, 2, 3, "#d97706")
                        px(hx + 13, hy + 2, 2, 3, "#f59e0b")
                    elif phase < 7:
                        px(hx - 2, hy + 11, 5, 3, sleeve)
                        px(hx - 4, hy + 11, 3, 2, "#fde68a")
                        px(hx - 6, hy + 10, 2, 1, "#78350f")
                        px(hx - 8, hy + 11, 3, 1, "#b45309")
                        px(hx - 10, hy + 12, 3, 1, "#d97706")
                        px(hx - 12, hy + 13, 3, 1, "#f59e0b")
                        if phase in (4, 5):
                            px(23, 12, 1, 1, "#fef08a")
                            px(22, 14, 2, 2, "#ffffff")
                            px(24, 16, 1, 1, "#fb7185")
                            px(21, 12, 1, 1, "#fde047")
                    else:
                        px(hx - 1, hy + 13, 4, 3, sleeve)
                        px(hx - 3, hy + 14, 2, 2, "#fde68a")
                        px(hx - 5, hy + 15, 2, 1, "#78350f")
                        px(hx - 8, hy + 16, 3, 1, "#b45309")
                        px(hx - 10, hy + 18, 3, 1, "#d97706")

                # Exclamation mark above-left of buddy & sweat drop
                px(10, 2, 2, 4, "#ef4444")
                px(10, 7, 2, 2, "#ef4444")
                px(28, 3 + (phase % 2), 2, 2, "#60a5fa")

        def _draw_particles(self, px: Any, st: str, accent_hex: str) -> None:
            if st == "thinking":
                # Full sidebar-style pixel thought cloud with pulsing dots -> question mark
                px(27, 11, 2, 2, "#f8fafc")
                px(29, 8, 2, 2, "#f8fafc")
                px(27, 1, 10, 6, "#f8fafc")
                px(28, 0, 8, 8, "#f8fafc")
                phase = (self.tick // 6) % 4
                if phase < 3:
                    for i in range(phase + 1):
                        px(29 + i * 2, 3, 1, 2, "#f59e0b")
                else:
                    px(31, 2, 2, 1, "#d97706")
                    px(32, 3, 1, 1, "#d97706")
                    px(31, 5, 1, 1, "#d97706")
            elif st == "coding":
                off = self.tick % 10
                px(4, 11 - (off % 6), 2, 2, "#34d399")
                px(9, 10 - ((self.tick + 4) % 7), 2, 2, "#60a5fa")
                px(30, 14 - off, 2, 1, "#fbbf24")
            elif st == "terminal":
                off = self.tick % 9
                px(5, 11 - (off % 6), 2, 2, "#a3e635")
                px(30, 15 - ((self.tick + 4) % 9), 2, 2, "#4ade80")
            elif st == "reading":
                fy = 6 + ((self.tick // 6) % 2)
                px(29, fy, 6, 7, "#dbeafe")
                px(30, fy + 2, 4, 1, "#3b82f6")
                px(30, fy + 4, 3, 1, "#3b82f6")
            elif st in ("searching", "delegating"):
                r = (self.tick // 4) % 4
                col = "#c084fc" if st == "searching" else "#f472b6"
                px(29 + r, 11 - r, 2, 2, col)
                px(32, 13, 2, 2, "#e879f9")
            elif st == "done":
                lift = (self.tick // 3) % 6
                px(7, 8 - lift, 2, 2, "#fde047")
                px(31, 7 - ((lift + 2) % 6), 2, 2, "#34d399")
                px(22, 3 - ((lift + 4) % 5), 2, 2, "#f472b6")
                px(34, 10 - ((lift + 1) % 6), 2, 2, "#60a5fa")
            else:
                if self.config.get("character") == "kyubi":
                    # Kyubi gathering fiery red-orange chakra when idle (no coffee mug)
                    lift = (self.tick // 3) % 7
                    pulse = (self.tick // 4) % 2
                    px(10, 12 - (lift % 6), 2, 2, "#ef4444", 210)
                    px(30, 10 - ((lift + 3) % 6), 2, 2, "#f97316", 210)
                    px(20 + pulse, 6 - ((lift + 5) % 5), 2, 2, "#fbbf24", 220)
                    px(15 - pulse, 8 - ((lift + 2) % 5), 1, 2, "#fef08a", 230)
                    px(9, 17 - pulse, 2, 4, "#ef4444", 150)
                    px(31, 16 + pulse, 2, 4, "#f97316", 150)
                elif self.config.get("character") == "prabowo":
                    # Mini pohon sawit (oil palm tree) on the right when idle
                    sway = (self.tick // 10) % 2
                    px(31, 22, 4, 2, "#92400e")
                    px(32, 17, 2, 5, "#78350f")
                    px(31, 17, 1, 2, "#ea580c")
                    px(28 + sway, 15, 4, 1, "#16a34a")
                    px(27 + sway, 16, 2, 1, "#22c55e")
                    px(33 + sway, 15, 4, 1, "#16a34a")
                    px(36 + sway, 16, 2, 1, "#22c55e")
                    px(30, 13, 2, 2, "#22c55e")
                    px(33, 13, 2, 2, "#15803d")
                    px(31, 12, 3, 2, "#4ade80")
                else:
                    # Cozy steaming coffee mug on the right when idle
                    px(31, 19, 4, 5, "#e2e8f0")
                    px(35, 20, 1, 3, "#cbd5e1")
                    px(32, 19, 2, 1, "#78350f")
                    steam_y = 16 - ((self.tick // 6) % 3)
                    px(32 + ((self.tick // 8) % 2), steam_y, 1, 2, "#e2e8f0", 130)

        def enterEvent(self, _event: Any) -> None:
            self.hovered = True
            self._update_click_mask()
            self.update()

        def leaveEvent(self, _event: Any) -> None:
            self.hovered = False
            self._update_click_mask()
            self.update()

        def mousePressEvent(self, event: Any) -> None:
            if event.button() == Qt.LeftButton:
                self.dragging = True
                self.drag_moved = False
                self.press_global_pos = event.globalPos()
                self.drag_offset = event.globalPos() - self.frameGeometry().topLeft()
                event.accept()
            elif event.button() == Qt.RightButton:
                self._show_context_menu(event.globalPos())
                event.accept()

        def mouseMoveEvent(self, event: Any) -> None:
            if self.dragging and (event.buttons() & Qt.LeftButton):
                if not self.drag_moved and (event.globalPos() - self.press_global_pos).manhattanLength() <= 4:
                    return
                self.drag_moved = True
                new_pos = event.globalPos() - self.drag_offset
                self.pos_x, self.pos_y = self._clamp_position(new_pos.x(), new_pos.y())
                self.move(int(round(self.pos_x)), int(round(self.pos_y)))
                event.accept()

        def mouseReleaseEvent(self, event: Any) -> None:
            if event.button() == Qt.LeftButton and self.dragging:
                self.dragging = False
                self.drag_grace_until = time.monotonic() + 1.0
                if self.drag_moved:
                    self._save_config()
                elif should_trigger_click_reaction(self.effective_state, self.drag_moved):
                    self.reaction_ticks_left = 26
                    self._update_click_mask()
                    self.update()
                event.accept()

        def mouseDoubleClickEvent(self, event: Any) -> None:
            if event.button() == Qt.LeftButton:
                idx = VALID_CHARS.index(self.config["character"])
                self.config["character"] = VALID_CHARS[(idx + 1) % len(VALID_CHARS)]
                self._save_config()
                self.update()
                event.accept()

        def _show_context_menu(self, global_pos: QPoint) -> None:
            menu = QMenu(self)

            char_menu = menu.addMenu(self._tr("character"))
            for ch in VALID_CHARS:
                act = QAction(self._tr(f"char_{ch}"), self, checkable=True)
                act.setChecked(self.config["character"] == ch)
                act.triggered.connect(lambda _checked=False, c=ch: self._set_character(c))
                char_menu.addAction(act)

            trainer_menu = menu.addMenu(self._tr("trainer"))
            for tr in VALID_TRAINERS:
                act = QAction(self._tr(f"trainer_{tr}"), self, checkable=True)
                act.setChecked(self.config.get("trainer", "boss") == tr)
                act.triggered.connect(lambda _checked=False, t=tr: self._set_trainer(t))
                trainer_menu.addAction(act)

            mode_menu = menu.addMenu(self._tr("movement"))
            for mode in VALID_MODES:
                act = QAction(self._tr(f"mode_{mode}"), self, checkable=True)
                act.setChecked(self.config["moveMode"] == mode)
                act.triggered.connect(lambda _checked=False, m=mode: self._set_move_mode(m))
                mode_menu.addAction(act)

            bubble_menu = menu.addMenu(self._tr("bubble"))
            for bm in VALID_BUBBLE_MODES:
                act = QAction(self._tr(f"bubble_{bm}"), self, checkable=True)
                act.setChecked(self.config["bubbleMode"] == bm)
                act.triggered.connect(lambda _checked=False, b=bm: self._set_bubble_mode(b))
                bubble_menu.addAction(act)

            scale_menu = menu.addMenu(self._tr("size"))
            for sc in (2, 3, 4):
                act = QAction(f"{sc}x Pixel", self, checkable=True)
                act.setChecked(self.config["scale"] == sc)
                act.triggered.connect(lambda _checked=False, v=sc: self._set_scale(v))
                scale_menu.addAction(act)

            lang_menu = menu.addMenu(self._tr("language"))
            for lg in VALID_LANGS:
                act = QAction(self._tr(f"lang_{lg}"), self, checkable=True)
                act.setChecked(self._lang() == lg)
                act.triggered.connect(lambda _checked=False, l=lg: self._set_language(l))
                lang_menu.addAction(act)

            menu.addSeparator()
            react_menu = menu.addMenu(self._tr("prompt_reaction"))
            cur_enabled = bool(self.config.get("promptReaction", True))
            cur_trig = self.config.get("reactionTrigger", "hook")

            act_hook = QAction(self._tr("trigger_hook"), self, checkable=True)
            act_hook.setChecked(cur_enabled and cur_trig == "hook")
            act_hook.triggered.connect(lambda _c=False: self._set_reaction_setting(True, "hook"))
            react_menu.addAction(act_hook)

            act_prompt = QAction(self._tr("trigger_prompt"), self, checkable=True)
            act_prompt.setChecked(cur_enabled and cur_trig == "prompt")
            act_prompt.triggered.connect(lambda _c=False: self._set_reaction_setting(True, "prompt"))
            react_menu.addAction(act_prompt)

            act_off = QAction(self._tr("trigger_off"), self, checkable=True)
            act_off.setChecked(not cur_enabled)
            act_off.triggered.connect(lambda _c=False: self._set_reaction_setting(False, cur_trig))
            react_menu.addAction(act_off)

            react_menu.addSeparator()
            test_act = QAction(self._tr("test_reaction"), self)
            test_act.triggered.connect(self._trigger_test_reaction)
            react_menu.addAction(test_act)

            menu.addSeparator()
            hide_act = QAction(self._tr("mode_hidden"), self)
            hide_act.triggered.connect(self._hide_and_quit)
            menu.addAction(hide_act)

            self.menu_open = True
            try:
                menu.exec_(global_pos)
            finally:
                self.menu_open = False

        def _set_character(self, char: str) -> None:
            self.config["character"] = char
            self._save_config()
            self.update()

        def _set_trainer(self, trainer: str) -> None:
            self.config["trainer"] = trainer
            self._save_config()
            self.update()

        def _set_move_mode(self, mode: str) -> None:
            self.config["moveMode"] = mode
            if mode == "sticky":
                self.facing_right = True
            self._save_config()
            self.update()

        def _set_bubble_mode(self, bubble_mode: str) -> None:
            self.config["bubbleMode"] = bubble_mode
            self._save_config()
            self._update_click_mask()
            self.update()

        def _set_scale(self, scale: int) -> None:
            self.config["scale"] = scale
            self._apply_window_size()
            self.pos_x, self.pos_y = self._clamp_position(self.pos_x, self.pos_y)
            self.move(int(round(self.pos_x)), int(round(self.pos_y)))
            self._save_config()
            self._update_click_mask()
            self.update()

        def _set_language(self, lang: str) -> None:
            self.config["language"] = lang
            self._save_config()
            self._update_click_mask()
            self.update()

        def _set_reaction_setting(self, enabled: bool, trigger: str) -> None:
            self.config["promptReaction"] = bool(enabled)
            if trigger in VALID_REACTION_TRIGGERS:
                self.config["reactionTrigger"] = trigger
            self._save_config()
            self.update()

        def _trigger_test_reaction(self) -> None:
            self.reaction_ticks_left = 26
            self.update()

        def _hide_and_quit(self) -> None:
            self.config["moveMode"] = "hidden"
            self._save_config()
            QApplication.quit()

    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(True)
    window = FloatingBuddyWindow()
    if window.ide_focused:
        window.show()

    def handle_sig(_signum: int, _frame: Any) -> None:
        QApplication.quit()

    signal.signal(signal.SIGTERM, handle_sig)
    signal.signal(signal.SIGINT, handle_sig)
    try:
        return app.exec_()
    finally:
        window.ide_tracker.close()


def acquire_single_instance(lock_path: Path, pid_path: Path, replace: bool = False) -> Optional[Any]:
    """Acquire non-blocking file lock so only one floating buddy exists across IDE windows."""
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    if replace and pid_path.exists():
        try:
            old_pid = int(pid_path.read_text(encoding="utf-8").strip())
            if old_pid != os.getpid():
                os.kill(old_pid, signal.SIGTERM)
                time.sleep(0.25)
        except Exception:
            pass

    handle = open(lock_path, "a+", encoding="utf-8")
    try:
        if fcntl is not None:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        elif msvcrt is not None:
            handle.seek(0, os.SEEK_END)
            if handle.tell() == 0:
                handle.write("1")
                handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        handle.close()
        return None

    pid_path.write_text(str(os.getpid()), encoding="utf-8")
    return handle


def parse_args(argv: Optional[list] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Agy Pixel Buddy floating desktop overlay")
    parser.add_argument("--state-file", default=str(DEFAULT_STATE_PATH))
    parser.add_argument("--workspaces-file", default=str(DEFAULT_WORKSPACES_PATH))
    parser.add_argument("--config-file", default=str(DEFAULT_CONFIG_PATH))
    parser.add_argument("--lock-file", default=str(DEFAULT_LOCK_PATH))
    parser.add_argument("--pid-file", default=str(DEFAULT_PID_PATH))
    parser.add_argument("--character", default="cat", choices=VALID_CHARS)
    parser.add_argument("--trainer", default="boss", choices=VALID_TRAINERS)
    parser.add_argument("--mode", default="random", choices=VALID_MODES)
    parser.add_argument("--language", default="id", choices=VALID_LANGS)
    parser.add_argument("--prompt-reaction", dest="prompt_reaction", action="store_true", default=True)
    parser.add_argument("--no-prompt-reaction", dest="prompt_reaction", action="store_false")
    parser.add_argument("--reaction-trigger", default="hook", choices=VALID_REACTION_TRIGGERS)
    parser.add_argument("--idle-timeout", type=int, default=120_000)
    parser.add_argument("--replace", action="store_true")
    return parser.parse_args(argv)


def main() -> int:
    args = parse_args()
    lock_handle = acquire_single_instance(
        Path(args.lock_file), Path(args.pid_file), replace=args.replace
    )
    if lock_handle is None:
        return 0
    try:
        return run_gui(args)
    finally:
        try:
            Path(args.pid_file).unlink(missing_ok=True)
        except Exception:
            pass
        try:
            if fcntl is not None:
                fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)
            elif msvcrt is not None:
                lock_handle.seek(0)
                msvcrt.locking(lock_handle.fileno(), msvcrt.LK_UNLCK, 1)
            lock_handle.close()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
