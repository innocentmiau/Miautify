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
}

// What the page needs to restore the last session on launch.
export interface StartupState {
  // The folder chosen last time, or null if there is none or it no longer exists.
  folder: string | null;
  lastSongId: string | null;
}

// What the preload script exposes to the page as `window.miautify`.
export interface MiautifyApi {
  getStartupState(): Promise<StartupState>;
  // Opens the folder picker. Resolves to the chosen folder, or null if the user cancels.
  chooseFolder(): Promise<string | null>;
  // Scans the folder picked last. The page can't pass a path of its own.
  scanChosenFolder(): Promise<Song[]>;
  // Remembers the song in the player bar, to show it again on the next launch.
  setLastSong(id: string): void;
}

export const ipcChannels = {
  getStartupState: "app:get-startup-state",
  chooseFolder: "library:choose-folder",
  scanChosenFolder: "library:scan-chosen-folder",
  setLastSong: "player:set-last-song",
} as const;

// Audio reaches the page through this custom URL scheme, served by the main process
// (src/main/media.ts), instead of file:// URLs.
export const mediaScheme = "miautify-media";

export function songUrl(id: string): string {
  return `${mediaScheme}://song/${encodeURIComponent(id)}`;
}
