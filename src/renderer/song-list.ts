import type { Song } from "../shared/library.js";
import { visibleRange } from "./virtual.js";

export interface SongListOptions {
  // Column titles, in order.
  columns: string[];
  // The text of each column for one song, in the same order.
  cells(song: Song): string[];
  // Whether a song gets the "playing" highlight.
  isPlaying(song: Song): boolean;
  // A song was double-clicked, by its position in the list.
  onPlay(index: number): void;
}

// Every row is this tall, so row i always starts at i * rowHeight (see virtual.ts).
const rowHeight = 36;
const overscan = 10;

// A song list that only creates the rows on screen. However long the list, it keeps a
// small pool of row elements and moves and refills them as you scroll, instead of one
// element per song. That keeps launching and opening big folders fast.
//
// Layout, inside the scrolling container:
//   element        the list: header + body
//     header       column titles, sticky at the top
//     body         as tall as all the rows together, so the scrollbar is right
//       rows       the pool, positioned where their song belongs
export class SongList {
  readonly element = document.createElement("div");
  readonly #scroller: HTMLElement;
  readonly #options: SongListOptions;
  readonly #header = document.createElement("div");
  readonly #body = document.createElement("div");
  readonly #rows: HTMLDivElement[] = [];
  #songs: readonly Song[] = [];
  #framePending = false;

  // `scroller` is the element that scrolls (the list is placed inside it).
  constructor(scroller: HTMLElement, options: SongListOptions) {
    this.#scroller = scroller;
    this.#options = options;

    this.element.className = "song-list";
    this.element.setAttribute("role", "table");
    this.element.style.setProperty("--row-height", `${rowHeight}px`);

    this.#header.className = "song-list-header";
    this.#header.setAttribute("role", "row");
    for (const title of options.columns) {
      const cell = document.createElement("div");
      cell.setAttribute("role", "columnheader");
      cell.textContent = title;
      this.#header.append(cell);
    }

    this.#body.className = "song-list-body";
    this.element.append(this.#header, this.#body);

    // One listener for the whole list instead of one per row. The event bubbles up from
    // the clicked cell. Single click is kept free for selecting songs later.
    this.#body.addEventListener("dblclick", (event) => {
      const row = (event.target as Element).closest<HTMLElement>(".song-row");
      if (row?.dataset.index) {
        options.onPlay(Number(row.dataset.index));
      }
    });

    // Redraw when scrolled or resized, at most once per frame.
    scroller.addEventListener("scroll", () => this.#scheduleRender(), { passive: true });
    new ResizeObserver(() => this.#scheduleRender()).observe(scroller);
  }

  setSongs(songs: readonly Song[]): void {
    this.#songs = songs;
    this.element.setAttribute("aria-rowcount", String(songs.length + 1));
    this.#body.style.height = `${songs.length * rowHeight}px`;
    this.#render({ refill: true });
  }

  // Redraws the rows on screen, for example after the playing song changed.
  refresh(): void {
    this.#render({ refill: true });
  }

  #scheduleRender(): void {
    if (this.#framePending) {
      return;
    }
    this.#framePending = true;
    requestAnimationFrame(() => {
      this.#framePending = false;
      this.#render();
    });
  }

  // Places a pool row at each visible position. A row that already shows the right song
  // keeps its text; `refill` rewrites it anyway (the songs or the highlight changed).
  #render({ refill = false } = {}): void {
    if (!this.element.isConnected) {
      return; // Not on screen (a message is showing instead).
    }
    // Scroll position measured from the top of the rows, not of the header above them.
    const scrollTop = this.#scroller.scrollTop - this.#body.offsetTop;
    const { start, end } = visibleRange(
      scrollTop,
      this.#scroller.clientHeight,
      rowHeight,
      this.#songs.length,
      overscan,
    );

    while (this.#rows.length < end - start) {
      this.#rows.push(this.#createRow());
    }

    for (const [slot, row] of this.#rows.entries()) {
      const index = start + slot;
      if (index >= end) {
        row.hidden = true;
        continue;
      }
      row.hidden = false;
      row.style.transform = `translateY(${index * rowHeight}px)`;
      if (refill || row.dataset.index !== String(index)) {
        this.#fill(row, index);
      }
    }
  }

  #createRow(): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "song-row";
    row.setAttribute("role", "row");
    for (let i = 0; i < this.#options.columns.length; i++) {
      const cell = document.createElement("div");
      cell.setAttribute("role", "cell");
      row.append(cell);
    }
    this.#body.append(row);
    return row;
  }

  #fill(row: HTMLDivElement, index: number): void {
    const song = this.#songs[index];
    row.dataset.index = String(index);
    row.dataset.songId = song.id;
    row.setAttribute("aria-rowindex", String(index + 2)); // The header is row 1.
    row.title = song.path;
    row.classList.toggle("playing", this.#options.isPlaying(song));
    const texts = this.#options.cells(song);
    for (const [i, cell] of [...row.children].entries()) {
      cell.textContent = texts[i];
    }
  }
}
