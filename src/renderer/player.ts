import { type Song, songUrl } from "../shared/library.js";

// The only code that touches the <audio> element. The UI calls its methods and listens to
// its "change" event, so later features (queue, next and previous, crossfade, EQ) change
// what happens inside here without touching the UI.
export class Player extends EventTarget {
  #audio = new Audio();
  #current: Song | null = null;

  constructor() {
    super();
    for (const event of ["play", "pause", "ended"]) {
      this.#audio.addEventListener(event, () => this.#changed());
    }
  }

  get current(): Song | null {
    return this.#current;
  }

  get isPlaying(): boolean {
    return !this.#audio.paused;
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
