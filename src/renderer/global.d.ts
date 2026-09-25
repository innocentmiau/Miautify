import type { MiautifyApi } from "../shared/library.js";

// Added by the preload script (src/preload/preload.ts).
declare global {
  interface Window {
    miautify: MiautifyApi;
  }
}
