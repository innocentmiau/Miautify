// .ts, not .js: the tests run this file directly with Node, which only finds it by its real
// name (esbuild accepts both).

import type { RepeatMode } from "../shared/library.js";
import { Queue } from "./queue.ts";
import { shuffleDeck } from "./shuffle.ts";

// What plays next: the list a song was started from, with shuffle and repeat applied.
//
// - Shuffle off: the list in order, starting at the chosen song.
// - Shuffle on: the chosen song, then the rest of the whole list as a shuffled deck, so
//   every song plays once before any comes back (see shuffle.ts).
// - Repeat "all": at the end, another round of the whole list (reshuffled when shuffling).
// - Repeat "one": the song starts over when it ends. Next and previous still move.
//
// It all sits on a Queue, so previous always goes back through what actually played,
// across shuffles and rounds.
//
// Pure logic, generic over the item type, so it's unit tested in test/play-order.test.ts.

// Items for which this returns true are stepped over (files that can't play).
type Skip<T> = (item: T) => boolean;

export interface PlayOrderOptions<T> {
  // Identifies an item in `lastPlayed`.
  key: (item: T) => string;
  // For the tests; Math.random otherwise.
  random?: () => number;
}

export class PlayOrder<T> {
  readonly #key: (item: T) => string;
  readonly #random: () => number;
  // When each item last started playing, by key. Shuffles put recent ones last.
  readonly lastPlayed = new Map<string, number>();
  shuffle = false;
  repeat: RepeatMode = "off";
  // The list as shown when a song was started, in its own order.
  #list: readonly T[] = [];
  #queue: Queue<T> | null = null;
  // Where the current round started in the queue. Turning shuffle on deals out the songs
  // this round hasn't played yet.
  #roundStart = 0;

  constructor({ key, random = Math.random }: PlayOrderOptions<T>) {
    this.#key = key;
    this.#random = random;
  }

  get current(): T | null {
    return this.#queue?.current ?? null;
  }

  // Starts playing `list` from `list[index]`, or from the next item that `skip` doesn't
  // step over. Returns the item to play. If nothing can play, returns null and leaves
  // everything as it was (whatever was playing carries on).
  start(list: readonly T[], index: number, skip: Skip<T> = () => false): T | null {
    const before = { list: this.#list, queue: this.#queue, roundStart: this.#roundStart };
    this.#list = list;
    const first = list[index];
    const rest = this.shuffle ? this.#deck(without(list, [first])) : list.slice(index + 1);
    this.#queue = new Queue([first, ...rest]);
    this.#roundStart = 0;
    if (!skip(first)) {
      return first;
    }
    const playable = this.next(skip);
    if (playable === null) {
      this.#list = before.list;
      this.#queue = before.queue;
      this.#roundStart = before.roundStart;
    }
    return playable;
  }

  // Next (the button): the next item, or null at the end without repeat. With repeat
  // (all or one), the end starts another round.
  next(skip: Skip<T>): T | null {
    const queue = this.#queue;
    if (!queue) {
      return null;
    }
    // Only when something in the list can play, or every press would add a round.
    if (!queue.hasNextMatching(skip) && this.hasNext(skip)) {
      this.#newRound();
    }
    return queue.next(skip);
  }

  // A song ended: with repeat "one" it plays again, otherwise this is next().
  afterEnd(skip: Skip<T>): T | null {
    const current = this.current;
    if (this.repeat === "one" && current !== null && !skip(current)) {
      return current;
    }
    return this.next(skip);
  }

  previous(skip: Skip<T>): T | null {
    return this.#queue?.previous(skip) ?? null;
  }

  hasNext(skip: Skip<T>): boolean {
    if (!this.#queue) {
      return false;
    }
    return (
      this.#queue.hasNextMatching(skip) ||
      (this.repeat !== "off" && this.#list.some((item) => !skip(item)))
    );
  }

  hasPrevious(skip: Skip<T>): boolean {
    return this.#queue?.hasPreviousMatching(skip) ?? false;
  }

  // Turns shuffle on or off while playing. The current song keeps playing and what played
  // stays as it was; only what comes next changes. On: the songs this round hasn't played
  // yet, shuffled. Off: the list in order, after the current song.
  setShuffle(on: boolean): void {
    this.shuffle = on;
    const queue = this.#queue;
    if (!queue) {
      return;
    }
    if (on) {
      const playedThisRound = queue.played.slice(this.#roundStart);
      queue.setUpcoming(this.#deck(without(this.#list, playedThisRound)));
    } else {
      const index = this.#list.indexOf(queue.current);
      queue.setUpcoming(index >= 0 ? this.#list.slice(index + 1) : []);
    }
  }

  // Forgets the list and what played, as if nothing had been started.
  clear(): void {
    this.#list = [];
    this.#queue = null;
    this.#roundStart = 0;
  }

  // Remembers that `item` started playing now.
  notePlayed(item: T, time = Date.now()): void {
    this.lastPlayed.set(this.#key(item), time);
  }

  // The whole list again, after what's left: shuffled again, or in order.
  #newRound(): void {
    const queue = this.#queue;
    if (!queue) {
      return;
    }
    const round = this.shuffle ? this.#deck(this.#list) : this.#list;
    this.#roundStart = queue.played.length + queue.upcoming.length;
    queue.setUpcoming([...queue.upcoming, ...round]);
  }

  #deck(items: readonly T[]): T[] {
    return shuffleDeck(items, this.#key, this.lastPlayed, this.#random);
  }
}

// `items` without the ones in `remove`.
function without<T>(items: readonly T[], remove: readonly T[]): T[] {
  const removed = new Set(remove);
  return items.filter((item) => !removed.has(item));
}
