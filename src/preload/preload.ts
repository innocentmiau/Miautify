// Runs before the page loads, with access to a small part of Electron. It hands the page
// only the functions listed here, as `window.miautify`, and nothing else from Node or Electron.
import { contextBridge, ipcRenderer } from "electron";
import { ipcChannels, type MiautifyApi } from "../shared/library.js";

const api: MiautifyApi = {
  getStartupState: () => ipcRenderer.invoke(ipcChannels.getStartupState),
  chooseFolder: () => ipcRenderer.invoke(ipcChannels.chooseFolder),
  scanChosenFolder: () => ipcRenderer.invoke(ipcChannels.scanChosenFolder),
  // send, not invoke: nothing to wait for, the page just reports it.
  setLastSong: (id) => ipcRenderer.send(ipcChannels.setLastSong, id),
};

contextBridge.exposeInMainWorld("miautify", api);
