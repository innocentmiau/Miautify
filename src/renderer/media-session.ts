import type { Player } from "./player.js";

// Connects the player to the operating system's media controls, through the browser's
// Media Session API. Chromium passes it on to MPRIS on Linux (KDE's media widget, GNOME's
// media controls, media keys and headphone buttons) and to the System Media Transport
// Controls on Windows (the media overlay and lock screen).
//
// The OS gets: what's playing (title, artist, album), whether it's playing, where it is in
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

  player.addEventListener("change", () => {
    const song = player.current;
    session.metadata = song
      ? new MediaMetadata({
          title: song.title ?? song.fileName,
          artist: song.artist ?? "",
          album: song.album ?? "",
        })
      : null;
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
