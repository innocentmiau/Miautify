import type { Song } from "./library.js";

// Sorting the song list by a column. Shared because the page sorts, and the main process
// checks the saved sort before storing it.
//
// Pure logic with only a type import, so it's unit tested in test/sort.test.ts.

export const sortColumns = ["title", "artist", "album", "duration"] as const;
export type SortColumn = (typeof sortColumns)[number];

export interface SongSort {
  column: SortColumn;
  descending: boolean;
}

// Clicking a column header: first by that column A to Z, then Z to A, then back to the
// folder's own order (null), which is file name order, usually the track order.
export function nextSort(current: SongSort | null, column: SortColumn): SongSort | null {
  if (current?.column !== column) {
    return { column, descending: false };
  }
  return current.descending ? null : { column, descending: true };
}

// The songs in `sort` order, as a new array. Songs that are equal (same album, say) keep
// the order they came in, so an album sorted by artist still plays in track order.
// Songs missing the tag go last in both directions: a block of blanks at the top of a
// Z to A list would only be in the way.
export function sortSongs(
  songs: readonly Song[],
  sort: SongSort | null,
  collator: Intl.Collator,
): Song[] {
  if (!sort) {
    return [...songs];
  }
  const keyOf = sortKeys[sort.column];
  const direction = sort.descending ? -1 : 1;
  // The key of every song, worked out once instead of twice per comparison.
  const keyed = songs.map((song) => ({ song, key: keyOf(song) }));
  keyed.sort((a, b) => {
    if (a.key === undefined || b.key === undefined) {
      return a.key === b.key ? 0 : a.key === undefined ? 1 : -1;
    }
    const order =
      typeof a.key === "number" && typeof b.key === "number"
        ? a.key - b.key
        : collator.compare(String(a.key), String(b.key));
    return order * direction;
  });
  return keyed.map(({ song }) => song);
}

// What each column sorts by. Untagged songs sort by the file name, since that's what the
// title column shows for them.
const sortKeys: Record<SortColumn, (song: Song) => string | number | undefined> = {
  title: (song) => song.title ?? song.fileName,
  artist: (song) => blankToUndefined(song.artist),
  album: (song) => blankToUndefined(song.album),
  duration: (song) => song.durationSeconds,
};

function blankToUndefined(text: string | undefined): string | undefined {
  return text?.trim() ? text : undefined;
}

// True if `value` is a sort the app can use. The saved sort comes back from the database
// and from the page, so it's checked before it's trusted.
export function isSongSort(value: unknown): value is SongSort {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { column, descending } = value as Record<string, unknown>;
  return sortColumns.includes(column as SortColumn) && typeof descending === "boolean";
}
