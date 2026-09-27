// A fixed play order and a position in it. Next and previous only move the position, so
// previous always goes back to the song that actually played before.
//
// Pure logic with no audio or page code (and no imports), so it can be unit tested
// directly with Node: see test/queue.test.ts.
export class Queue<T> {
  readonly #items: readonly T[];
  #position = 0;

  constructor(items: readonly T[]) {
    if (items.length === 0) {
      throw new RangeError("A queue needs at least one item.");
    }
    this.#items = items;
  }

  get current(): T {
    return this.#items[this.#position];
  }

  get position(): number {
    return this.#position;
  }

  get hasNext(): boolean {
    return this.#position < this.#items.length - 1;
  }

  get hasPrevious(): boolean {
    return this.#position > 0;
  }

  // Moves to the next item and returns it, or returns null at the end (without moving).
  next(): T | null {
    if (!this.hasNext) {
      return null;
    }
    this.#position++;
    return this.current;
  }

  // Moves to the previous item and returns it, or returns null at the start (without moving).
  previous(): T | null {
    if (!this.hasPrevious) {
      return null;
    }
    this.#position--;
    return this.current;
  }
}
