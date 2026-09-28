import { fallbackLanguage, initI18n } from "../shared/i18n.js";
import type { Song } from "../shared/library.js";
import { Player } from "./player.js";

const language = new URLSearchParams(location.search).get("lang") ?? fallbackLanguage;
const t = await initI18n(language);

document.documentElement.lang = language;
document.title = t("app.name");

// Elements are created here rather than written in index.html, so every visible string
// comes from the translation files.
const heading = document.createElement("h1");
heading.textContent = t("app.name");

const chooseButton = document.createElement("button");
chooseButton.type = "button";
chooseButton.textContent = t("library.chooseFolder");

// Rescans the same folder, to pick up files added or changed since. Shown once a folder is open.
const refreshButton = document.createElement("button");
refreshButton.type = "button";
refreshButton.className = "secondary";
refreshButton.textContent = t("library.refresh");
refreshButton.hidden = true;

const folderLabel = document.createElement("span");
folderLabel.className = "folder";

const countLabel = document.createElement("span");
countLabel.className = "count";

const toolbar = getElement("toolbar");
const content = getElement("content");
toolbar.append(heading, chooseButton, refreshButton, folderLabel, countLabel);

const player = new Player();

// The songs in the list, in the order shown. Double-clicking one queues it and every song
// after it.
let listedSongs: Song[] = [];

// Icon shapes (SVG path data, on a 24 by 24 grid).
const playIconPath = "M8 5v14l11-7z";
const pauseIconPath = "M6 5h4v14H6zM14 5h4v14h-4z";
const previousIconPath = "M6 6h2v12H6zm3.5 6 8.5 6V6z";
const nextIconPath = "M6 18l8.5-6L6 6v12zM16 6v12h2V6z";

// Player bar: previous, play/pause and next, then the current song's title and artist.
const previousButton = iconButton(previousIconPath, t("player.previous"));
previousButton.addEventListener("click", () => player.previous());

const toggleButton = document.createElement("button");
toggleButton.type = "button";
toggleButton.className = "toggle";
toggleButton.addEventListener("click", () => player.toggle());

const nextButton = iconButton(nextIconPath, t("player.next"));
nextButton.addEventListener("click", () => player.next());

const buttons = document.createElement("div");
buttons.className = "buttons";
buttons.append(previousButton, toggleButton, nextButton);

const nowTitle = document.createElement("span");
nowTitle.className = "now-title";

const nowArtist = document.createElement("span");
nowArtist.className = "now-artist";

const nowPlaying = document.createElement("div");
nowPlaying.className = "now-playing";
nowPlaying.append(nowTitle, nowArtist);

// Seek row: elapsed time, slider, total time. A native range input comes with keyboard
// support (arrow keys) and screen reader support for free.
const elapsedLabel = document.createElement("span");
elapsedLabel.className = "time";

const seekSlider = document.createElement("input");
seekSlider.type = "range";
seekSlider.className = "seek";
seekSlider.min = "0";
seekSlider.step = "any";
seekSlider.setAttribute("aria-label", t("player.seek"));

const totalLabel = document.createElement("span");
totalLabel.className = "time";

const seekRow = document.createElement("div");
seekRow.className = "seek-row";
seekRow.append(elapsedLabel, seekSlider, totalLabel);

const controls = document.createElement("div");
controls.className = "controls";
controls.append(buttons, seekRow);

// Three columns: song on the left, controls in the center, and the right one kept for
// volume later.
const playerBar = getElement("player-bar");
playerBar.append(nowPlaying, controls, document.createElement("div"));

// While the slider is being dragged, it shows where you are dragging instead of following
// the song, and the seek only happens on release. Seeking on every pixel of the drag would
// send a new request for the file each time.
let draggingSeek = false;

seekSlider.addEventListener("input", () => {
  draggingSeek = true;
  showPosition(Number(seekSlider.value));
});

seekSlider.addEventListener("change", () => {
  draggingSeek = false;
  player.seek(Number(seekSlider.value));
});

// The id last sent to be remembered, so it's only sent when the song actually changes.
let savedSongId: string | null = null;

player.addEventListener("change", () => {
  updatePlayerBar();
  markPlayingRow();

  const id = player.current?.id;
  if (id && id !== savedSongId) {
    savedSongId = id;
    window.miautify.setLastSong(id);
  }
});

player.addEventListener("time", () => {
  if (!draggingSeek) {
    showPosition(player.currentTime);
  }
});

chooseButton.addEventListener("click", async () => {
  setBusy(true);
  try {
    const folder = await window.miautify.chooseFolder();
    if (folder !== null) {
      await openLibrary(folder);
    }
    // null means cancelled: keep whatever was showing before.
  } catch (error) {
    console.error(error);
  } finally {
    setBusy(false);
  }
});

refreshButton.addEventListener("click", async () => {
  setBusy(true);
  try {
    const folder = folderLabel.textContent;
    if (folder) {
      await openLibrary(folder, { refreshing: true });
    }
  } finally {
    setBusy(false);
  }
});

// While a folder is being chosen or scanned, both buttons wait for it to finish.
function setBusy(busy: boolean): void {
  chooseButton.disabled = busy;
  refreshButton.disabled = busy;
}

