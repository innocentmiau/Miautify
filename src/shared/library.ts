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

// What the preload script exposes to the page as `window.miautify`.
export interface MiautifyApi {
  // Opens the folder picker. Resolves to the chosen folder, or null if the user cancels.
  chooseFolder(): Promise<string | null>;
  // Scans the folder picked last. The page can't pass a path of its own.
  scanChosenFolder(): Promise<Song[]>;
}

export const ipcChannels = {
  chooseFolder: "library:choose-folder",
  scanChosenFolder: "library:scan-chosen-folder",
} as const;

// Audio reaches the page through this custom URL scheme, served by the main process
// (src/main/media.ts), instead of file:// URLs.
export const mediaScheme = "miautify-media";

export function songUrl(id: string): string {
  return `${mediaScheme}://song/${encodeURIComponent(id)}`;
}
