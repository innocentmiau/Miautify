import { coverUrl, type Song } from "../shared/library.js";
import type { Player } from "./player.js";

// Connects the player to the operating system's media controls, through the browser's
// Media Session API. Chromium passes it on to MPRIS on Linux (KDE's media widget, GNOME's
// media controls, media keys and headphone buttons) and to the System Media Transport
// Controls on Windows (the media overlay and lock screen).
//
// The OS gets: what's playing (title, artist, album, cover), whether it's playing, where it is in
// the song, and handlers for its buttons, which just call the player.
export function connectMediaSession(player: Player, seekStepSeconds: number): void {
  if (!("mediaSession" in navigator)) {
    return;
  }
  const session = navigator.mediaSession;

  session.setActionHandler("play", () => player.resume());
  session.setActionHandler("pause", () => player.pause());
  session.setActionHandler("stop", () => player.pause());
  session.setActionHandler("seekto", (details) => {
    if (details.seekTime !== undefined) {
      player.seek(details.seekTime);
    }
  });
  session.setActionHandler("seekbackward", (details) => {
    player.seek(player.currentTime - (details.seekOffset ?? seekStepSeconds));
  });
  session.setActionHandler("seekforward", (details) => {
    player.seek(player.currentTime + (details.seekOffset ?? seekStepSeconds));
  });

  // "change" also fires on play and pause; the song's details only change with the song.
  let shownSong: Song | null = null;
  player.addEventListener("change", () => {
    const song = player.current;
    if (song !== shownSong) {
      shownSong = song;
      session.metadata = song
        ? new MediaMetadata({
            title: songTitle(song),
            artist: song.artist ?? "",
            album: song.album ?? "",
          })
        : null;
      if (song) {
        void showArtwork(song, () => player.current === song);
      }
    }
    session.playbackState = song ? (player.isPlaying ? "playing" : "paused") : "none";

    // Next and previous only get a handler when there's a song to go to: without one the
    // OS greys out its button, like the app does.
    session.setActionHandler("nexttrack", player.hasNext ? () => player.next() : null);
    session.setActionHandler("previoustrack", player.hasPrevious ? () => player.previous() : null);
    updatePosition(player, session);
  });

  // The OS moves its progress bar along by itself from the last position it was given,
  // so this only needs to be exact, not frequent.
  player.addEventListener("time", () => updatePosition(player, session));
}

// Chromium only passes a cover on to the OS from a web or data: URL, never from our own
// miautify-media: URLs (or blob: URLs, tried). So the page downloads the cover and hands it
// over as a data: URL, the image's bytes written into the URL itself. Thumbnails are small,
// so that's a few KB of text. Chromium saves it to a temporary file for the OS.
//
// `isCurrent` says whether the song is still the one playing once the download is done.
async function showArtwork(song: Song, isCurrent: () => boolean): Promise<void> {
  const session = navigator.mediaSession;
  try {
    const response = await fetch(coverUrl(song.id));
    if (!response.ok) {
      return;
    }
    const url = await dataUrl(await response.blob());
    if (session.metadata && isCurrent()) {
      session.metadata.artwork = [{ src: url, type: "image/jpeg" }];
    }
  } catch {
    // No cover (a 404 is a network error to fetch() on this kind of URL): the OS shows its
    // own placeholder.
  }
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

function songTitle(song: Song): string {
  return song.title ?? song.fileName;
}

function updatePosition(player: Player, session: MediaSession): void {
  const duration = player.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    return;
  }
  session.setPositionState({
    duration,
    playbackRate: 1,
    // Must never be past the end, or the browser throws.
    position: Math.min(Math.max(player.currentTime, 0), duration),
  });
}
