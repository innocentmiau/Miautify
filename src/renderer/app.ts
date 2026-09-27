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

const folderLabel = document.createElement("span");
folderLabel.className = "folder";

const countLabel = document.createElement("span");
countLabel.className = "count";

const toolbar = getElement("toolbar");
const content = getElement("content");
toolbar.append(heading, chooseButton, folderLabel, countLabel);

const player = new Player();

// The songs in the list, by id, so a double-clicked row can find its song.
let listedSongs = new Map<string, Song>();

// Player bar: play/pause button, then the current song's title and artist.
const toggleButton = document.createElement("button");
toggleButton.type = "button";
toggleButton.className = "toggle";
toggleButton.addEventListener("click", () => player.toggle());

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
controls.append(toggleButton, seekRow);

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

player.addEventListener("change", () => {
  updatePlayerBar();
  markPlayingRow();
});

player.addEventListener("time", () => {
  if (!draggingSeek) {
    showPosition(player.currentTime);
  }
});

showMessage(t("library.empty"));

chooseButton.addEventListener("click", async () => {
  chooseButton.disabled = true;
  try {
    const folder = await window.miautify.chooseFolder();
    if (folder === null) {
      return; // Cancelled: keep whatever was showing before.
    }

    folderLabel.textContent = folder;
    folderLabel.title = folder;
    countLabel.textContent = "";
    showMessage(t("library.scanning"));

    const songs = await window.miautify.scanChosenFolder();
    countLabel.textContent = t("library.songCount", { count: songs.length });
    if (songs.length === 0) {
      showMessage(t("library.noSongs"));
    } else {
      showSongs(songs);
    }
  } catch (error) {
    console.error(error);
    showMessage(t("library.scanFailed"));
  } finally {
    chooseButton.disabled = false;
  }
});

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
    const song = row?.dataset.songId ? listedSongs.get(row.dataset.songId) : undefined;
    if (song) {
      player.play(song);
    }
  });

  listedSongs = new Map(songs.map((song) => [song.id, song]));
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

const playIconPath = "M8 5v14l11-7z";
const pauseIconPath = "M6 5h4v14H6zM14 5h4v14h-4z";

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
