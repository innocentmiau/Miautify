// Search matching. A song matches when every word of the query appears somewhere in its
// title (or file name, without a title), artist or album, in any order and in any field: "clank ratchet" finds
// "Ratchet & Clank", "ac dc" finds "AC/DC", "beyonce" finds "Beyoncé".
//
// Deliberately not fuzzy (no typo tolerance): that's slower per keystroke and matches
// things you didn't mean. Pure logic with only type imports, tested in test/search.test.ts.
import type { Song } from "../shared/library.js";
import type { Folder } from "./folders.js";

// Turns text into its searchable form: lowercase, accents removed, and anything that isn't
// a letter or a digit (in any script) turned into a space.
//
// NFKD splits "é" into "e" plus an accent mark (which is then removed) and also folds
// look-alikes: full-width "Ｍ" becomes "M", the ligature "ﬁ" becomes "fi". \p{L} and
// \p{N} mean any letter and any digit in any script, so Japanese, Cyrillic or Greek titles
// stay searchable (a plain [a-z0-9] would erase them). Japanese voicing marks go the same
// way as accents (ジ becomes シ); the query is folded the same way, so both still match.
export function foldForSearch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// The words of a query, folded. An empty list means "nothing to search for".
export function searchWords(query: string): string[] {
  return foldForSearch(query).split(" ").filter(Boolean);
}

function matchesAll(haystack: string, words: readonly string[]): boolean {
  return words.every((word) => haystack.includes(word));
}

// Searches a list of songs. Each song's text is folded once, here, so typing only folds
// the query: a keystroke over thousands of songs takes about a millisecond.
export class SongSearch {
  readonly #songs: readonly Song[];
  readonly #haystacks: string[];

  constructor(songs: readonly Song[]) {
    this.#songs = songs;
    this.#haystacks = songs.map((song) =>
      foldForSearch(
        // The file name only stands in when there's no title tag, like in the list. For
        // tagged songs it's mostly noise ("07 - ...") that would match number searches.
        [song.title ?? song.fileName.replace(/\.[^.]+$/, ""), song.artist, song.album]
          .filter(Boolean)
          .join(" "),
      ),
    );
  }

  // The matching songs, in library order. No words means no results.
  search(query: string): Song[] {
    const words = searchWords(query);
    if (words.length === 0) {
      return [];
    }
    return this.#songs.filter((_, index) => matchesAll(this.#haystacks[index], words));
  }
}

// Folders below `root` whose name matches every word of the query, in tree order, at
// most `limit` of them.
export function searchFolders(root: Folder, query: string, limit: number): Folder[] {
  const words = searchWords(query);
  const found: Folder[] = [];
  const visit = (folder: Folder): void => {
    for (const child of folder.folders) {
      if (found.length >= limit) {
        return;
      }
      if (words.length > 0 && matchesAll(foldForSearch(child.name), words)) {
        found.push(child);
      }
      visit(child);
    }
  };
  visit(root);
  return found;
}
