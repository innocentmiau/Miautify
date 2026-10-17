import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitColumns } from "../src/renderer/column-widths.ts";

const even = (...needs: number[]) => needs.map((need) => ({ need, weight: 1 }));
const sum = (widths: number[]) => widths.reduce((total, width) => total + width, 0);

describe("fitColumns", () => {
  it("stops growing a column once its text fits, giving the rest to the others", () => {
    assert.deepEqual(fitColumns(even(50, 400, 400), 300), [50, 125, 125]);
  });

  it("shares what's left over once every column fits", () => {
    assert.deepEqual(fitColumns(even(50, 60, 70), 300), [90, 100, 110]);
  });

  it("splits by weight when nothing fits", () => {
    const widths = fitColumns(
      [
        { need: 1000, weight: 3 },
        { need: 1000, weight: 2 },
        { need: 1000, weight: 2 },
      ],
      700,
    );
    assert.deepEqual(widths, [300, 200, 200]);
  });

  it("lets a heavier column grow faster, but not past what it needs", () => {
    // Title (weight 3) needs 240, so it's full at 240; artist and album share the rest.
    const widths = fitColumns(
      [
        { need: 240, weight: 3 },
        { need: 500, weight: 2 },
        { need: 500, weight: 2 },
      ],
      700,
    );
    assert.deepEqual(widths, [240, 230, 230]);
  });

  it("works in any column order", () => {
    assert.deepEqual(fitColumns(even(400, 50, 400), 300), [125, 50, 125]);
  });

  it("always adds up to the room available", () => {
    for (const available of [0, 1, 99, 250, 1234]) {
      const widths = fitColumns(even(10, 80, 300, 45), available);
      assert.ok(Math.abs(sum(widths) - available) < 1e-9, `available ${available}`);
    }
  });

  it("gives nothing when there's no room", () => {
    assert.deepEqual(fitColumns(even(10, 20), -5), [0, 0]);
    assert.deepEqual(fitColumns([], 100), []);
  });
});
