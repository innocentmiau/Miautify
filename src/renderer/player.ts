import { type Song, songUrl } from "../shared/library.js";

// The only code that touches the <audio> element. The UI calls its methods and listens to
// its events, so later features (queue, next and previous, crossfade, EQ) change what
// happens inside here without touching the UI.
//
// Events:
// - "change": the song changed, or it started or stopped playing.
// - "time": the position or the duration changed. Fires a few times per second while
//   playing, so it's kept separate from "change", which does more work in the UI.
export class Player extends EventTarget {
  #audio = new Audio();
  #current: Song | null = null;

  constructor() {
    super();
    for (const event of ["play", "pause", "ended"]) {
      this.#audio.addEventListener(event, () => this.#changed());
    }
    for (const event of ["timeupdate", "durationchange", "seeking"]) {
      this.#audio.addEventListener(event, () => this.dispatchEvent(new Event("time")));
    }
  }

  get current(): Song | null {
    return this.#current;
  }

  get isPlaying(): boolean {
    return !this.#audio.paused;
  }

  // Seconds from the start of the song.
  get currentTime(): number {
    return this.#audio.currentTime;
  }

  // Length of the song in seconds, or NaN before any song has loaded. Until the audio
  // element has read the file's header, the duration from the scan stands in for it.
  get duration(): number {
    const loaded = this.#audio.duration;
    return Number.isFinite(loaded) ? loaded : (this.#current?.durationSeconds ?? Number.NaN);
  }

  seek(seconds: number): void {
    if (!this.#current || !Number.isFinite(this.duration)) {
      return;
    }
    this.#audio.currentTime = Math.min(Math.max(seconds, 0), this.duration);
  }

  play(song: Song): void {
    this.#current = song;
    this.#audio.src = songUrl(song.id);
    this.#resume();
    this.#changed();
  }

  toggle(): void {
    if (!this.#current) {
      return;
    }
    if (this.#audio.paused) {
      this.#resume();
    } else {
      this.#audio.pause();
    }
  }

  #resume(): void {
    this.#audio.play().catch((error: unknown) => {
      // Starting another song before this one loaded cancels this play() on purpose.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error(error);
      }
    });
  }

  #changed(): void {
    this.dispatchEvent(new Event("change"));
  }
}
