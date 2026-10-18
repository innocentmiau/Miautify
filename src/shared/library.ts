import type { PreferenceKey, Preferences } from "./preferences.js";
import type { SongSort } from "./sort.js";

// Types shared by the main process, the preload bridge and the renderer.

export interface Song {
  // Opaque id the page uses to refer to a song. Built from the path for now; once there is
  // a database it becomes the database id, and the page won't notice the difference.
  id: string;
  path: string;
  fileName: string;
  // Tags are optional: plenty of real mp3s are missing some or all of them.
  title?: string;
  artist?: string;
  album?: string;
  durationSeconds?: number;
  // Set once playing it failed (the file can't be decoded). Cleared when the file changes.
  unplayable?: boolean;
}

// Repeat: off, the whole list ("all"), or the current song ("one").
export const repeatModes = ["off", "all", "one"] as const;
export type RepeatMode = (typeof repeatModes)[number];

export function isRepeatMode(value: unknown): value is RepeatMode {
  return repeatModes.includes(value as RepeatMode);
}

// What the page needs to restore the last session on launch.
export interface StartupState {
  // The folder chosen last time, or null if there is none or it no longer exists.
  folder: string | null;
  lastSongId: string | null;
  // Where that song was, in seconds, or null to start it from the beginning.
  lastPosition: number | null;
  // Null when never set, so the page uses its default.
  volume: number | null;
  muted: boolean;
  // The column the song list is sorted by, or null for the folder's own order.
  sort: SongSort | null;
  shuffle: boolean;
  repeat: RepeatMode;
  // When each song last started playing, as [song id, time] pairs.
  lastPlayed: [string, number][];
  // Every preference, saved or default.
  preferences: Preferences;
  // The app's version, for the About section of Settings.
  version: string;
}

export type ScanOutcome =
  | {
      found: true;
      songs: Song[];
      // False when the folder matched the cache exactly, so the list on screen is still right.
      changed: boolean;
    }
  // The folder is gone: deleted, renamed, or on a drive that isn't plugged in.
  | { found: false };

// What the preload script exposes to the page as `window.miautify`.
export interface MiautifyApi {
  getStartupState(): Promise<StartupState>;
  // Opens the folder picker. Resolves to the chosen folder, or null if the user cancels.
  chooseFolder(): Promise<string | null>;
  // The chosen folder's songs as saved from the last scan, without reading the folder.
  // Instant, so the list can show while the real scan runs.
  cachedSongs(): Promise<Song[]>;
  // Scans the folder picked last. The page can't pass a path of its own.
  scanChosenFolder(): Promise<ScanOutcome>;
  // Forgets which songs have which cover, so they're looked up again (Refresh).
  recheckCovers(): Promise<void>;
  // Calls `listener` while a scan reads tags. Returns a function that stops listening.
  onScanProgress(listener: (done: number, total: number) => void): () => void;
  // Remembers the song in the player bar, to show it again on the next launch.
  setLastSong(id: string): void;
  // Remembers where in that song playback is, to carry on from there next launch.
  savePosition(id: string, seconds: number): void;
  // Remembers the volume slider position (0 to 1) and mute.
  saveVolume(level: number, muted: boolean): void;
  // Remembers the song list's sort (null: the folder's own order).
  saveSort(sort: SongSort | null): void;
  // Remembers the shuffle and repeat buttons.
  savePlayMode(shuffle: boolean, repeat: RepeatMode): void;
  // Adds a song that started playing to the play history.
  notePlayed(id: string): void;
  // Saves one preference from the Settings page. Main refuses unknown keys and values of
  // the wrong type.
  setPreference<K extends PreferenceKey>(key: K, value: Preferences[K]): void;
  // Remembers that a song failed to play, so it's skipped until its file changes.
  markUnplayable(id: string): void;
}

export const ipcChannels = {
  getStartupState: "app:get-startup-state",
  chooseFolder: "library:choose-folder",
  cachedSongs: "library:cached-songs",
  scanChosenFolder: "library:scan-chosen-folder",
  scanProgress: "library:scan-progress",
  recheckCovers: "library:recheck-covers",
  setLastSong: "player:set-last-song",
  savePosition: "player:save-position",
  saveVolume: "player:save-volume",
  saveSort: "library:save-sort",
  savePlayMode: "player:save-play-mode",
  notePlayed: "player:note-played",
  setPreference: "settings:set-preference",
  markUnplayable: "library:mark-unplayable",
} as const;

// Audio reaches the page through this custom URL scheme, served by the main process
// (src/main/media.ts), instead of file:// URLs.
export const mediaScheme = "miautify-media";

export function songUrl(id: string): string {
  return `${mediaScheme}://song/${encodeURIComponent(id)}`;
}

// The song's cover as a small JPEG, or a 404 if it has none (see src/main/covers.ts).
// `version` goes up when covers are looked up again: a new URL makes the page ask for the
// picture again instead of showing the one it already has. The protocol ignores it.
export function coverUrl(id: string, version = 0): string {
  const url = `${mediaScheme}://cover/${encodeURIComponent(id)}`;
  return version > 0 ? `${url}?v=${version}` : url;
}
