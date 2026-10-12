// A predictable "random" sequence for tests (a small linear congruential generator): the
// same seed always gives the same numbers, between 0 and 1 like Math.random.
export function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}
