import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { type CachedSong, scanFolder } from "../src/main/scanner.ts";

// A fake tag reader: records which files it was asked to read, and returns the file name
// as the title.
function fakeReader() {
  const reads: string[] = [];
  const readTags = async (file: string) => {
    reads.push(path.basename(file));
    return { title: path.basename(file) };
  };
  return { reads, readTags };
}

function cacheOf(entries: CachedSong[]): Map<string, CachedSong> {
  return new Map(entries.map((entry) => [entry.path, entry]));
}

describe("scanFolder", () => {
  const root = mkdtempSync(path.join(tmpdir(), "miautify-scan-"));
  const music = path.join(root, "music");
  mkdirSync(path.join(music, "album"), { recursive: true });
  writeFileSync(path.join(music, "a.mp3"), "a");
  writeFileSync(path.join(music, "album", "b.MP3"), "b");
  writeFileSync(path.join(music, "cover.jpg"), "not a song");
  after(() => rmSync(root, { recursive: true, force: true }));

  it("reads every mp3 on the first scan and nothing else", async () => {
    const { reads, readTags } = fakeReader();
    const result = await scanFolder(music, new Map(), readTags);
    assert.deepEqual(reads.sort(), ["a.mp3", "b.MP3"]);
    assert.equal(result.songs.length, 2);
    assert.equal(result.changed.length, 2);
  });

  it("reads nothing again when no file changed", async () => {
    const first = await scanFolder(music, new Map(), fakeReader().readTags);
    const { reads, readTags } = fakeReader();
    const second = await scanFolder(music, cacheOf(first.changed), readTags);
    assert.deepEqual(reads, []);
    assert.deepEqual(second.changed, []);
    assert.deepEqual(
      second.songs.map((song) => song.title),
      first.songs.map((song) => song.title),
    );
  });

  it("reads a file again when its size changed", async () => {
    const first = await scanFolder(music, new Map(), fakeReader().readTags);
    writeFileSync(path.join(music, "a.mp3"), "a, now longer");
    const { reads, readTags } = fakeReader();
    await scanFolder(music, cacheOf(first.changed), readTags);
    assert.deepEqual(reads, ["a.mp3"]);
  });

  it("reports deleted files, but not files outside the folder", async () => {
    const extra = path.join(music, "extra.mp3");
    writeFileSync(extra, "x");
    const first = await scanFolder(music, new Map(), fakeReader().readTags);
    unlinkSync(extra);

    // A cached song from a different folder whose name starts the same way.
    const elsewhere = { path: path.join(root, "music-old", "c.mp3"), size: 1, mtimeMs: 1 };
    const result = await scanFolder(
      music,
      cacheOf([...first.changed, elsewhere]),
      fakeReader().readTags,
    );
    assert.deepEqual(result.removed, [extra]);
  });
});
