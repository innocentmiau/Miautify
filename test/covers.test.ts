import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { folderImageName, pickPicture } from "../src/main/cover-source.ts";
import { CoverCache, type CoverStore, type FoundCover } from "../src/main/covers.ts";

describe("pickPicture", () => {
  it("prefers the front cover", () => {
    const pictures = [{ type: "Artist/performer" }, { type: "Cover (front)" }];
    assert.equal(pickPicture(pictures), pictures[1]);
  });

  it("takes the first picture when none says front", () => {
    const pictures = [{ type: "Other" }, { type: undefined }];
    assert.equal(pickPicture(pictures), pictures[0]);
  });

  it("returns null without pictures", () => {
    assert.equal(pickPicture([]), null);
  });
});

describe("folderImageName", () => {
  it("finds the usual names, ignoring case", () => {
    assert.equal(folderImageName(["01 - Song.mp3", "Folder.JPG"]), "Folder.JPG");
  });

  it("prefers cover over folder over front over album", () => {
    assert.equal(folderImageName(["album.png", "front.jpg", "folder.jpg"]), "folder.jpg");
    assert.equal(folderImageName(["folder.jpg", "cover.jpeg"]), "cover.jpeg");
  });

  it("ignores other names and formats it can't read", () => {
    assert.equal(folderImageName(["back.jpg", "cover.webp", "my cover.jpg"]), null);
  });
});

describe("CoverCache", () => {
  let folder: string;
  let saved: Map<string, string>;
  let reads: string[];
  // Fake songs: a.mp3 and b.mp3 share a picture (one album), c.mp3 has none.
  const pictures: Record<string, FoundCover | null> = {
    "/m/a.mp3": { hash: "album1", data: new Uint8Array([1]) },
    "/m/b.mp3": { hash: "album1", data: new Uint8Array([1]) },
    "/m/c.mp3": null,
  };

  function cache(
    makeThumbnail: (data: Uint8Array) => Buffer | null = (data) => Buffer.from(data),
  ): CoverCache {
    const store: CoverStore = {
      coverOf: (file) => saved.get(file),
      setCover: (file, hash) => saved.set(file, hash),
    };
    return new CoverCache({
      folder,
      store,
      find: async (file) => {
        reads.push(file);
        return pictures[file];
      },
      makeThumbnail,
    });
  }

  beforeEach(() => {
    folder = mkdtempSync(path.join(tmpdir(), "miautify-covers-"));
    saved = new Map();
    reads = [];
  });

  afterEach(() => rmSync(folder, { recursive: true, force: true }));

  it("saves a thumbnail and remembers it, so the song is read once", async () => {
    const covers = cache();
    const first = await covers.thumbnailFor("/m/a.mp3");
    assert.equal(first, path.join(folder, "album1.jpg"));
    assert.deepEqual([...readFileSync(first)], [1]);
    assert.equal(await covers.thumbnailFor("/m/a.mp3"), first);
    assert.deepEqual(reads, ["/m/a.mp3"]);
  });

  it("shares one thumbnail between songs with the same picture", async () => {
    let made = 0;
    const covers = cache((data) => {
      made++;
      return Buffer.from(data);
    });
    await covers.thumbnailFor("/m/a.mp3");
    assert.equal(await covers.thumbnailFor("/m/b.mp3"), path.join(folder, "album1.jpg"));
    assert.equal(made, 1);
  });

  it("remembers songs without a cover", async () => {
    const covers = cache();
    assert.equal(await covers.thumbnailFor("/m/c.mp3"), null);
    assert.equal(await covers.thumbnailFor("/m/c.mp3"), null);
    assert.equal(saved.get("/m/c.mp3"), "");
    assert.deepEqual(reads, ["/m/c.mp3"]);
  });

  it("reads a file once when asked for it twice at the same time", async () => {
    const covers = cache();
    await Promise.all([covers.thumbnailFor("/m/a.mp3"), covers.thumbnailFor("/m/a.mp3")]);
    assert.deepEqual(reads, ["/m/a.mp3"]);
  });

  it("treats a picture that isn't a readable image as no cover", async () => {
    const covers = cache(() => null);
    assert.equal(await covers.thumbnailFor("/m/a.mp3"), null);
    assert.equal(saved.get("/m/a.mp3"), "");
  });

  it("makes the thumbnail again if its file was deleted", async () => {
    const covers = cache();
    const thumbnail = await covers.thumbnailFor("/m/a.mp3");
    rmSync(folder, { recursive: true });
    assert.equal(await covers.thumbnailFor("/m/a.mp3"), thumbnail);
    assert.equal(reads.length, 2);
  });
});
