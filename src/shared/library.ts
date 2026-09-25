// Types shared by the main process, the preload bridge and the renderer.

export interface Song {
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
