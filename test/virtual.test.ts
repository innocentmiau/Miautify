import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { visibleRange } from "../src/renderer/virtual.ts";

describe("visibleRange", () => {
  it("draws the first screen at the top", () => {
    // 10 rows of 30 px fit in 300 px.
    assert.deepEqual(visibleRange(0, 300, 30, 1000, 0), { start: 0, end: 10 });
  });

  it("adds overscan rows, but not past the start", () => {
    assert.deepEqual(visibleRange(0, 300, 30, 1000, 5), { start: 0, end: 15 });
  });

  it("follows the scroll position", () => {
    // Scrolled to row 100 exactly.
    assert.deepEqual(visibleRange(3000, 300, 30, 1000, 5), { start: 95, end: 115 });
  });

  it("includes a row that is only partly visible", () => {
    // Scrolled 10 px into row 100: rows 100 to 110 are (partly) on screen.
    assert.deepEqual(visibleRange(3010, 300, 30, 1000, 0), { start: 100, end: 111 });
  });

  it("stops at the last row", () => {
    assert.deepEqual(visibleRange(29_900, 300, 30, 1000, 5), { start: 991, end: 1000 });
  });

  it("handles a list shorter than the screen", () => {
    assert.deepEqual(visibleRange(0, 300, 30, 3, 5), { start: 0, end: 3 });
  });

  it("draws nothing for an empty list", () => {
    assert.deepEqual(visibleRange(500, 300, 30, 0, 5), { start: 0, end: 0 });
  });

  it("treats overscroll past the top as the top", () => {
    assert.deepEqual(visibleRange(-50, 300, 30, 1000, 0), { start: 0, end: 10 });
  });
});
