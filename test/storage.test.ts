import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { Storage } from "../src/main/storage.ts";

describe("Storage", () => {
  it("returns undefined for a setting that was never saved", () => {
    const storage = new Storage(":memory:");
    assert.equal(storage.get("library.folder"), undefined);
  });

  it("saves, overwrites and deletes a setting", () => {
    const storage = new Storage(":memory:");
    storage.set("library.folder", "/music");
    assert.equal(storage.get("library.folder"), "/music");
    storage.set("library.folder", "/other");
    assert.equal(storage.get("library.folder"), "/other");
    storage.delete("library.folder");
    assert.equal(storage.get("library.folder"), undefined);
  });

  it("keeps settings after closing and reopening the file", () => {
    const folder = mkdtempSync(path.join(tmpdir(), "miautify-test-"));
    try {
      const file = path.join(folder, "test.db");
      const first = new Storage(file);
      first.set("player.lastSongId", "abc123");
      first.close();

      const second = new Storage(file);
      assert.equal(second.get("player.lastSongId"), "abc123");
      assert.equal(second.version, 3); // Reopening doesn't run the migrations again.
      second.close();
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("keeps text with quotes and accents intact", () => {
    const storage = new Storage(":memory:");
    const folder = String.raw`C:\Músicas\"quoted" & 'single'`;
    storage.set("library.folder", folder);
    assert.equal(storage.get("library.folder"), folder);
  });

  it("saves scan results and removes deleted songs", () => {
    const storage = new Storage(":memory:");
    storage.saveScan(
      [
        { path: "/m/a.mp3", size: 10, mtimeMs: 1.5, title: "A", durationSeconds: 185.05 },
        { path: "/m/b.mp3", size: 20, mtimeMs: 2 },
      ],
      [],
    );
    const cached = storage.cachedSongs();
    assert.deepEqual(cached.get("/m/a.mp3"), {
      path: "/m/a.mp3",
      size: 10,
      mtimeMs: 1.5,
      title: "A",
      artist: undefined,
      album: undefined,
      durationSeconds: 185.05,
      unplayable: undefined,
    });
    // Missing tags come back as undefined, not null.
    assert.equal(cached.get("/m/b.mp3")?.title, undefined);

    storage.saveScan([{ path: "/m/a.mp3", size: 11, mtimeMs: 3, title: "A2" }], ["/m/b.mp3"]);
    const updated = storage.cachedSongs();
    assert.deepEqual([...updated.keys()], ["/m/a.mp3"]);
    assert.equal(updated.get("/m/a.mp3")?.title, "A2");
  });

  it("remembers unplayable files until they change", () => {
    const storage = new Storage(":memory:");
    storage.saveScan([{ path: "/m/a.mp3", size: 10, mtimeMs: 1 }], []);
    storage.markUnplayable("/m/a.mp3");
    assert.equal(storage.cachedSongs().get("/m/a.mp3")?.unplayable, true);

    // The file changed (the scanner re-read it): it gets another chance.
    storage.saveScan([{ path: "/m/a.mp3", size: 12, mtimeMs: 2 }], []);
    assert.equal(storage.cachedSongs().get("/m/a.mp3")?.unplayable, undefined);
  });
});
