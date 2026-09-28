import { stat } from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { initI18n, pickLanguage } from "../shared/i18n.js";
import { ipcChannels, type ScanOutcome, type Song, type StartupState } from "../shared/library.js";
import { handleMediaProtocol, knownSong, registerMediaScheme, rememberSongs } from "./media.js";
import { scanFolder, songsFromCache } from "./scanner.js";
import { Storage } from "./storage.js";

// Opened when the app is ready (see the bottom of this file).
let storage: Storage;

async function createWindow(): Promise<void> {
  // A manual override from settings will take priority here once settings exist.
  const language = pickLanguage(app.getPreferredSystemLanguages());
  const t = await initI18n(language);

  const window = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 480,
    minHeight: 320,
    title: t("app.name"),
    // Shown for a moment before the page's CSS loads. Keep it equal to --background in
    // styles.css, or the window flashes a different color on launch.
    backgroundColor: "#0b1724",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(import.meta.dirname, "../preload/preload.cjs"),
    },
  });

  // The renderer runs its own i18next, so it gets the chosen language in the URL.
  window.loadFile(path.join(import.meta.dirname, "../renderer/index.html"), {
    query: { lang: language },
  });
}

// The page can't open dialogs or read files itself, so it asks for these through the
// preload bridge. The chosen folder stays here in the main process: the page never sends a
// path, so it can only get songs from a folder the user picked in the dialog.
let chosenFolder: string | undefined;

ipcMain.handle(ipcChannels.getStartupState, async (): Promise<StartupState> => {
  const folder = storage.get("library.folder");
  // The folder may be gone (renamed, or on a drive that isn't plugged in). The setting is
  // kept anyway, so it works again next launch if the drive comes back.
  if (folder && (await isFolder(folder))) {
    chosenFolder = folder;
  }
  return {
    folder: chosenFolder ?? null,
    lastSongId: storage.get("player.lastSongId") ?? null,
    volume: storage.get("player.volume") ?? null,
    muted: storage.get("player.muted") ?? false,
    showAllSongs: storage.get("library.showAllSongs") ?? false,
  };
});

ipcMain.handle(ipcChannels.chooseFolder, async (event): Promise<string | null> => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const options: Electron.OpenDialogOptions = {
    properties: ["openDirectory"],
  };
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  chosenFolder = result.filePaths[0];
  storage.set("library.folder", chosenFolder);
  return chosenFolder;
});

ipcMain.handle(ipcChannels.cachedSongs, (): Song[] => {
  if (!chosenFolder) {
    return [];
  }
  const songs = songsFromCache(chosenFolder, storage.cachedSongs());
  // Playable right away. If a file is gone, the scan that follows takes it off the list.
  rememberSongs(songs);
  return songs;
});

ipcMain.handle(ipcChannels.scanChosenFolder, async (event): Promise<ScanOutcome> => {
  if (!chosenFolder) {
    throw new Error("No folder has been chosen yet.");
  }
  const started = performance.now();

  // At most one progress message every 100 ms (plus the last one): the page only needs to
  // redraw a counter, not receive thousands of messages.
  let lastSent = 0;
  const onProgress = (done: number, total: number) => {
    const now = performance.now();
    if (done === total || now - lastSent >= 100) {
      lastSent = now;
      event.sender.send(ipcChannels.scanProgress, done, total);
    }
  };

  const { songs, changed, removed } = await scanFolder(chosenFolder, storage.cachedSongs(), {
    onProgress,
  });
  storage.saveScan(changed, removed);
  rememberSongs(songs);

  const ms = Math.round(performance.now() - started);
  console.info(`Scanned ${songs.length} songs in ${ms} ms (${changed.length} read from disk)`);
  return { songs, changed: changed.length > 0 || removed.length > 0 };
});

ipcMain.on(ipcChannels.setLastSong, (_event, id: unknown) => {
  // Anything from the page is checked before it's stored.
  if (typeof id === "string") {
    storage.set("player.lastSongId", id);
  }
});

ipcMain.on(ipcChannels.saveVolume, (_event, level: unknown, muted: unknown) => {
  if (typeof level === "number" && level >= 0 && level <= 1 && typeof muted === "boolean") {
    storage.set("player.volume", level);
    storage.set("player.muted", muted);
  }
});

ipcMain.on(ipcChannels.saveShowAllSongs, (_event, showAll: unknown) => {
  if (typeof showAll === "boolean") {
    storage.set("library.showAllSongs", showAll);
  }
});

ipcMain.on(ipcChannels.markUnplayable, (_event, id: unknown) => {
  // The page sends an id, never a path; only songs from a scan can be marked.
  const song = typeof id === "string" ? knownSong(id) : undefined;
  if (!song) {
    return;
  }
  // The page can't tell a broken file from one deleted since the scan (both just fail to
  // load). Only a file that's still there is remembered as broken; a missing one is
  // dropped by the next scan anyway.
  void stat(song.path).then(
    () => {
      song.unplayable = true;
      storage.markUnplayable(song.path);
    },
    () => {},
  );
});

async function isFolder(folder: string): Promise<boolean> {
  try {
    return (await stat(folder)).isDirectory();
  } catch {
    return false;
  }
}

registerMediaScheme();

app.whenReady().then(() => {
  // userData is the app's own data folder, for example ~/.config/Miautify on Linux and
  // %APPDATA%\Miautify on Windows.
  storage = new Storage(path.join(app.getPath("userData"), "miautify.db"));
  handleMediaProtocol();
  createWindow();

  // macOS keeps apps running with no windows; clicking the dock icon should reopen one.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("will-quit", () => {
  storage?.close();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
