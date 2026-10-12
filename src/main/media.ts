import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { nativeImage, protocol } from "electron";
import { mediaScheme, type Song } from "../shared/library.js";
import type { CoverCache } from "./covers.js";

// Every song found by a scan in this session, by id. Songs from an earlier folder stay
// here, so a song keeps streaming after the user picks a different folder.
const knownSongs = new Map<string, Song>();

export function knownSong(id: string): Song | undefined {
  return knownSongs.get(id);
}

export function rememberSongs(songs: Song[]): void {
  for (const song of songs) {
    knownSongs.set(song.id, song);
  }
}

// Must run before the app is ready. `stream` lets <audio> start playing before the whole
// response has arrived. `corsEnabled` lets responses opt in to being read by the page
// (see the Access-Control-Allow-Origin header below). `supportFetchAPI` lets the page
// download a cover with fetch(), to hand it to the OS media controls (media-session.ts).
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: mediaScheme,
      privileges: {
        standard: true,
        secure: true,
        stream: true,
        corsEnabled: true,
        supportFetchAPI: true,
      },
    },
  ]);
}

// Serves miautify-media://song/<id> (the audio) and miautify-media://cover/<id> (its cover
// thumbnail). Only songs a scan found can be served, so the page can't use this to read any
// other file.
export function handleMediaProtocol(covers: CoverCache): void {
  protocol.handle(mediaScheme, async (request) => {
    const url = new URL(request.url);
    const song = knownSongs.get(decodeURIComponent(url.pathname.slice(1)));
    if (song && url.hostname === "song") {
      return serveFile(song.path, request.headers.get("range"));
    }
    if (song && url.hostname === "cover") {
      return serveCover(covers, song.path);
    }
    return new Response(null, { status: 404 });
  });
}

// A 404 means "no cover", and the page shows its placeholder instead.
async function serveCover(covers: CoverCache, file: string): Promise<Response> {
  try {
    const thumbnail = await covers.thumbnailFor(file);
    if (thumbnail) {
      return new Response(await readFile(thumbnail), {
        headers: { "Content-Type": "image/jpeg", "Access-Control-Allow-Origin": "*" },
      });
    }
  } catch (error) {
    console.warn(`Could not get the cover of ${file}:`, error);
  }
  return new Response(null, { status: 404 });
}

// Thumbnails fit in this many pixels each way. The biggest cover on screen is smaller, with
// room for high-resolution screens.
export const thumbnailSize = 256;

// Shrinks a cover picture to a JPEG thumbnail, keeping its shape. Null if Electron can't
// read it as an image (a broken picture, or a format it doesn't know).
export function makeThumbnail(data: Uint8Array): Buffer | null {
  const image = nativeImage.createFromBuffer(Buffer.from(data));
  if (image.isEmpty()) {
    return null;
  }
  const { width, height } = image.getSize();
  const scale = Math.min(1, thumbnailSize / Math.max(width, height));
  const resized =
    scale < 1
      ? image.resize({
          width: Math.round(width * scale),
          height: Math.round(height * scale),
          quality: "good",
        })
      : image;
  return resized.toJPEG(85);
}

// <audio> only lets you seek when the server answers Range requests with 206 Partial
// Content. Seeking to the middle of a song sends "Range: bytes=N-", and we reply with just
// that part of the file. (Electron's own file loader answers 200 without Content-Range,
// which makes <audio> treat the song as not seekable.)
async function serveFile(file: string, rangeHeader: string | null): Promise<Response> {
  let size: number;
  try {
    ({ size } = await stat(file));
  } catch {
    // Deleted or moved since the scan. The page sees a failed load and skips the song.
    return new Response(null, { status: 404 });
  }
  const headers = {
    "Accept-Ranges": "bytes",
    "Content-Type": "audio/mpeg",
    // The page is a different origin (file://). Without this header, Web Audio treats the
    // song as unreadable and plays silence. Only songs from a scan are served at all, so
    // allowing any origin here doesn't expose anything else.
    "Access-Control-Allow-Origin": "*",
  };

  if (rangeHeader === null) {
    return new Response(fileStream(file, 0, size - 1), {
      status: 200,
      headers: { ...headers, "Content-Length": String(size) },
    });
  }

  const range = parseRange(rangeHeader, size);
  if (!range) {
    return new Response(null, {
      status: 416, // Range Not Satisfiable
      headers: { ...headers, "Content-Range": `bytes */${size}` },
    });
  }

  const [start, end] = range;
  return new Response(fileStream(file, start, end), {
    status: 206,
    headers: {
      ...headers,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
    },
  });
}

// Parses "bytes=START-END", "bytes=START-" and "bytes=-LAST_N" into [start, end], both
// inclusive. Returns null for anything we can't serve, including multiple ranges.
function parseRange(header: string, size: number): [number, number] | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) {
    return null;
  }

  let start: number;
  let end: number;
  if (match[1] === "") {
    // "bytes=-500" means the last 500 bytes.
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  return start <= end && start < size ? [start, end] : null;
}

// Reads only bytes start..end (inclusive) from disk, as a web stream that Response accepts.
function fileStream(file: string, start: number, end: number): ReadableStream {
  return Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
}
