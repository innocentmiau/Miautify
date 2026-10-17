import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PlayOrder } from "../src/renderer/play-order.ts";
import type { RepeatMode } from "../src/shared/library.ts";
import { seeded } from "./seeded-random.ts";

const list = ["a", "b", "c", "d", "e", "f"];
const none = () => false;
const broken = (item: string) => item.startsWith("x");

function order({ shuffle = false, repeat = "off" as RepeatMode, seed = 1 } = {}) {
  const playOrder = new PlayOrder<string>({ key: (item) => item, random: seeded(seed) });
  playOrder.shuffle = shuffle;
  playOrder.repeat = repeat;
  return playOrder;
}

// Presses next until the end (or `limit` songs), returning what played after the current.
function playAll(playOrder: PlayOrder<string>, limit = 100): string[] {
  const played: string[] = [];
  while (played.length < limit) {
    const item = playOrder.next(none);
    if (item === null) {
      break;
    }
    played.push(item);
  }
  return played;
}

describe("PlayOrder without shuffle", () => {
  it("plays the list in order from the chosen song, then stops", () => {
    const playOrder = order();
    playOrder.start(list, 2);
    assert.equal(playOrder.current, "c");
    assert.deepEqual(playAll(playOrder), ["d", "e", "f"]);
    assert.equal(playOrder.hasNext(none), false);
  });

  it("can't go back before the chosen song", () => {
    const playOrder = order();
    playOrder.start(list, 2);
    assert.equal(playOrder.hasPrevious(none), false);
    assert.equal(playOrder.previous(none), null);
  });
});

describe("PlayOrder with shuffle", () => {
  it("plays the chosen song first, then every other song of the whole list once", () => {
    const playOrder = order({ shuffle: true });
    playOrder.start(list, 2);
    assert.equal(playOrder.current, "c");
    const rest = playAll(playOrder);
    assert.deepEqual([...rest].sort(), ["a", "b", "d", "e", "f"]);
  });

  it("goes back through what actually played", () => {
    const playOrder = order({ shuffle: true });
    playOrder.start(list, 0);
    const first = playOrder.next(none);
    const second = playOrder.next(none);
    assert.notEqual(second, null);
    assert.equal(playOrder.previous(none), first);
    assert.equal(playOrder.previous(none), "a");
  });

  it("deals recently heard songs last", () => {
    const playOrder = order({ shuffle: true });
    // b was heard most recently, then e: with 6 songs, 30% is 1 song, so b goes last.
    playOrder.notePlayed("e", 1);
    playOrder.notePlayed("b", 2);
    playOrder.start(list, 0);
    assert.equal(playAll(playOrder).at(-1), "b");
  });
});

describe("Turning shuffle on and off while playing", () => {
  it("on: keeps the current song and shuffles the songs not played yet", () => {
    const playOrder = order();
    playOrder.start(list, 1); // b
    playOrder.next(none); // c
    playOrder.setShuffle(true);
    assert.equal(playOrder.current, "c");
    // Everything but b and c, including a (before the chosen song).
    assert.deepEqual([...playAll(playOrder)].sort(), ["a", "d", "e", "f"]);
  });

  it("off: carries on in list order after the current song", () => {
    const playOrder = order({ shuffle: true });
    playOrder.start(list, 0);
    const current = playOrder.next(none);
    playOrder.setShuffle(false);
    assert.deepEqual(playAll(playOrder), list.slice(list.indexOf(current ?? "") + 1));
  });

  it("previous still goes back through what played", () => {
    const playOrder = order();
    playOrder.start(list, 0);
    playOrder.next(none); // b
    playOrder.setShuffle(true);
    playOrder.next(none);
    assert.equal(playOrder.previous(none), "b");
  });
});

describe("PlayOrder with repeat", () => {
  it("all: plays the whole list again from the top after the end", () => {
    const playOrder = order({ repeat: "all" });
    playOrder.start(list, 4); // e
    assert.deepEqual(playAll(playOrder, 8), ["f", "a", "b", "c", "d", "e", "f", "a"]);
  });

  it("all with shuffle: every round plays each song once", () => {
    const playOrder = order({ shuffle: true, repeat: "all" });
    playOrder.start(list, 0);
    for (let round = 0; round < 3; round++) {
      // Each round is a new deck of all 6, so any 6 in a row after the first are all of them.
      const songs = [playOrder.current, ...playAll(playOrder, 5)];
      assert.deepEqual([...songs].sort(), list, `round ${round}`);
      playOrder.next(none);
    }
  });

  it("all with shuffle: a new round doesn't start with the song that just ended", () => {
    for (let seed = 0; seed < 30; seed++) {
      const playOrder = order({ shuffle: true, repeat: "all", seed });
      playOrder.start(["a", "b"], 0);
      playOrder.notePlayed("a", 1);
      playOrder.next(none); // b
      playOrder.notePlayed("b", 2);
      assert.equal(playOrder.next(none), "a", `seed ${seed}`);
    }
  });

  it("one: the song starts over when it ends, but next still moves on", () => {
    const playOrder = order({ repeat: "one" });
    playOrder.start(list, 0);
    assert.equal(playOrder.afterEnd(none), "a");
    assert.equal(playOrder.next(none), "b");
  });

  it("one: next at the end of the list starts it again", () => {
    const playOrder = order({ repeat: "one" });
    playOrder.start(list, 5);
    assert.equal(playOrder.hasNext(none), true);
    assert.equal(playOrder.next(none), "a");
  });

  it("off: the end of the list is the end", () => {
    const playOrder = order();
    playOrder.start(list, 5);
    assert.equal(playOrder.afterEnd(none), null);
  });
});

describe("Clearing the PlayOrder", () => {
  it("forgets the current song and what played", () => {
    const playOrder = order({ repeat: "all" });
    playOrder.start(list, 0);
    playOrder.next(none);
    playOrder.clear();
    assert.equal(playOrder.current, null);
    assert.equal(playOrder.hasNext(none), false);
    assert.equal(playOrder.hasPrevious(none), false);
    assert.equal(playOrder.next(none), null);
  });
});

describe("PlayOrder with songs that can't play", () => {
  it("starts at the next song that can play", () => {
    const playOrder = order();
    assert.equal(playOrder.start(["x1", "a", "b"], 0, broken), "a");
    assert.equal(playOrder.current, "a");
  });

  it("leaves everything as it was when nothing can play", () => {
    const playOrder = order();
    playOrder.start(list, 0);
    playOrder.next(none); // b
    assert.equal(playOrder.start(["x1", "x2"], 0, broken), null);
    assert.equal(playOrder.current, "b");
    assert.equal(playOrder.next(none), "c");
  });

  it("skips them, also when starting a new round", () => {
    const playOrder = order({ repeat: "all" });
    playOrder.start(["x1", "a", "x2"], 1);
    assert.equal(playOrder.next(broken), "a");
    assert.equal(playOrder.next(broken), "a");
  });

  it("doesn't add rounds when nothing can play", () => {
    const playOrder = order({ repeat: "all" });
    playOrder.start(["x1", "x2"], 0);
    assert.equal(playOrder.hasNext(broken), false);
    assert.equal(playOrder.next(broken), null);
  });

  it("repeat one doesn't replay a song that can't play", () => {
    const playOrder = order({ repeat: "one" });
    playOrder.start(["x1", "a"], 0);
    assert.equal(playOrder.afterEnd(broken), "a");
  });
});
