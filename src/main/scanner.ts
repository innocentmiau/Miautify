import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parseFile } from "music-metadata";
import type { Song } from "../shared/library.js";

// What the scan cache stores per file: enough to tell whether the file changed (size and
// modified time), plus the tags read from it last time.
export interface CachedSong {
  path: string;
  size: number;
  mtimeMs: number;
  title?: string;
  artist?: string;
  album?: string;
  durationSeconds?: number;
}

export interface ScanResult {
  songs: Song[];
  // New or changed files, whose tags were read again. To be saved in the cache.
  changed: CachedSong[];
  // Cached paths inside the folder whose file is gone. To be removed from the cache.
  removed: string[];
}

type Tags = Pick<CachedSong, "title" | "artist" | "album" | "durationSeconds">;

// numeric: true sorts "2 - Intro.mp3" before "10 - Outro.mp3".
const collator = new Intl.Collator(undefined, { numeric: true });

// Lists the folder and returns its songs. Files whose size and modified time match the
// cache reuse the cached tags; only new or changed files are opened and read.
//
// `readTags` is a parameter so tests can count the reads without real mp3 files.
export async function scanFolder(
  folder: string,
  cache: ReadonlyMap<string, CachedSong>,
  readTags: (file: string) => Promise<Tags> = readTagsFromFile,
): Promise<ScanResult> {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".mp3"))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort(collator.compare);

  // stat only reads the file system's bookkeeping, not the file, so it's cheap even for
  // thousands of files. They run in parallel.
  const stats = await Promise.all(files.map((file) => stat(file).catch(() => null)));

  const songs: Song[] = [];
  const changed: CachedSong[] = [];
  for (const [index, file] of files.entries()) {
    const info = stats[index];
    if (!info) {
      continue; // Deleted between listing and stat.
    }

    let entry = cache.get(file);
    if (!entry || entry.size !== info.size || entry.mtimeMs !== info.mtimeMs) {
      // One file at a time keeps this simple. If a first scan of a big library is slow,
      // reading a few files in parallel is the first thing to try.
      entry = { path: file, size: info.size, mtimeMs: info.mtimeMs, ...(await readTags(file)) };
      changed.push(entry);
    }
    songs.push(toSong(entry));
  }

  const found = new Set(files);
  const removed = [...cache.keys()].filter((file) => isInside(file, folder) && !found.has(file));
  return { songs, changed, removed };
}

function toSong(entry: CachedSong): Song {
  return {
    id: songId(entry.path),
    path: entry.path,
    fileName: path.basename(entry.path),
    title: entry.title,
    artist: entry.artist,
    album: entry.album,
    durationSeconds: entry.durationSeconds,
  };
}

async function readTagsFromFile(file: string): Promise<Tags> {
  try {
    // Covers are skipped: they are the biggest part of the tags and the list doesn't show them.
    const { common, format } = await parseFile(file, { skipCovers: true });
    return {
      title: common.title,
      artist: common.artist,
      album: common.album,
      durationSeconds: format.duration,
    };
  } catch (error) {
    // A broken or mislabeled file still shows up, by file name, instead of stopping the scan.
    console.warn(`Could not read tags from ${file}:`, error);
    return {};
  }
}

// True if `file` is somewhere under `folder`. The separator matters: /music-old/a.mp3 is
// not inside /music.
function isInside(file: string, folder: string): boolean {
  const prefix = folder.endsWith(path.sep) ? folder : folder + path.sep;
  return file.startsWith(prefix);
}

// Same path, same id, so a rescan doesn't change the ids of songs that didn't move.
function songId(file: string): string {
  return createHash("sha256").update(file).digest("hex").slice(0, 16);
}
