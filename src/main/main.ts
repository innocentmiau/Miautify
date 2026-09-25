import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { initI18n, pickLanguage } from "../shared/i18n.js";
import { ipcChannels, type Song } from "../shared/library.js";
import { scanFolder } from "./scanner.js";

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
    backgroundColor: "#121212",
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

ipcMain.handle(
  ipcChannels.chooseFolder,
  async (event): Promise<string | null> => {
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
    return chosenFolder;
  },
);

ipcMain.handle(ipcChannels.scanChosenFolder, async (): Promise<Song[]> => {
  if (!chosenFolder) {
    throw new Error("No folder has been chosen yet.");
  }
  return scanFolder(chosenFolder);
});

app.whenReady().then(() => {
  createWindow();

  // macOS keeps apps running with no windows; clicking the dock icon should reopen one.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
