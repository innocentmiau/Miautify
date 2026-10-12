import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Song } from "../src/shared/library.ts";
import { isSongSort, nextSort, type SongSort, sortSongs } from "../src/shared/sort.ts";

function song(path: string, tags: Partial<Song> = {}): Song {
  return { id: path, path, fileName: path.split("/").at(-1) ?? path, ...tags };
}

const collator = new Intl.Collator("en", { numeric: true });

function paths(songs: Song[]): string[] {
  return songs.map((s) => s.path);
}

describe("nextSort", () => {
  it("goes A to Z, Z to A, then back to folder order", () => {
    const first = nextSort(null, "artist");
    assert.deepEqual(first, { column: "artist", descending: false });
    const second = nextSort(first, "artist");
    assert.deepEqual(second, { column: "artist", descending: true });
    assert.equal(nextSort(second, "artist"), null);
  });

  it("starts A to Z when switching to another column", () => {
    const sort: SongSort = { column: "artist", descending: true };
    assert.deepEqual(nextSort(sort, "album"), { column: "album", descending: false });
  });
});

describe("sortSongs", () => {
  const songs = [
    song("/m/1.mp3", { title: "beta", artist: "Zed", durationSeconds: 200 }),
    song("/m/2.mp3", { title: "Alpha", artist: "abba", durationSeconds: 95 }),
    song("/m/3.mp3", { title: "Track 10", durationSeconds: 300 }),
    song("/m/4.mp3", { title: "Track 9", artist: "Zed" }),
  ];

  it("keeps the folder order without a sort, as a copy", () => {
    const sorted = sortSongs(songs, null, collator);
    assert.deepEqual(paths(sorted), paths(songs));
    assert.notEqual(sorted, songs);
  });

  it("sorts text ignoring case, and numbers by value", () => {
    const sorted = sortSongs(songs, { column: "title", descending: false }, collator);
    assert.deepEqual(paths(sorted), ["/m/2.mp3", "/m/1.mp3", "/m/4.mp3", "/m/3.mp3"]);
  });

  it("reverses for Z to A", () => {
    const sorted = sortSongs(songs, { column: "title", descending: true }, collator);
    assert.deepEqual(paths(sorted), ["/m/3.mp3", "/m/4.mp3", "/m/1.mp3", "/m/2.mp3"]);
  });

  it("keeps equal songs in folder order, in both directions", () => {
    for (const descending of [false, true]) {
      const sorted = sortSongs(songs, { column: "artist", descending }, collator);
      const zed = paths(sorted).filter((p) => p === "/m/1.mp3" || p === "/m/4.mp3");
      assert.deepEqual(zed, ["/m/1.mp3", "/m/4.mp3"]);
    }
  });

  it("puts songs without the tag last, in both directions", () => {
    for (const descending of [false, true]) {
      const byArtist = sortSongs(songs, { column: "artist", descending }, collator);
      assert.equal(byArtist.at(-1)?.path, "/m/3.mp3");
      const byDuration = sortSongs(songs, { column: "duration", descending }, collator);
      assert.equal(byDuration.at(-1)?.path, "/m/4.mp3");
    }
  });

  it("sorts durations as numbers", () => {
    const sorted = sortSongs(songs, { column: "duration", descending: false }, collator);
    assert.deepEqual(paths(sorted), ["/m/2.mp3", "/m/1.mp3", "/m/3.mp3", "/m/4.mp3"]);
  });

  it("sorts untagged songs by file name, like the title column shows them", () => {
    const untagged = [song("/m/b.mp3"), song("/m/a.mp3", { title: "c" })];
    const sorted = sortSongs(untagged, { column: "title", descending: false }, collator);
    assert.deepEqual(paths(sorted), ["/m/b.mp3", "/m/a.mp3"]);
  });
});

describe("isSongSort", () => {
  it("accepts a known column and a direction", () => {
    assert.ok(isSongSort({ column: "album", descending: true }));
  });

  it("refuses anything else", () => {
    assert.ok(!isSongSort(null));
    assert.ok(!isSongSort("title"));
    assert.ok(!isSongSort({ column: "path", descending: false }));
    assert.ok(!isSongSort({ column: "title", descending: "no" }));
  });
});
