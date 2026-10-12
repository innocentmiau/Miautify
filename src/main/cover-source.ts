import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { type IPicture, parseFile } from "music-metadata";

// Where a song's cover comes from: the picture embedded in the mp3's tags, or else an image
// file next to it, like the cover.jpg that many ripped albums have.
//
// Runs in the cover worker (cover-worker.ts), off the main process. No Electron imports, so
// the choosing logic is unit tested in test/covers.test.ts.

// Returns the cover image's bytes, as stored (any size), or null if the song has none.
export async function readCover(file: string): Promise<Uint8Array | null> {
  try {
    // skipPostHeaders: the cover is at the start of the file; don't read its end too.
    const { common } = await parseFile(file, { skipPostHeaders: true });
    const picture = pickPicture(common.picture ?? []);
    if (picture) {
      return picture.data;
    }
  } catch {
    // Unreadable tags: the folder's image can still be used.
  }
  return readFolderImage(path.dirname(file));
}

// A file can hold several pictures (front, back, artist...). The front cover if it says
// which one it is, otherwise the first.
export function pickPicture<P extends Pick<IPicture, "type">>(pictures: readonly P[]): P | null {
  return pictures.find((p) => p.type?.toLowerCase().includes("front")) ?? pictures[0] ?? null;
}

// The usual names for an album's image file, best first. Only formats the thumbnail maker
// can read.
const imageNames = ["cover", "folder", "front", "album"];
const imageExtensions = [".jpg", ".jpeg", ".png"];

// Which of a folder's files is its cover image, or null. Ignores case: Folder.JPG counts.
export function folderImageName(fileNames: readonly string[]): string | null {
  let best: string | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const fileName of fileNames) {
    const { name, ext } = path.parse(fileName.toLowerCase());
    const rank = imageNames.indexOf(name);
    if (rank >= 0 && rank < bestRank && imageExtensions.includes(ext)) {
      best = fileName;
      bestRank = rank;
    }
  }
  return best;
}

async function readFolderImage(folder: string): Promise<Uint8Array | null> {
  try {
    const name = folderImageName(await readdir(folder));
    return name ? await readFile(path.join(folder, name)) : null;
  } catch {
    return null;
  }
}
