import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isWindowState, placeWindow } from "../src/main/window-state.ts";

const min = { width: 480, height: 320 };
const laptop = { x: 0, y: 0, width: 1920, height: 1040 };
const rightMonitor = { x: 1920, y: 0, width: 2560, height: 1400 };

describe("placeWindow", () => {
  it("keeps the saved place and size when they fit the screen", () => {
    const saved = { x: 100, y: 80, width: 1200, height: 800 };
    assert.deepEqual(placeWindow(saved, [laptop], min), saved);
  });

  it("keeps a place on a second screen", () => {
    const saved = { x: 2200, y: 100, width: 1600, height: 900 };
    assert.deepEqual(placeWindow(saved, [laptop, rightMonitor], min), saved);
  });

  it("drops the place when its screen is gone, and fits the size to the main screen", () => {
    const saved = { x: 2200, y: 100, width: 2400, height: 1300 };
    assert.deepEqual(placeWindow(saved, [laptop], min), { width: 1920, height: 1040 });
  });

  it("drops the place when only a sliver of the window would show", () => {
    const saved = { x: 1880, y: 100, width: 800, height: 600 };
    assert.deepEqual(placeWindow(saved, [laptop], min), { width: 800, height: 600 });
  });

  it("shrinks a window bigger than its screen, but never below the minimum", () => {
    const small = { x: 0, y: 0, width: 400, height: 300 };
    assert.deepEqual(placeWindow({ x: 0, y: 0, width: 1000, height: 700 }, [small], min), {
      x: 0,
      y: 0,
      width: 480,
      height: 320,
    });
  });
});

describe("isWindowState", () => {
  it("accepts a saved state", () => {
    assert.ok(isWindowState({ bounds: { x: 0, y: 0, width: 800, height: 600 }, maximized: false }));
  });

  it("rejects anything else", () => {
    for (const value of [
      null,
      "big",
      { maximized: true },
      { bounds: { x: 0, y: 0, width: 800 }, maximized: false },
      { bounds: { x: 0, y: 0, width: 800, height: 600 }, maximized: "yes" },
    ]) {
      assert.equal(isWindowState(value), false, JSON.stringify(value));
    }
  });
});
