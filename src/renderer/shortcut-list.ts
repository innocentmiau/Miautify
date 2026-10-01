import type { TFunction } from "i18next";
import { type Shortcut, shortcuts } from "./shortcuts.js";

// The list of keyboard shortcuts as keycaps and what they do, built from the same table the
// keys use (shortcuts.ts). Shown in Settings and in the quick "?" window.
export function shortcutList(t: TFunction): HTMLDListElement {
  const list = document.createElement("dl");
  list.className = "shortcut-list";
  for (const shortcut of shortcuts) {
    const keys = document.createElement("dt");
    keys.append(...keyLabels(t, shortcut));
    const description = document.createElement("dd");
    description.textContent = t(`shortcuts.${shortcut.action}`);
    list.append(keys, description);
  }
  return list;
}

// A shortcut's keys as <kbd> elements: Ctrl, then the key. Key names are translated
// (German keyboards say "Strg", not "Ctrl").
function keyLabels(t: TFunction, shortcut: Shortcut): HTMLElement[] {
  const names: string[] = shortcut.ctrl ? [t("keys.ctrl")] : [];
  const arrows: Record<string, string> = {
    ArrowLeft: "←",
    ArrowRight: "→",
    ArrowUp: "↑",
    ArrowDown: "↓",
  };
  if (shortcut.key === " ") {
    names.push(t("keys.space"));
  } else if (shortcut.key === "Backspace") {
    names.push(t("keys.backspace"));
  } else {
    names.push(arrows[shortcut.key] ?? shortcut.key.toUpperCase());
  }
  return names.map((name) => {
    const kbd = document.createElement("kbd");
    kbd.textContent = name;
    return kbd;
  });
}
