import path from "node:path";
import { app, BrowserWindow } from "electron";
import { initI18n, pickLanguage } from "../shared/i18n.js";

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
  });

  // The renderer runs its own i18next, so it gets the chosen language in the URL.
  window.loadFile(path.join(import.meta.dirname, "../renderer/index.html"), {
    query: { lang: language },
  });
}

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
