import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFolderTree } from "../src/renderer/folders.ts";
import { foldForSearch, SongSearch, searchFolders, searchWords } from "../src/renderer/search.ts";
import type { Song } from "../src/shared/library.ts";

function song(path: string, tags: Partial<Song> = {}): Song {
  return { id: path, path, fileName: path.split("/").at(-1) ?? path, ...tags };
}

describe("foldForSearch", () => {
  it("lowercases and removes accents", () => {
    assert.equal(foldForSearch("Beyoncé"), "beyonce");
    assert.equal(foldForSearch("Canção Longa"), "cancao longa");
  });

  it("turns punctuation into spaces", () => {
    assert.equal(foldForSearch("AC/DC"), "ac dc");
    assert.equal(foldForSearch("Ratchet & Clank: Rift Apart"), "ratchet clank rift apart");
  });

  it("keeps letters and digits of every script", () => {
    assert.equal(foldForSearch("Кино"), "кино");
    // Japanese voicing marks are dropped like accents (ジ folds to シ), on both the title
    // and the query, so typing it either way still finds the song.
    const japanese = new SongSearch([song("/m/ff.mp3", { title: "ファイナルファンタジー VII" })]);
    assert.equal(japanese.search("ファンタジー").length, 1);
    assert.equal(japanese.search("ファンタシー").length, 1);
  });

  it("folds full-width characters and ligatures", () => {
    assert.equal(foldForSearch("Ｍｕｓｉｃ"), "music");
    assert.equal(foldForSearch("ﬁnal"), "final");
  });
});

describe("searchWords", () => {
  it("splits a query into folded words", () => {
    assert.deepEqual(searchWords("  Daft   Punk!  "), ["daft", "punk"]);
    assert.deepEqual(searchWords("   "), []);
  });
});

describe("SongSearch", () => {
  const songs = [
    song("/m/1.mp3", { title: "One More Time", artist: "Daft Punk", album: "Discovery" }),
    song("/m/2.mp3", { title: "Up All Night", artist: "Ratchet & Clank OST" }),
    song("/m/3.mp3", { title: "Halo", artist: "Beyoncé" }),
    song("/m/untagged song.mp3"),
    song("/m/4.mp3", { title: "Кино", artist: "Звезда" }),
  ];
  const search = new SongSearch(songs);
  const titles = (query: string) => search.search(query).map((s) => s.title ?? s.fileName);

  it("needs every word, in any order, in any field", () => {
    assert.deepEqual(titles("daft time"), ["One More Time"]);
    assert.deepEqual(titles("discovery punk"), ["One More Time"]);
    assert.deepEqual(titles("daft halo"), []);
  });

  it("matches across punctuation and accents", () => {
    assert.deepEqual(titles("clank ratchet"), ["Up All Night"]);
    assert.deepEqual(titles("beyonce"), ["Halo"]);
  });

  it("finds untagged songs by file name, but not by the extension", () => {
    assert.deepEqual(titles("untagged"), ["untagged song.mp3"]);
    assert.deepEqual(titles("mp3"), []);
  });

  it("doesn't search the file name of songs that have a title", () => {
    // "/m/1.mp3" has the title "One More Time": its file name "1" isn't searched.
    assert.deepEqual(titles("1"), []);
  });

  it("finds non-Latin titles", () => {
    assert.deepEqual(titles("кино"), ["Кино"]);
  });

  it("matches parts of words", () => {
    assert.deepEqual(titles("disc"), ["One More Time"]);
  });

  it("returns nothing for an empty query", () => {
    assert.deepEqual(titles(""), []);
  });
});

describe("searchFolders", () => {
  const tree = buildFolderTree("/m", [
    song("/m/Daft Punk/Discovery/1.mp3"),
    song("/m/Daft Punk/Homework/1.mp3"),
    song("/m/Other/Disco Hits/1.mp3"),
  ]);

  it("finds folders at any depth by name", () => {
    assert.deepEqual(
      searchFolders(tree, "disc", 10).map((f) => f.name),
      ["Discovery", "Disco Hits"],
    );
    assert.deepEqual(
      searchFolders(tree, "punk daft", 10).map((f) => f.name),
      ["Daft Punk"],
    );
  });

  it("stops at the limit", () => {
    assert.equal(searchFolders(tree, "disc", 1).length, 1);
  });
});
