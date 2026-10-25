import { useCallback, useEffect, useRef, useState } from "react";
import { APP } from "@/lib/assessment/config";

export interface ProctorEvent {
  type: string;
  label: string;
  at: number;
}

export interface ProctorState {
  strikes: number;
  tabSwitches: number;
  fullscreenExits: number;
  pasteBlocks: number;
  shortcutBlocks: number;
  events: ProctorEvent[];
  terminated: boolean;
}

const LABELS: Record<string, string> = {
  tab_switch: "Tab/window switch detected",
  fullscreen_exit: "Exited fullscreen",
  shortcut_block: "Blocked shortcut attempt",
  paste_block: "Blocked paste attempt",
  camera_no_face: "Face not visible on camera",
  camera_multiple_faces: "Multiple faces detected",
  camera_gaze: "Looking away from screen",
  camera_error: "Camera unavailable",
};

const initialState: ProctorState = {
  strikes: 0,
  tabSwitches: 0,
  fullscreenExits: 0,
  pasteBlocks: 0,
  shortcutBlocks: 0,
  events: [],
  terminated: false,
};

export function useProctor(active: boolean, onTerminate: () => void) {
  const [state, setState] = useState<ProctorState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastTabEvent = useRef(0);
  const onTerminateRef = useRef(onTerminate);
  onTerminateRef.current = onTerminate;

  const logViolation = useCallback((type: string, strike = false) => {
    const prev = stateRef.current;
    if (prev.terminated) return;
    const strikes = strike ? prev.strikes + 1 : prev.strikes;
    const next: ProctorState = {
      ...prev,
      strikes,
      tabSwitches: type === "tab_switch" ? prev.tabSwitches + 1 : prev.tabSwitches,
      fullscreenExits: type === "fullscreen_exit" ? prev.fullscreenExits + 1 : prev.fullscreenExits,
      pasteBlocks: type === "paste_block" ? prev.pasteBlocks + 1 : prev.pasteBlocks,
      shortcutBlocks: type === "shortcut_block" ? prev.shortcutBlocks + 1 : prev.shortcutBlocks,
      events: [...prev.events, { type, label: LABELS[type] ?? type, at: Date.now() }].slice(-200),
      terminated: strikes >= APP.maxStrikes,
    };
    stateRef.current = next;
    setState(next);
    if (next.terminated) onTerminateRef.current();
  }, []);

  useEffect(() => {
    if (!active) return;
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    const onFsChange = () => {
      if (!document.fullscreenElement) logViolation("fullscreen_exit", true);
    };
    const onVisibility = () => {
      if (document.hidden) {
        const now = Date.now();
        if (now - lastTabEvent.current > 1000) {
          lastTabEvent.current = now;
          logViolation("tab_switch", true);
        }
      }
    };
    const onBlur = () => {
      const now = Date.now();
      if (now - lastTabEvent.current > 1000) {
        lastTabEvent.current = now;
        logViolation("tab_switch", true);
      }
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const blockedCombo = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === "F12") return true;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k)) return true;
      if ((e.ctrlKey || e.metaKey) && ["u", "s", "p"].includes(k)) return true;
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "a", "x"].includes(k)) return true;
      return false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (blockedCombo(e)) {
        e.preventDefault();
        e.stopPropagation();
        logViolation(e.key === "F12" || e.key.toLowerCase() === "i" || e.key.toLowerCase() === "j" || e.key.toLowerCase() === "c" || e.key.toLowerCase() === "u" ? "shortcut_block" : "shortcut_block");
      }
    };
    const onCopyCutPaste = (e: Event) => {
      e.preventDefault();
      if (e.type === "paste") logViolation("paste_block");
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("copy", onCopyCutPaste);
    document.addEventListener("cut", onCopyCutPaste);
    document.addEventListener("paste", onCopyCutPaste);

    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("copy", onCopyCutPaste);
      document.removeEventListener("cut", onCopyCutPaste);
      document.removeEventListener("paste", onCopyCutPaste);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [active, logViolation]);

  return { proctor: state, logViolation };
}
