import { type Song, songUrl } from "../shared/library.js";
import { Queue } from "./queue.js";

// The only code that touches the <audio> element. The UI calls its methods and listens to
// its events, so later features (queue, next and previous, crossfade, EQ) change what
// happens inside here without touching the UI.
//
// Events:
// - "change": the song changed, it started or stopped playing, or the queue moved.
// - "time": the position or the duration changed. Fires a few times per second while
//   playing, so it's kept separate from "change", which does more work in the UI.
export class Player extends EventTarget {
  #audio = new Audio();
  #queue: Queue<Song> | null = null;

  constructor() {
    super();
    for (const event of ["play", "pause"]) {
      this.#audio.addEventListener(event, () => this.#changed());
    }
    // Auto-advance. At the end of the queue, playback just stops.
    this.#audio.addEventListener("ended", () => {
      if (!this.next()) {
        this.#changed();
      }
    });
    for (const event of ["timeupdate", "durationchange", "seeking"]) {
      this.#audio.addEventListener(event, () => this.dispatchEvent(new Event("time")));
    }
  }

  get current(): Song | null {
    return this.#queue?.current ?? null;
  }

  get hasNext(): boolean {
    return this.#queue?.hasNext ?? false;
  }

  get hasPrevious(): boolean {
    return this.#queue?.hasPrevious ?? false;
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
    return Number.isFinite(loaded) ? loaded : (this.current?.durationSeconds ?? Number.NaN);
  }

  seek(seconds: number): void {
    if (!this.current || !Number.isFinite(this.duration)) {
      return;
    }
    this.#audio.currentTime = Math.min(Math.max(seconds, 0), this.duration);
  }

  // Starts a new queue: `songs[start]` and every song after it, in order.
  playFrom(songs: readonly Song[], start: number): void {
    this.#queue = new Queue(songs.slice(start));
    this.#load(this.#queue.current);
  }

  // Same queue as playFrom, but paused: the song shows in the player bar, ready to play.
  selectFrom(songs: readonly Song[], start: number): void {
    this.#queue = new Queue(songs.slice(start));
    this.#load(this.#queue.current, { autoplay: false });
  }

  // Returns false (and does nothing) at the end of the queue.
  next(): boolean {
    const song = this.#queue?.next();
    if (!song) {
      return false;
    }
    this.#load(song);
    return true;
  }

  // Returns false (and does nothing) at the start of the queue.
  previous(): boolean {
    const song = this.#queue?.previous();
    if (!song) {
      return false;
    }
    this.#load(song);
    return true;
  }

  toggle(): void {
    if (!this.current) {
      return;
    }
    if (this.#audio.paused) {
      this.#resume();
    } else {
      this.#audio.pause();
    }
  }

  #load(song: Song, { autoplay = true } = {}): void {
    this.#audio.src = songUrl(song.id);
    if (autoplay) {
      this.#resume();
    }
    this.#changed();
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
