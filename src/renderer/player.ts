import { type Song, songUrl } from "../shared/library.js";
import { Queue } from "./queue.js";
import { clampLevel, defaultLevel, levelToGain } from "./volume.js";

// The only code that touches the <audio> element. The UI calls its methods and listens to
// its events, so later features (queue, next and previous, crossfade, EQ) change what
// happens inside here without touching the UI.
//
// Events:
// - "change": the song changed, it started or stopped playing, or the queue moved.
// - "time": the position or the duration changed. Fires a few times per second while
//   playing, so it's kept separate from "change", which does more work in the UI.
// - "volume": the volume level or mute changed.
//
// Sound path: <audio> -> Web Audio gain node (volume) -> speakers. Crossfade, EQ and
// ducking will be more nodes in this chain, which is why volume doesn't just use the
// <audio> element's own volume.
export class Player extends EventTarget {
  #audio = new Audio();
  #queue: Queue<Song> | null = null;
  #level = defaultLevel;
  #muted = false;
  // Created on first play (see #connectAudio).
  #context: AudioContext | null = null;
  #gain: GainNode | null = null;

  constructor() {
    super();
    // The songs come from miautify-media://, a different origin than the page. Web Audio
    // outputs silence for cross-origin audio unless it's loaded with CORS, which the
    // protocol allows (see src/main/media.ts).
    this.#audio.crossOrigin = "anonymous";
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

  // Slider position, 0 to 1. The gain actually applied follows a curve (see volume.ts).
  get volume(): number {
    return this.#level;
  }

  set volume(level: number) {
    this.#level = clampLevel(level);
    this.#applyVolume();
  }

  get muted(): boolean {
    return this.#muted;
  }

  set muted(muted: boolean) {
    this.#muted = muted;
    this.#applyVolume();
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
    this.#connectAudio();
    this.#audio.play().catch((error: unknown) => {
      // Starting another song before this one loaded cancels this play() on purpose.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error(error);
      }
    });
  }

  // Builds the Web Audio chain the first time something plays. Browsers only let an audio
  // context start after the user did something, and a play is always that.
  #connectAudio(): void {
    if (!this.#context) {
      this.#context = new AudioContext();
      this.#gain = this.#context.createGain();
      this.#gain.gain.value = this.#targetGain();
      this.#context
        .createMediaElementSource(this.#audio)
        .connect(this.#gain)
        .connect(this.#context.destination);
    }
    // A context can be suspended (for example after the audio device changed).
    void this.#context.resume();
  }

  #targetGain(): number {
    return this.#muted ? 0 : levelToGain(this.#level);
  }

  #applyVolume(): void {
    if (this.#context && this.#gain) {
      // Glide to the new gain over about 15 ms instead of jumping: a jump makes a faint
      // click, which dragging the slider would repeat many times a second.
      this.#gain.gain.setTargetAtTime(this.#targetGain(), this.#context.currentTime, 0.015);
    }
    this.dispatchEvent(new Event("volume"));
  }

  #changed(): void {
    this.dispatchEvent(new Event("change"));
  }
}
