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
  // Items for which `skip` returns true are stepped over, like files that can't play.
  next(skip: (item: T) => boolean = () => false): T | null {
    return this.#move(1, skip);
  }

  // Moves to the previous item and returns it, or returns null at the start (without
  // moving). Items for which `skip` returns true are stepped over.
  previous(skip: (item: T) => boolean = () => false): T | null {
    return this.#move(-1, skip);
  }

  // Whether there is a next or previous item that `skip` doesn't step over.
  hasNextMatching(skip: (item: T) => boolean): boolean {
    return this.#find(1, skip) !== null;
  }

  hasPreviousMatching(skip: (item: T) => boolean): boolean {
    return this.#find(-1, skip) !== null;
  }

  #move(step: 1 | -1, skip: (item: T) => boolean): T | null {
    const position = this.#find(step, skip);
    if (position === null) {
      return null;
    }
    this.#position = position;
    return this.current;
  }

  // The position of the nearest item in direction `step` that isn't skipped, or null.
  #find(step: 1 | -1, skip: (item: T) => boolean): number | null {
    for (let i = this.#position + step; i >= 0 && i < this.#items.length; i += step) {
      if (!skip(this.#items[i])) {
        return i;
      }
    }
    return null;
  }
}
