// The keyboard shortcuts: one table, used both to react to keys and to list them in the
// "Keyboard shortcuts" window, so the list can't drift from what the keys actually do.
//
// Pure logic with no page code, so it's unit tested in test/shortcuts.test.ts.

export type Action =
  | "togglePlay"
  | "seekBack"
  | "seekForward"
  | "previous"
  | "next"
  | "volumeUp"
  | "volumeDown"
  | "toggleMute"
  | "parentFolder"
  | "showShortcuts"
  | "openSettings";

export interface Shortcut {
  action: Action;
  // KeyboardEvent.key: " " for Space, "ArrowLeft", a letter in lowercase, "?".
  key: string;
  // Needs Ctrl held down.
  ctrl?: boolean;
}

export const shortcuts: readonly Shortcut[] = [
  { action: "togglePlay", key: " " },
  { action: "seekBack", key: "ArrowLeft" },
  { action: "seekForward", key: "ArrowRight" },
  { action: "previous", key: "ArrowLeft", ctrl: true },
  { action: "next", key: "ArrowRight", ctrl: true },
  { action: "volumeUp", key: "ArrowUp", ctrl: true },
  { action: "volumeDown", key: "ArrowDown", ctrl: true },
  { action: "toggleMute", key: "m" },
  { action: "parentFolder", key: "Backspace" },
  { action: "showShortcuts", key: "?" },
  { action: "openSettings", key: ",", ctrl: true },
];

// The parts of a KeyboardEvent that matter here (a real KeyboardEvent fits this).
export interface KeyPress {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

// The action for a key press, or null if it isn't a shortcut.
//
// Ctrl must match exactly (← seeks, Ctrl+← changes song). Presses with Alt or the
// Super/Windows key are left alone: those belong to the system. Shift is ignored, because
// on most layouts "?" already needs Shift, and M with Caps Lock or Shift is still M.
export function actionFor(press: KeyPress): Action | null {
  if (press.altKey || press.metaKey) {
    return null;
  }
  const key = press.key.length === 1 ? press.key.toLowerCase() : press.key;
  const match = shortcuts.find(
    (shortcut) => shortcut.key === key && (shortcut.ctrl ?? false) === press.ctrlKey,
  );
  return match?.action ?? null;
}
