import { readdir } from "node:fs/promises";
import path from "node:path";
import { parseFile } from "music-metadata";
import type { Song } from "../shared/library.js";

// numeric: true sorts "2 - Intro.mp3" before "10 - Outro.mp3".
const collator = new Intl.Collator(undefined, { numeric: true });

export async function scanFolder(folder: string): Promise<Song[]> {
  const entries = await readdir(folder, {
    recursive: true,
    withFileTypes: true,
  });
  const files = entries
    .filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".mp3"),
    )
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort(collator.compare);

  // One file at a time keeps this simple. If big libraries are slow, reading a few files
  // in parallel is the first thing to try.
  const songs: Song[] = [];
  for (const file of files) {
    songs.push(await readSong(file));
  }
  return songs;
}

async function readSong(file: string): Promise<Song> {
  const song: Song = { path: file, fileName: path.basename(file) };
  try {
    // Covers are skipped: they are the biggest part of the tags and the list doesn't show them.
    const { common, format } = await parseFile(file, { skipCovers: true });
    song.title = common.title;
    song.artist = common.artist;
    song.album = common.album;
    song.durationSeconds = format.duration;
  } catch (error) {
    // A broken or mislabeled file still shows up, by file name, instead of stopping the scan.
    console.warn(`Could not read tags from ${file}:`, error);
  }
  return song;
}
