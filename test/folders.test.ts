import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFolderTree, findFolder, folderOfSong, songsShown } from "../src/renderer/folders.ts";
import { Queue } from "../src/renderer/queue.ts";
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
    assert.equal(root.allSongs.length, 6);
    assert.equal(findFolder(root, ["Artist A"]).allSongs.length, 4);
    assert.equal(findFolder(root, ["Artist A", "Album 2"]).allSongs.length, 3);
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
    assert.equal(tree.allSongs.length, 0);
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

// What auto-advance plays: double-click the song at `start` in the list a folder shows,
// then let every song end. The queue is built the same way the app builds it.
function playedFrom(songs: Song[], start: number): string[] {
  const queue = new Queue(songs.slice(start));
  const played = [queue.current.fileName];
  for (let song = queue.next(); song; song = queue.next()) {
    played.push(song.fileName);
  }
  return played;
}

describe("songsShown and what auto-advance plays", () => {
  // A folder with its own songs AND subfolders, the case where the toggle matters.
  const tree = buildFolderTree("/m", [
    song("/m/Album/1 - Own.mp3"),
    song("/m/Album/2 - Own.mp3"),
    song("/m/Album/Bonus/1 - Bonus.mp3"),
    song("/m/Album/Bonus/Live/1 - Live.mp3"),
    song("/m/Other/1 - Elsewhere.mp3"),
  ]);
  const album = findFolder(tree, ["Album"]);

  it("shows only the folder's own songs when showAll is off", () => {
    assert.deepEqual(
      songsShown(album, false).map((s) => s.fileName),
      ["1 - Own.mp3", "2 - Own.mp3"],
    );
  });

  it("shows the folder and all its subfolders, in path order, when showAll is on", () => {
    assert.deepEqual(
      songsShown(album, true).map((s) => s.fileName),
      ["1 - Own.mp3", "2 - Own.mp3", "1 - Bonus.mp3", "1 - Live.mp3"],
    );
  });

  it("off: plays to the end of the folder's own songs, never into subfolders", () => {
    assert.deepEqual(playedFrom(songsShown(album, false), 0), ["1 - Own.mp3", "2 - Own.mp3"]);
  });

  it("on: plays on into the subfolders, and stops at the end of the folder", () => {
    assert.deepEqual(playedFrom(songsShown(album, true), 1), [
      "2 - Own.mp3",
      "1 - Bonus.mp3",
      "1 - Live.mp3",
    ]);
  });

  it("never plays songs from a sibling folder, in either mode", () => {
    for (const showAll of [false, true]) {
      const played = playedFrom(songsShown(album, showAll), 0);
      assert.ok(!played.includes("1 - Elsewhere.mp3"));
    }
  });

  it("leaves out files that can't play when hideUnplayable is on", () => {
    const broken = { ...song("/m/Album/3 - Broken.mp3"), unplayable: true };
    const withBroken = buildFolderTree("/m", [song("/m/Album/1 - Own.mp3"), broken]);
    const folder = findFolder(withBroken, ["Album"]);
    assert.deepEqual(
      songsShown(folder, false, true).map((s) => s.fileName),
      ["1 - Own.mp3"],
    );
    // Off (the default): it stays listed, marked in red by the page.
    assert.equal(songsShown(folder, false).length, 2);
  });
});
