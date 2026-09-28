import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Queue } from "../src/renderer/queue.ts";

describe("Queue", () => {
  it("starts at the first item", () => {
    const queue = new Queue(["a", "b", "c"]);
    assert.equal(queue.current, "a");
    assert.equal(queue.position, 0);
  });

  it("can't go to previous at the start", () => {
    const queue = new Queue(["a", "b", "c"]);
    assert.equal(queue.hasPrevious, false);
    assert.equal(queue.previous(), null);
    assert.equal(queue.current, "a");
  });

  it("moves forward and back one item at a time", () => {
    const queue = new Queue(["a", "b", "c"]);
    assert.equal(queue.next(), "b");
    assert.equal(queue.next(), "c");
    assert.equal(queue.previous(), "b");
    assert.equal(queue.previous(), "a");
    assert.equal(queue.position, 0);
  });

  it("stops at the end instead of wrapping around", () => {
    const queue = new Queue(["a", "b"]);
    queue.next();
    assert.equal(queue.hasNext, false);
    assert.equal(queue.next(), null);
    assert.equal(queue.current, "b");
  });

  it("works with a single item", () => {
    const queue = new Queue(["a"]);
    assert.equal(queue.hasNext, false);
    assert.equal(queue.hasPrevious, false);
  });

  it("rejects an empty list", () => {
    assert.throws(() => new Queue([]), RangeError);
  });

  it("previous goes back to what played before, even with repeated items", () => {
    const queue = new Queue(["a", "b", "a", "c"]);
    queue.next();
    queue.next();
    queue.next();
    assert.deepEqual([queue.previous(), queue.previous(), queue.previous()], ["a", "b", "a"]);
  });

  describe("skipping items", () => {
    const broken = (item: string) => item.startsWith("x");

    it("steps over skipped items going forward", () => {
      const queue = new Queue(["a", "x1", "x2", "b"]);
      assert.equal(queue.next(broken), "b");
      assert.equal(queue.position, 3);
    });

    it("steps over skipped items going back", () => {
      const queue = new Queue(["a", "x1", "b"]);
      queue.next(broken);
      assert.equal(queue.previous(broken), "a");
    });

    it("doesn't move when only skipped items are left", () => {
      const queue = new Queue(["a", "x1", "x2"]);
      assert.equal(queue.next(broken), null);
      assert.equal(queue.current, "a");
      assert.equal(queue.hasNextMatching(broken), false);
      assert.equal(queue.hasNext, true); // There are items, just none worth playing.
    });

    it("tells whether a playable item is before or after", () => {
      const queue = new Queue(["x1", "a", "x2"]);
      queue.next(broken);
      assert.equal(queue.hasPreviousMatching(broken), false);
      assert.equal(queue.hasNextMatching(broken), false);
    });
  });
});
