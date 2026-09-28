import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFolderTree, findFolder, folderOfSong } from "../src/renderer/folders.ts";
import type { Song } from "../src/shared/library.ts";

function song(path: string): Song {
  return { id: path, path, fileName: path.split(/[\\/]/).at(-1) ?? path };
}

const songs = [
  song("/music/loose.mp3"),
  song("/music/Artist B/Album/1.mp3"),
  song("/music/Artist A/Album 10/1.mp3"),
  song("/music/Artist A/Album 2/1.mp3"),
  song("/music/Artist A/Album 2/2.mp3"),
  song("/music/Artist A/Album 2/Disc 1/1.mp3"),
];

describe("buildFolderTree", () => {
  const root = buildFolderTree("/music", songs);

  it("names the root after the chosen folder and keeps its own songs", () => {
    assert.equal(root.name, "music");
    assert.deepEqual(root.segments, []);
    assert.deepEqual(
      root.songs.map((s) => s.fileName),
      ["loose.mp3"],
    );
  });

  it("lists direct subfolders sorted by name, numbers in number order", () => {
    assert.deepEqual(
      root.folders.map((f) => f.name),
      ["Artist A", "Artist B"],
    );
    assert.deepEqual(
      root.folders[0].folders.map((f) => f.name),
      ["Album 2", "Album 10"],
    );
  });

  it("puts each song only in the folder that directly holds it", () => {
    const album = findFolder(root, ["Artist A", "Album 2"]);
    assert.deepEqual(
      album.songs.map((s) => s.fileName),
      ["1.mp3", "2.mp3"],
    );
    assert.deepEqual(album.segments, ["Artist A", "Album 2"]);
  });

  it("counts every song below a folder", () => {
    assert.equal(root.totalSongs, 6);
    assert.equal(findFolder(root, ["Artist A"]).totalSongs, 4);
    assert.equal(findFolder(root, ["Artist A", "Album 2"]).totalSongs, 3);
  });

  it("handles Windows paths and a root ending in a separator", () => {
    const tree = buildFolderTree("C:\\Music\\", [song("C:\\Music\\Artist\\a.mp3")]);
    assert.equal(tree.name, "Music");
    assert.deepEqual(
      tree.folders.map((f) => f.name),
      ["Artist"],
    );
    assert.equal(tree.folders[0].songs.length, 1);
  });

  it("gives an empty tree for no songs", () => {
    const tree = buildFolderTree("/music", []);
    assert.equal(tree.totalSongs, 0);
    assert.deepEqual(tree.folders, []);
  });
});

describe("findFolder", () => {
  const root = buildFolderTree("/music", songs);

  it("falls back to the nearest folder that still exists", () => {
    assert.equal(findFolder(root, ["Artist A", "Gone", "Deeper"]).name, "Artist A");
    assert.equal(findFolder(root, ["Nope"]), root);
  });
});

describe("folderOfSong", () => {
  const root = buildFolderTree("/music", songs);

  it("finds the folder that holds a song", () => {
    assert.equal(folderOfSong(root, "/music/Artist A/Album 2/Disc 1/1.mp3")?.name, "Disc 1");
    assert.equal(folderOfSong(root, "/music/loose.mp3"), root);
    assert.equal(folderOfSong(root, "missing"), null);
  });
});
