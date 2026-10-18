// Runs before the page loads, with access to a small part of Electron. It hands the page
// only the functions listed here, as `window.miautify`, and nothing else from Node or Electron.
import { contextBridge, ipcRenderer } from "electron";
import { ipcChannels, type MiautifyApi } from "../shared/library.js";

const api: MiautifyApi = {
  getStartupState: () => ipcRenderer.invoke(ipcChannels.getStartupState),
  chooseFolder: () => ipcRenderer.invoke(ipcChannels.chooseFolder),
  cachedSongs: () => ipcRenderer.invoke(ipcChannels.cachedSongs),
  scanChosenFolder: () => ipcRenderer.invoke(ipcChannels.scanChosenFolder),
  recheckCovers: () => ipcRenderer.invoke(ipcChannels.recheckCovers),
  onScanProgress: (listener) => {
    // Wrapped so the page never sees Electron's event object, only the two numbers.
    const handler = (_event: Electron.IpcRendererEvent, done: number, total: number) =>
      listener(done, total);
    ipcRenderer.on(ipcChannels.scanProgress, handler);
    return () => ipcRenderer.off(ipcChannels.scanProgress, handler);
  },
  // send, not invoke: nothing to wait for, the page just reports it.
  setLastSong: (id) => ipcRenderer.send(ipcChannels.setLastSong, id),
  savePosition: (id, seconds) => ipcRenderer.send(ipcChannels.savePosition, id, seconds),
  saveVolume: (level, muted) => ipcRenderer.send(ipcChannels.saveVolume, level, muted),
  saveSort: (sort) => ipcRenderer.send(ipcChannels.saveSort, sort),
  savePlayMode: (shuffle, repeat) => ipcRenderer.send(ipcChannels.savePlayMode, shuffle, repeat),
  notePlayed: (id) => ipcRenderer.send(ipcChannels.notePlayed, id),
  setPreference: (key, value) => ipcRenderer.send(ipcChannels.setPreference, key, value),
  markUnplayable: (id) => ipcRenderer.send(ipcChannels.markUnplayable, id),
};

contextBridge.exposeInMainWorld("miautify", api);
