import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shuffleDeck, shuffled } from "../src/renderer/shuffle.ts";
import { seeded } from "./seeded-random.ts";

const letters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
const sameKey = (item: string) => item;

describe("shuffled", () => {
  it("returns the same items in a new array, leaving the original alone", () => {
    const result = shuffled(letters, seeded(1));
    assert.deepEqual([...result].sort(), letters);
    assert.deepEqual(letters, ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
  });

  it("makes every order about equally likely", () => {
    // 3 items have 6 orders. 60,000 shuffles: each should come up close to 10,000 times.
    const counts = new Map<string, number>();
    const random = seeded(7);
    for (let i = 0; i < 60_000; i++) {
      const order = shuffled(["a", "b", "c"], random).join("");
      counts.set(order, (counts.get(order) ?? 0) + 1);
    }
    assert.equal(counts.size, 6);
    for (const count of counts.values()) {
      assert.ok(count > 9_000 && count < 11_000, `count ${count}`);
    }
  });
});

describe("shuffleDeck", () => {
  it("puts the most recently played songs last, the latest at the very end", () => {
    // 10 songs: the 3 played most recently (30%) go to the back.
    const lastPlayed = new Map([
      ["a", 1],
      ["b", 5],
      ["c", 3],
      ["d", 4],
      ["e", 2],
    ]);
    const deck = shuffleDeck(letters, sameKey, lastPlayed, seeded(3));
    assert.deepEqual(deck.slice(-3), ["c", "d", "b"]);
    assert.deepEqual([...deck].sort(), letters);
  });

  it("shuffles everything when nothing was played", () => {
    const deck = shuffleDeck(letters, sameKey, new Map(), seeded(3));
    assert.deepEqual([...deck].sort(), letters);
  });

  it("keeps the last song played at the back even in a short list", () => {
    // 3 songs: 30% rounds down to 0, but the song just heard still goes last.
    for (let seed = 0; seed < 20; seed++) {
      const deck = shuffleDeck(["a", "b", "c"], sameKey, new Map([["b", 1]]), seeded(seed));
      assert.equal(deck.at(-1), "b");
    }
  });

  it("works with one song or none", () => {
    assert.deepEqual(shuffleDeck(["a"], sameKey, new Map([["a", 1]])), ["a"]);
    assert.deepEqual(shuffleDeck([], sameKey, new Map()), []);
  });
});
