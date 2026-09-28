import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { actionFor, type KeyPress, shortcuts } from "../src/renderer/shortcuts.ts";

function press(key: string, modifiers: Partial<Omit<KeyPress, "key">> = {}): KeyPress {
  return { key, ctrlKey: false, altKey: false, metaKey: false, ...modifiers };
}

describe("actionFor", () => {
  it("maps plain keys", () => {
    assert.equal(actionFor(press(" ")), "togglePlay");
    assert.equal(actionFor(press("ArrowLeft")), "seekBack");
    assert.equal(actionFor(press("ArrowRight")), "seekForward");
    assert.equal(actionFor(press("Backspace")), "parentFolder");
  });

  it("tells arrows with and without Ctrl apart", () => {
    assert.equal(actionFor(press("ArrowLeft", { ctrlKey: true })), "previous");
    assert.equal(actionFor(press("ArrowRight", { ctrlKey: true })), "next");
    assert.equal(actionFor(press("ArrowUp", { ctrlKey: true })), "volumeUp");
    assert.equal(actionFor(press("ArrowDown", { ctrlKey: true })), "volumeDown");
  });

  it("leaves plain up and down alone, for scrolling the list", () => {
    assert.equal(actionFor(press("ArrowUp")), null);
    assert.equal(actionFor(press("ArrowDown")), null);
  });

  it("matches letters in either case", () => {
    assert.equal(actionFor(press("m")), "toggleMute");
    assert.equal(actionFor(press("M")), "toggleMute");
    assert.equal(actionFor(press("?")), "showShortcuts");
  });

  it("ignores Ctrl on keys that don't use it, and Alt or Super on all keys", () => {
    assert.equal(actionFor(press("m", { ctrlKey: true })), null);
    assert.equal(actionFor(press(" ", { altKey: true })), null);
    assert.equal(actionFor(press("ArrowLeft", { metaKey: true })), null);
  });

  it("ignores keys that aren't shortcuts", () => {
    assert.equal(actionFor(press("a")), null);
    assert.equal(actionFor(press("Enter")), null);
  });

  it("has no two shortcuts on the same keys", () => {
    const combos = shortcuts.map((s) => `${s.ctrl ? "ctrl+" : ""}${s.key}`);
    assert.equal(new Set(combos).size, combos.length);
  });
});
