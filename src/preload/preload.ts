// Runs before the page loads, with access to a small part of Electron. It hands the page
// only the functions listed here, as `window.miautify`, and nothing else from Node or Electron.
import { contextBridge, ipcRenderer } from "electron";
import { ipcChannels, type MiautifyApi } from "../shared/library.js";

const api: MiautifyApi = {
  chooseFolder: () => ipcRenderer.invoke(ipcChannels.chooseFolder),
  scanChosenFolder: () => ipcRenderer.invoke(ipcChannels.scanChosenFolder),
};

contextBridge.exposeInMainWorld("miautify", api);