// On launch: open the folder from last time, and put the last song back in the player bar,
// paused. Called from the end of this file, once everything above and below is defined.
async function restoreLastSession(): Promise<void> {
  setBusy(true);
  try {
    const { folder, lastSongId } = await window.miautify.getStartupState();
    savedSongId = lastSongId;
    if (folder === null) {
      showMessage(t("library.empty"));
      return;
    }

    const songs = await openLibrary(folder);
    // The song may have been deleted or moved since, then there's nothing to restore.
    const index = songs?.findIndex((song) => song.id === lastSongId) ?? -1;
    if (songs && index >= 0) {
      player.selectFrom(songs, index);
    }
  } catch (error) {
    console.error(error);
    showMessage(t("library.empty"));
  } finally {
    setBusy(false);
  }
}

// Scans the folder and lists its songs. Returns them, or null if the folder couldn't be read.
// A refresh keeps the current list on screen until the new one is ready, instead of
// flashing "Scanning...".
async function openLibrary(folder: string, { refreshing = false } = {}): Promise<Song[] | null> {
  folderLabel.textContent = folder;
  folderLabel.title = folder;
  if (!refreshing) {
    countLabel.textContent = "";
    showMessage(t("library.scanning"));
  }

  try {
    const songs = await window.miautify.scanChosenFolder();
    refreshButton.hidden = false;
    countLabel.textContent = t("library.songCount", { count: songs.length });
    if (songs.length === 0) {
      showMessage(t("library.noSongs"));
    } else {
      showSongs(songs);
    }
    return songs;
  } catch (error) {
    console.error(error);
    showMessage(t("library.scanFailed"));
    return null;
  }
}

function showMessage(text: string): void {
  const message = document.createElement("p");
  message.className = "message";
  message.textContent = text;
  content.replaceChildren(message);
}

function showSongs(songs: Song[]): void {
  const table = document.createElement("table");
  table.className = "songs";

  const headerRow = table.createTHead().insertRow();
  for (const label of [t("song.title"), t("song.artist"), t("song.album"), t("song.duration")]) {
    const cell = document.createElement("th");
    cell.textContent = label;
    headerRow.append(cell);
  }

  const body = table.createTBody();
  for (const song of songs) {
    const row = body.insertRow();
    row.dataset.songId = song.id;
    row.title = song.path;
    // Files without a title tag are shown by their file name.
    for (const text of [
      song.title ?? song.fileName,
      song.artist ?? "",
      song.album ?? "",
      formatDuration(song.durationSeconds),
    ]) {
      row.insertCell().textContent = text;
    }
  }

  // One listener for the whole table instead of one per row: with thousands of songs that
  // is thousands fewer listeners. The event bubbles up from the clicked cell to here.
  // Double-click plays; single click is kept free for selecting songs later.
  body.addEventListener("dblclick", (event) => {
    const row = (event.target as Element).closest("tr");
    if (row) {
      // sectionRowIndex is the row's position in the table body, which is the song's
      // position in the list.
      player.playFrom(listedSongs, row.sectionRowIndex);
    }
  });

  listedSongs = songs;
  content.replaceChildren(table);
  markPlayingRow();
}

function updatePlayerBar(): void {
  const song = player.current;
  playerBar.hidden = song === null;
  if (!song) {
    return;
  }

  nowTitle.textContent = song.title ?? song.fileName;
  nowArtist.textContent = song.artist ?? "";
  const label = player.isPlaying ? t("player.pause") : t("player.play");
  toggleButton.title = label;
  toggleButton.setAttribute("aria-label", label);
  toggleButton.replaceChildren(icon(player.isPlaying ? pauseIconPath : playIconPath));
  previousButton.disabled = !player.hasPrevious;
  nextButton.disabled = !player.hasNext;
}

// Updates the seek row to show `seconds` into the current song.
function showPosition(seconds: number): void {
  const duration = player.duration;
  const known = Number.isFinite(duration) && duration > 0;
  seekSlider.disabled = !known;
  seekSlider.max = String(known ? duration : 0);
  seekSlider.value = String(known ? seconds : 0);
  // The played part of the track is colored with a CSS gradient that reads this variable.
  seekSlider.style.setProperty("--progress", `${known ? (seconds / duration) * 100 : 0}%`);

  const elapsed = formatDuration(known ? seconds : 0);
  const total = known ? formatDuration(duration) : "";
  elapsedLabel.textContent = elapsed;
  totalLabel.textContent = total;
  seekSlider.setAttribute("aria-valuetext", t("player.position", { elapsed, total }));
}

// Highlights the row of the song that is playing, if it's in the current list.
function markPlayingRow(): void {
  for (const row of content.querySelectorAll("tr.playing")) {
    row.classList.remove("playing");
  }
  const id = player.current?.id;
  if (id) {
    content.querySelector(`tr[data-song-id="${id}"]`)?.classList.add("playing");
  }
}

// A small round button showing only an icon. The label is for screen readers and the
// tooltip, since there's no visible text.
function iconButton(pathData: string, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.append(icon(pathData));
  return button;
}

function icon(pathData: string): SVGSVGElement {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", pathData);
  svg.append(path);
  return svg;
}

// Numbers go through Intl so digits follow the language. Intl.DurationFormat would be the
// obvious choice, but it always pads minutes ("03:05"), and music players show "3:05".
const plainNumber = new Intl.NumberFormat(language, { useGrouping: false });
const twoDigitNumber = new Intl.NumberFormat(language, { minimumIntegerDigits: 2 });

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined) {
    return "";
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  return `${plainNumber.format(minutes)}:${twoDigitNumber.format(total % 60)}`;
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} in index.html`);
  }
  return element;
}

// Last line on purpose: restoring uses constants defined above (like the number formats),
// which don't exist yet while the file is still being read from top to bottom.
void restoreLastSession();
