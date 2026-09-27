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
      assert.equal(second.version, 1); // Reopening doesn't run the migrations again.
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
});
