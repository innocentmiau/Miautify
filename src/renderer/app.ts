import { fallbackLanguage, initI18n } from "../shared/i18n.js";
import type { Song } from "../shared/library.js";

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

  content.replaceChildren(table);
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
