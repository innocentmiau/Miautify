import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { middleWidth } from "../src/renderer/player-bar-layout.ts";

// Buttons 200px wide, each side needs 300px to be full: the middle starts growing at 800px.
const sizes = (available: number) => ({ available, buttons: 200, side: 300 });

describe("middleWidth", () => {
  it("keeps the buttons' width until both sides are full", () => {
    assert.equal(middleWidth(sizes(500)), 200);
    assert.equal(middleWidth(sizes(800)), 200);
  });

  it("then takes a quarter of every extra pixel", () => {
    assert.equal(middleWidth(sizes(1200)), 300);
    assert.equal(middleWidth(sizes(2800)), 700);
  });

  it("never leaves the sides less than they need", () => {
    for (const available of [800, 1000, 1500, 4000]) {
      const side = (available - middleWidth(sizes(available))) / 2;
      assert.ok(side >= 300, `available ${available}`);
    }
  });
});
