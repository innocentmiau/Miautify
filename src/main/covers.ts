import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Worker } from "node:worker_threads";
import type { CoverReply, CoverRequest } from "./cover-worker.js";

// Small covers for the page, made once and kept on disk.
//
// A cover embedded in an mp3 is usually 1000 px or more (hundreds of KB), but the biggest
// one on screen is a few dozen pixels. So each picture is shrunk once to a small JPEG
// thumbnail, saved as <hash>.jpg in the cache folder, and served from there afterwards. The
// hash is of the picture itself, so the songs of an album share one file.
//
// The database remembers each song's answer (see Storage.coverOf), so a song is only read
// once, and again after its file changes.

// What the cache needs from the database.
export interface CoverStore {
  // The song's cover hash, "" if it has none, or undefined if it was never looked up.
  coverOf(file: string): string | undefined;
  setCover(file: string, hash: string): void;
}

export interface FoundCover {
  hash: string;
  data: Uint8Array;
}

export interface CoverCacheOptions {
  // The folder the thumbnails are saved in.
  folder: string;
  store: CoverStore;
  // Finds a song's cover (in the worker thread, see coverWorker below).
  find: (file: string) => Promise<FoundCover | null>;
  // Shrinks a picture to a JPEG thumbnail, or null if it can't be read as an image.
  // Passed in because it uses Electron, which tests don't have.
  makeThumbnail: (data: Uint8Array) => Buffer | null;
}

export class CoverCache {
  readonly #options: CoverCacheOptions;
  // Songs being looked up right now, so asking twice doesn't read the file twice.
  readonly #pending = new Map<string, Promise<string | null>>();

  constructor(options: CoverCacheOptions) {
    this.#options = options;
  }

  // The thumbnail file for a song, or null if it has no cover.
  thumbnailFor(file: string): Promise<string | null> {
    let pending = this.#pending.get(file);
    if (!pending) {
      pending = this.#lookUp(file).finally(() => this.#pending.delete(file));
      this.#pending.set(file, pending);
    }
    return pending;
  }

  async #lookUp(file: string): Promise<string | null> {
    const { store, find, makeThumbnail } = this.#options;
    const known = store.coverOf(file);
    if (known === "") {
      return null;
    }
    // Known, and its thumbnail is still there (the cache folder may have been deleted).
    if (known !== undefined && (await exists(this.#thumbnailPath(known)))) {
      return this.#thumbnailPath(known);
    }

    const cover = await find(file);
    if (!cover) {
      store.setCover(file, "");
      return null;
    }
    const thumbnail = this.#thumbnailPath(cover.hash);
    // Another song with the same picture may have made it already.
    if (!(await exists(thumbnail))) {
      const jpeg = makeThumbnail(cover.data);
      if (!jpeg) {
        store.setCover(file, ""); // Not an image we can read.
        return null;
      }
      await mkdir(this.#options.folder, { recursive: true });
      await writeFile(thumbnail, jpeg);
    }
    store.setCover(file, cover.hash);
    return thumbnail;
  }

  #thumbnailPath(hash: string): string {
    return path.join(this.#options.folder, `${hash}.jpg`);
  }
}

// Starts the cover worker thread and returns a function that asks it for a song's cover.
// The thread starts on the first request, so a session that shows no covers never starts
// it, and it doesn't keep the app running when everything else has closed (unref).
export function coverWorker(): (file: string) => Promise<FoundCover | null> {
  let worker: Worker | undefined;
  let nextId = 0;
  // Requests waiting for their answer, by id.
  const waiting = new Map<
    number,
    { resolve: (cover: FoundCover | null) => void; reject: (error: Error) => void }
  >();

  return (file) => {
    if (!worker) {
      // Built next to main.js by scripts/build.js.
      worker = new Worker(new URL("./cover-worker.js", import.meta.url));
      worker.unref();
      worker.on("message", ({ id, cover }: CoverReply) => {
        waiting.get(id)?.resolve(cover);
        waiting.delete(id);
      });
      // If the thread dies, everything waiting fails (rather than being saved as "no
      // cover"), and the next request starts a new thread.
      worker.on("error", (error) => {
        console.error("Cover worker failed:", error);
        for (const request of waiting.values()) {
          request.reject(error);
        }
        waiting.clear();
        worker = undefined;
      });
    }
    const id = nextId++;
    worker.postMessage({ id, file } satisfies CoverRequest);
    return new Promise((resolve, reject) => waiting.set(id, { resolve, reject }));
  };
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}
