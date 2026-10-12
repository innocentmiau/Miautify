// Shuffling a list of songs for shuffle play.
//
// Pure logic with no imports. `random` is a parameter (Math.random by default) so the tests
// in test/shuffle.test.ts can make it predictable.

// Returns a copy of `items` in random order. Fisher-Yates: walk from the end, swapping each
// item with a random one at or before it. Every order is equally likely (the obvious
// "sort with a random comparison" isn't: some orders come up far more often).
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Share of the list counted as "heard recently": with 100 songs, the 30 played most
// recently go to the back of a new shuffle.
export const recentShare = 0.3;

// A shuffled deck of `items` that keeps recently heard songs for last. The songs played
// most recently (a share of the list, see recentShare) go to the back, oldest first, so
// the one heard last comes last. Everything else is shuffled in front of them.
//
// `lastPlayed` holds when each song last started playing (any number that grows with
// time), by `key`. Songs never played count as not recent.
export function shuffleDeck<T>(
  items: readonly T[],
  key: (item: T) => string,
  lastPlayed: ReadonlyMap<string, number>,
  random: () => number = Math.random,
): T[] {
  // At least one, so a song isn't shuffled straight back after itself; but never every
  // song, so there is always something shuffled.
  const recentCount = Math.min(
    Math.max(1, Math.floor(items.length * recentShare)),
    items.length - 1,
  );
  const recent = items
    .filter((item) => lastPlayed.has(key(item)))
    .sort((a, b) => (lastPlayed.get(key(b)) ?? 0) - (lastPlayed.get(key(a)) ?? 0))
    .slice(0, Math.max(0, recentCount))
    .reverse();
  const recentSet = new Set(recent);
  const fresh = items.filter((item) => !recentSet.has(item));
  return [...shuffled(fresh, random), ...recent];
}
