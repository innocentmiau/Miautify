// Turns the scanned songs into a tree of folders, from their paths. No disk access: a
// folder exists here only because some song is in it or somewhere below it, so folders
// without mp3s (covers only, empty) never appear.
//
// Pure logic with only a type import, so it's unit tested in test/folders.test.ts.
import type { Song } from "../shared/library.js";

export interface Folder {
  name: string;
  // Folder names from the root down to this one; empty for the root itself.
  segments: string[];
  // Direct subfolders, sorted by name.
  folders: Folder[];
  // Songs directly in this folder (not in subfolders), in scan order.
  songs: Song[];
  // Songs in this folder and everything below it, in scan order (sorted by path, like the
  // flat list of the whole library).
  allSongs: Song[];
}

// numeric: true sorts "Disc 2" before "Disc 10".
const collator = new Intl.Collator(undefined, { numeric: true });

// `root` is the chosen music folder; every song path is expected to be inside it. Paths
// may use / or \ (Windows), and `root` may or may not end with a separator.
export function buildFolderTree(root: string, songs: readonly Song[]): Folder {
  const rootFolder = newFolder(lastSegment(root), []);
  const rootLength = root.replace(/[\\/]+$/, "").length;

  for (const song of songs) {
    // "Artist/Album/1 - Song.mp3" -> ["Artist", "Album"]
    const relative = song.path.slice(rootLength).replace(/^[\\/]+/, "");
    const segments = relative.split(/[\\/]+/).slice(0, -1);

    let folder = rootFolder;
    folder.allSongs.push(song);
    for (const [depth, name] of segments.entries()) {
      let child = folder.folders.find((candidate) => candidate.name === name);
      if (!child) {
        child = newFolder(name, segments.slice(0, depth + 1));
        folder.folders.push(child);
      }
      folder = child;
      folder.allSongs.push(song);
    }
    folder.songs.push(song);
  }

  sortFolders(rootFolder);
  return rootFolder;
}

// The songs a folder shows, which are also the songs that play from it: only its own
// songs, or with `showAll`, everything in it and its subfolders. The song list and the
// queue both come from here, so what's on screen is exactly what auto-advance plays.
export function songsShown(folder: Folder, showAll: boolean): Song[] {
  return showAll ? folder.allSongs : folder.songs;
}

// Follows `segments` down from `root`. Stops at the deepest folder that still exists, so a
// folder deleted since it was opened falls back to its nearest parent.
export function findFolder(root: Folder, segments: readonly string[]): Folder {
  let folder = root;
  for (const name of segments) {
    const child = folder.folders.find((candidate) => candidate.name === name);
    if (!child) {
      break;
    }
    folder = child;
  }
  return folder;
}

// The folder that directly holds the song with this id, if it's in the tree.
export function folderOfSong(root: Folder, songId: string): Folder | null {
  if (root.songs.some((song) => song.id === songId)) {
    return root;
  }
  for (const child of root.folders) {
    const found = folderOfSong(child, songId);
    if (found) {
      return found;
    }
  }
  return null;
}

function newFolder(name: string, segments: string[]): Folder {
  return { name, segments, folders: [], songs: [], allSongs: [] };
}

function sortFolders(folder: Folder): void {
  folder.folders.sort((a, b) => collator.compare(a.name, b.name));
  for (const child of folder.folders) {
    sortFolders(child);
  }
}

function lastSegment(folderPath: string): string {
  const parts = folderPath.split(/[\\/]+/).filter((part) => part !== "");
  return parts.at(-1) ?? folderPath;
}
