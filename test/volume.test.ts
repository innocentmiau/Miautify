import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampLevel, defaultLevel, levelToGain } from "../src/renderer/volume.ts";

describe("levelToGain", () => {
  it("keeps silence silent and full volume full", () => {
    assert.equal(levelToGain(0), 0);
    assert.equal(levelToGain(1), 1);
  });

  it("follows a squared curve", () => {
    assert.equal(levelToGain(0.5), 0.25);
    assert.equal(levelToGain(0.8).toFixed(2), "0.64");
  });

  it("clamps levels outside 0 to 1", () => {
    assert.equal(levelToGain(-0.5), 0);
    assert.equal(levelToGain(3), 1);
  });
});

describe("clampLevel", () => {
  it("falls back to the default for values that aren't numbers", () => {
    assert.equal(clampLevel(Number.NaN), defaultLevel);
    assert.equal(clampLevel(Number.POSITIVE_INFINITY), defaultLevel);
  });
});
