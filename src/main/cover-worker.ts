import { createHash } from "node:crypto";
import { parentPort } from "node:worker_threads";
import { readCover } from "./cover-source.js";

// A worker thread that finds covers, so reading and parsing mp3 files never holds up the
// main process (which also serves the audio). The old player read covers on the main
// process, and songs took longer to start while covers loaded.
//
// Gets { id, file }, answers { id, cover }: the image bytes plus a hash of them, or null.

export interface CoverRequest {
  id: number;
  file: string;
}

export interface CoverReply {
  id: number;
  cover: { hash: string; data: Uint8Array } | null;
}

parentPort?.on("message", async ({ id, file }: CoverRequest) => {
  const found = await readCover(file);
  // A copy with its own memory: Node's buffers can share a block with others, which can't
  // be moved to another thread.
  const data = found ? new Uint8Array(found) : null;
  const reply: CoverReply = {
    id,
    // The hash names the thumbnail, so songs with the same picture (an album) share one.
    cover: data
      ? { hash: createHash("sha256").update(data).digest("hex").slice(0, 16), data }
      : null,
  };
  // The bytes are moved to the main thread, not copied.
  parentPort?.postMessage(reply, data ? [data.buffer] : []);
});
