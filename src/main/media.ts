import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { protocol } from "electron";
import { mediaScheme, type Song } from "../shared/library.js";

// Every song found by a scan in this session, by id. Songs from an earlier folder stay
// here, so a song keeps streaming after the user picks a different folder.
const knownSongs = new Map<string, Song>();

export function rememberSongs(songs: Song[]): void {
  for (const song of songs) {
    knownSongs.set(song.id, song);
  }
}

// Must run before the app is ready. `stream` lets <audio> start playing before the whole
// response has arrived.
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: mediaScheme, privileges: { standard: true, secure: true, stream: true } },
  ]);
}

// Serves miautify-media://song/<id>. Only songs a scan found can be served, so the page
// can't use this to read any other file.
export function handleMediaProtocol(): void {
  protocol.handle(mediaScheme, async (request) => {
    const url = new URL(request.url);
    const song =
      url.hostname === "song" ? knownSongs.get(decodeURIComponent(url.pathname.slice(1))) : null;
    if (!song) {
      return new Response(null, { status: 404 });
    }
    return serveFile(song.path, request.headers.get("range"));
  });
}

// <audio> only lets you seek when the server answers Range requests with 206 Partial
// Content. Seeking to the middle of a song sends "Range: bytes=N-", and we reply with just
// that part of the file. (Electron's own file loader answers 200 without Content-Range,
// which makes <audio> treat the song as not seekable.)
async function serveFile(file: string, rangeHeader: string | null): Promise<Response> {
  const { size } = await stat(file);
  const headers = { "Accept-Ranges": "bytes", "Content-Type": "audio/mpeg" };

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
