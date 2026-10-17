import { type RepeatMode, type Song, songUrl } from "../shared/library.js";
import { PlayOrder } from "./play-order.js";
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
// - "unplayable": a song couldn't be played (detail: { song }). It's marked, and if it
//   was meant to play, the next playable song starts instead.
// - "played": a song started playing (detail: { song }), once per time it's loaded or
//   repeated. Feeds the play history that shuffle uses.
//
// Sound path: <audio> -> Web Audio gain node (volume) -> speakers. Crossfade, EQ and
// ducking will be more nodes in this chain, which is why volume doesn't just use the
// <audio> element's own volume.
export class Player extends EventTarget {
  #audio = new Audio();
  // What plays next, with shuffle and repeat (see play-order.ts).
  #order = new PlayOrder<Song>({ key: (song) => song.id });
  // The song last reported as "played", so pausing and resuming doesn't count again.
  #countedSong: Song | null = null;
  // Whether the current song is meant to be playing (as opposed to loaded paused), so a
  // failure knows whether to move on to the next song.
  #wantsToPlay = false;
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
    // Auto-advance. At the end of the queue (without repeat), playback just stops.
    this.#audio.addEventListener("ended", () => {
      const song = this.#order.afterEnd(isUnplayable);
      if (song === this.current && song !== null) {
        // Repeat one: start the same song over, without loading it again.
        this.#countedSong = null;
        this.#audio.currentTime = 0;
        this.#resume();
      } else if (song) {
        this.#load(song);
      } else {
        this.#changed();
      }
    });
    this.#audio.addEventListener("error", () => this.#failed());
    // "playing": sound actually started, so a file that fails to load never counts. It
    // also fires after pauses and buffering, so each song only counts once per load.
    this.#audio.addEventListener("playing", () => {
      const song = this.current;
      if (song && song !== this.#countedSong) {
        this.#countedSong = song;
        this.#order.notePlayed(song);
        this.dispatchEvent(new CustomEvent("played", { detail: { song } }));
      }
    });
    for (const event of ["timeupdate", "durationchange", "seeking"]) {
      this.#audio.addEventListener(event, () => this.dispatchEvent(new Event("time")));
    }
  }

  get current(): Song | null {
    return this.#order.current;
  }

  // Whether there's a playable song after or before the current one.
  get hasNext(): boolean {
    return this.#order.hasNext(isUnplayable);
  }

  get hasPrevious(): boolean {
    return this.#order.hasPrevious(isUnplayable);
  }

  get shuffle(): boolean {
    return this.#order.shuffle;
  }

  // Applies to the songs after the current one, which keeps playing.
  set shuffle(on: boolean) {
    this.#order.setShuffle(on);
    this.#changed();
  }

  get repeat(): RepeatMode {
    return this.#order.repeat;
  }

  set repeat(mode: RepeatMode) {
    this.#order.repeat = mode;
    this.#changed(); // Next may be possible now (or no longer).
  }

  // When each song last started playing (song id, time), saved from earlier sessions.
  // Shuffle deals recently heard songs last.
  setPlayHistory(entries: Iterable<[string, number]>): void {
    for (const [id, time] of entries) {
      this.#order.lastPlayed.set(id, time);
    }
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

  // Starts playing `songs` from `songs[start]` (then the rest in order, or shuffled).
  playFrom(songs: readonly Song[], start: number): void {
    if (isUnplayable(songs[start])) {
      // Known not to play: say so. The next song that can play starts instead.
      this.#announceUnplayable(songs[start]);
    }
    const song = this.#order.start(songs, start, isUnplayable);
    if (song) {
      this.#load(song);
    }
    // Null: nothing in the list can play, and whatever was playing carries on.
  }

  // Same as playFrom, but paused: the song shows in the player bar, ready to play.
  selectFrom(songs: readonly Song[], start: number): void {
    const song = this.#order.start(songs, start);
    if (song) {
      this.#load(song, { autoplay: false });
    }
  }

  // Makes `songs` the list the current song is in, without interrupting it: it keeps
  // playing from where it is, and next and previous follow the new list. `songs[start]`
  // must be the current song (the same id).
  continueIn(songs: readonly Song[], start: number): void {
    this.#order.start(songs, start);
    this.#changed();
  }

  // Stops and forgets the current song and its list: the player bar goes away, as if
  // nothing had been played yet.
  clear(): void {
    this.#wantsToPlay = false;
    this.#countedSong = null;
    this.#order.clear();
    this.#audio.pause();
    // Without a source the element lets go of the file. (src = "" would try to load the
    // page itself as a song and fail.)
    this.#audio.removeAttribute("src");
    this.#audio.load();
    this.#changed();
  }

  // Returns false (and does nothing) at the end of the queue.
  next(): boolean {
    const song = this.#order.next(isUnplayable);
    if (!song) {
      return false;
    }
    this.#load(song);
    return true;
  }

  // Returns false (and does nothing) at the start of the queue.
  previous(): boolean {
    const song = this.#order.previous(isUnplayable);
    if (!song) {
      return false;
    }
    this.#load(song);
    return true;
  }

  toggle(): void {
    if (this.#audio.paused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  // Plays the current song from where it is. Does nothing without a song.
  resume(): void {
    if (this.current && this.#audio.paused) {
      this.#resume();
    }
  }

  pause(): void {
    this.#wantsToPlay = false;
    this.#audio.pause();
  }

  #load(song: Song, { autoplay = true } = {}): void {
    this.#wantsToPlay = autoplay;
    this.#countedSong = null;
    this.#audio.src = songUrl(song.id);
    if (autoplay) {
      this.#resume();
    }
    this.#changed();
  }

  #resume(): void {
    this.#wantsToPlay = true;
    this.#connectAudio();
    this.#audio.play().catch((error: unknown) => {
      // AbortError: starting another song before this one loaded cancels this play() on
      // purpose. NotSupportedError: the file can't play, handled by #failed().
      const expected = ["AbortError", "NotSupportedError"];
      if (!(error instanceof DOMException && expected.includes(error.name))) {
        console.error(error);
      }
    });
  }

  // The <audio> element couldn't load or decode the current song.
  #failed(): void {
    const song = this.current;
    if (!song || this.#audio.error?.code === MediaError.MEDIA_ERR_ABORTED) {
      return; // Aborted: a different song was loaded on purpose, nothing failed.
    }
    this.#announceUnplayable(song);
    if (this.#wantsToPlay && this.next()) {
      return; // Moved on to the next playable song.
    }
    // Stays on this song, e.g. when it was the last in the queue. A failed <audio> doesn't
    // mark itself as paused, so without this the bar would keep showing "Pause".
    this.#wantsToPlay = false;
    this.#audio.pause();
    this.#changed();
  }

  // Marks the song (so queues skip it) and tells the page, which saves it and says so.
  #announceUnplayable(song: Song): void {
    song.unplayable = true;
    this.dispatchEvent(new CustomEvent("unplayable", { detail: { song } }));
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

function isUnplayable(song: Song): boolean {
  return song.unplayable === true;
}
