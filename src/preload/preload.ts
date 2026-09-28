// Runs before the page loads, with access to a small part of Electron. It hands the page
// only the functions listed here, as `window.miautify`, and nothing else from Node or Electron.
import { contextBridge, ipcRenderer } from "electron";
import { ipcChannels, type MiautifyApi } from "../shared/library.js";

const api: MiautifyApi = {
  getStartupState: () => ipcRenderer.invoke(ipcChannels.getStartupState),
  chooseFolder: () => ipcRenderer.invoke(ipcChannels.chooseFolder),
  cachedSongs: () => ipcRenderer.invoke(ipcChannels.cachedSongs),
  scanChosenFolder: () => ipcRenderer.invoke(ipcChannels.scanChosenFolder),
  onScanProgress: (listener) => {
    // Wrapped so the page never sees Electron's event object, only the two numbers.
    const handler = (_event: Electron.IpcRendererEvent, done: number, total: number) =>
      listener(done, total);
    ipcRenderer.on(ipcChannels.scanProgress, handler);
    return () => ipcRenderer.off(ipcChannels.scanProgress, handler);
  },
  // send, not invoke: nothing to wait for, the page just reports it.
  setLastSong: (id) => ipcRenderer.send(ipcChannels.setLastSong, id),
};

contextBridge.exposeInMainWorld("miautify", api);
