import { fallbackLanguage, initI18n } from "../shared/i18n.js";
import type { Song } from "../shared/library.js";
import { defaultPreferences, type PreferenceKey, type Preferences } from "../shared/preferences.js";
import { FolderTree } from "./folder-tree.js";
import { buildFolderTree, type Folder, findFolder, folderOfSong, songsShown } from "./folders.js";
import { connectMediaSession } from "./media-session.js";
import { Player } from "./player.js";
import { SettingsPage } from "./settings-page.js";
import { shortcutList } from "./shortcut-list.js";
import { type Action, actionFor } from "./shortcuts.js";
import { SongList } from "./song-list.js";

const language = new URLSearchParams(location.search).get("lang") ?? fallbackLanguage;
const t = await initI18n(language);

document.documentElement.lang = language;
document.title = t("app.name");

// Elements are created here rather than written in index.html, so every visible string
// comes from the translation files.
// The app icon next to the name (generated from assets/icon.svg by the build). Empty alt:
// the name right after it already says what it is.
const logo = document.createElement("img");
logo.src = "../icons/icon-128.png";
logo.alt = "";
logo.className = "logo";

const heading = document.createElement("h1");
heading.append(logo, t("app.name"));

const chooseButton = document.createElement("button");
chooseButton.type = "button";
chooseButton.className = "primary";
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

// What's happening in the background: "Checking for changes..." or reading progress.
const statusLabel = document.createElement("span");
statusLabel.className = "status";

// Short-lived messages about problems, like a file that couldn't play (see showNotice).
const noticeLabel = document.createElement("span");
noticeLabel.className = "notice";
noticeLabel.setAttribute("role", "status"); // Screen readers announce it when it changes.

const toolbar = getElement("toolbar");
const content = getElement("content");
toolbar.append(heading, folderLabel, countLabel, statusLabel, noticeLabel);

const player = new Player();

// The chosen music folder, its songs as a tree of folders, and the folder open on screen.
// `tree` is null while nothing is shown yet (never scanned, or no songs).
let libraryRoot = "";
let tree: Folder | null = null;
let openFolder: Folder | null = null;

// The open folder's own songs, in the order shown. Double-clicking one queues it and every
// song after it, so a folder plays like a playlist.
let listedSongs: Song[] = [];

// Above the songs: the path to the open folder, then its subfolders.
const breadcrumb = document.createElement("nav");
breadcrumb.className = "breadcrumb";
breadcrumb.setAttribute("aria-label", t("library.folderPath"));

// The user's preferences (the Settings page). Loaded on launch; changed through
// setPreference(), which saves them and applies them.
let preferences: Preferences = { ...defaultPreferences };

// Above the folder's contents: the path to it.
const folderHeader = document.createElement("div");
folderHeader.className = "folder-header";
folderHeader.append(breadcrumb);

const folderGrid = document.createElement("div");
folderGrid.className = "folder-grid";

// The main menu on the left edge: the folder tree, then library actions and Settings at
// the bottom.
const folderTree = new FolderTree({
  onOpen: (folder) => showFolder(folder),
  expandLabel: t("menu.expand"),
  collapseLabel: t("menu.collapse"),
});

const foldersHeading = document.createElement("h2");
foldersHeading.textContent = t("menu.folders");

const menuActions = document.createElement("div");
menuActions.className = "menu-actions";
// Opens the Settings page (also Ctrl+,).
const settingsButton = document.createElement("button");
settingsButton.type = "button";
settingsButton.className = "secondary";
settingsButton.textContent = t("settings.title");
settingsButton.addEventListener("click", () => openSettings());

menuActions.append(chooseButton, refreshButton, settingsButton);

const menu = document.createElement("div");
menu.className = "menu";
menu.append(foldersHeading, folderTree.element, menuActions);

const songList = new SongList(content, {
  columns: [t("song.title"), t("song.artist"), t("song.album"), t("song.duration")],
  // Files without a title tag are shown by their file name.
  cells: (song) => [
    song.title ?? song.fileName,
    song.artist ?? "",
    song.album ?? "",
    formatDuration(song.durationSeconds),
  ],
  isPlaying: (song) => song.id === player.current?.id,
  unplayableLabel: t("player.unplayable"),
  onPlay: (index) => player.playFrom(listedSongs, index),
});

// Icon shapes (SVG path data, on a 24 by 24 grid).
const playIconPath = "M8 5v14l11-7z";
const pauseIconPath = "M6 5h4v14H6zM14 5h4v14h-4z";
const previousIconPath = "M6 6h2v12H6zm3.5 6 8.5 6V6z";
const nextIconPath = "M6 18l8.5-6L6 6v12zM16 6v12h2V6z";
const volumeHighIconPath =
  "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z";
const volumeLowIconPath =
  "M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z";
const menuIconPath = "M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z";
const folderIconPath =
  "M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z";
const volumeOffIconPath =
  "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z";

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

// Volume: mute button and slider, in the bar's right column.
const muteButton = iconButton(volumeHighIconPath, t("player.mute"));
muteButton.addEventListener("click", () => {
  player.muted = !player.muted;
  saveVolume();
});

const volumeSlider = document.createElement("input");
volumeSlider.type = "range";
volumeSlider.className = "volume";
volumeSlider.min = "0";
volumeSlider.max = "1";
volumeSlider.step = "0.01";
volumeSlider.setAttribute("aria-label", t("player.volume"));
// Moving the slider while muted unmutes, like most players.
volumeSlider.addEventListener("input", () => {
  // Read the slider first: each change below redraws the volume control, which would
  // put the old level back into the slider before we read it.
  const level = Number(volumeSlider.value);
  player.muted = false;
  player.volume = level;
});
// Saved on release, not on every step of a drag.
volumeSlider.addEventListener("change", () => saveVolume());

const volumeControl = document.createElement("div");
volumeControl.className = "volume-control";
volumeControl.append(muteButton, volumeSlider);

// Three columns: song on the left, controls in the center, volume on the right.
const playerBar = getElement("player-bar");
playerBar.append(nowPlaying, controls, volumeControl);

const sidebar = getElement("sidebar");
sidebar.setAttribute("aria-label", t("menu.label"));
const menuIcon = icon(menuIconPath);
menuIcon.classList.add("menu-icon");
sidebar.append(menuIcon, menu);

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

// On the focused timeline, the arrows jump 5 seconds like everywhere else, instead of the
// slider's own step (1% of the song, which is 37 seconds on an hour-long one).
seekSlider.addEventListener("keydown", (event) => {
  const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
  if (direction && !event.ctrlKey && !event.altKey && !event.metaKey) {
    event.preventDefault();
    player.seek(player.currentTime + direction * seekStepSeconds);
  }
});

// Keyboard shortcuts (the table is in shortcuts.ts). One listener for the whole window.
const seekStepSeconds = 5;

// Media keys, headphone buttons and the system's media widget (see media-session.ts).
connectMediaSession(player, seekStepSeconds);
const volumeStep = 0.05;

window.addEventListener("keydown", (event) => {
  const action = actionFor(event);
  if (!action || event.defaultPrevented || !shortcutApplies(action, event.target)) {
    return;
  }
  // Stops the key's normal effect too. For Space that matters: without this, Space would
  // also "click" the focused button, so after clicking Next, Space would skip again.
  event.preventDefault();
  runShortcut(action);
});

// The mouse's back button goes up one folder, like Backspace.
window.addEventListener("mouseup", (event) => {
  if (event.button === 3) {
    event.preventDefault();
    runShortcut("parentFolder");
  }
});

// Keeps shortcuts out of the way where the key already means something.
function shortcutApplies(action: Action, target: EventTarget | null): boolean {
  if (shortcutsDialog.open || settingsPage.isOpen) {
    return false; // A window is up: only Escape (which closes it) applies.
  }
  if (!(target instanceof HTMLElement)) {
    return true;
  }
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) {
    return false;
  }
  if (target instanceof HTMLInputElement) {
    if (target.type === "range") {
      // A focused slider keeps its arrows (the timeline's are handled above).
      return !["seekBack", "seekForward"].includes(action);
    }
    if (target.type === "checkbox") {
      return action !== "togglePlay"; // Space toggles the switch.
    }
    return false; // Text fields: every key is typing.
  }
  return true;
}

function runShortcut(action: Action): void {
  switch (action) {
    case "togglePlay":
      player.toggle();
      break;
    case "seekBack":
      player.seek(player.currentTime - seekStepSeconds);
      break;
    case "seekForward":
      player.seek(player.currentTime + seekStepSeconds);
      break;
    case "previous":
      player.previous();
      break;
    case "next":
      player.next();
      break;
    case "volumeUp":
    case "volumeDown":
      player.muted = false;
      player.volume += action === "volumeUp" ? volumeStep : -volumeStep;
      saveVolume();
      break;
    case "toggleMute":
      player.muted = !player.muted;
      saveVolume();
      break;
    case "parentFolder":
      if (tree && openFolder && openFolder.segments.length > 0) {
        showFolder(findFolder(tree, openFolder.segments.slice(0, -1)));
      }
      break;
    case "showShortcuts":
      showShortcuts();
      break;
    case "openSettings":
      openSettings();
      break;
  }
}

// The quick "Keyboard shortcuts" window ("?"). The same list is also in Settings.
const shortcutsDialog = document.createElement("dialog");
shortcutsDialog.className = "shortcuts-dialog";
document.body.append(shortcutsDialog);

function showShortcuts(): void {
  const title = document.createElement("h2");
  title.textContent = t("shortcuts.title");

  const close = document.createElement("button");
  close.type = "button";
  close.className = "primary";
  close.textContent = t("shortcuts.close");
  close.addEventListener("click", () => shortcutsDialog.close());

  shortcutsDialog.replaceChildren(title, shortcutList(t), close);
  shortcutsDialog.showModal();
}

// The Settings page. Each section lists its switches; adding a setting means adding it to
// shared/preferences.ts and a row here.
const aboutText = document.createElement("p");
aboutText.className = "about";

const settingsPage = new SettingsPage({
  title: t("settings.title"),
  closeLabel: t("settings.close"),
  sections: [
    {
      title: t("settings.library"),
      rows: [
        {
          key: "library.showAllSongs",
          label: t("settings.showAllSongs"),
          description: t("settings.showAllSongsHint"),
        },
        {
          key: "library.hideUnplayable",
          label: t("settings.hideUnplayable"),
          description: t("settings.hideUnplayableHint"),
        },
      ],
    },
    { title: t("shortcuts.title"), content: shortcutList(t) },
    { title: t("settings.about"), content: aboutText },
  ],
  onChange: (key, value) => setPreference(key, value),
});
document.body.append(settingsPage.element);

function openSettings(): void {
  settingsPage.open(preferences);
}

// Saves a preference and applies it right away.
function setPreference<K extends PreferenceKey>(key: K, value: Preferences[K]): void {
  preferences = { ...preferences, [key]: value };
  window.miautify.setPreference(key, value);
  // Both library preferences change what a folder lists, so show the open one again.
  if (openFolder) {
    showFolder(openFolder, { keepScroll: true });
  }
}

// The id last sent to be remembered, so it's only sent when the song actually changes.
let savedSongId: string | null = null;

player.addEventListener("change", () => {
  updatePlayerBar();
  songList.refresh(); // Moves the "playing" highlight.

  const id = player.current?.id;
  if (id && id !== savedSongId) {
    savedSongId = id;
    window.miautify.setLastSong(id);
  }
});

player.addEventListener("volume", () => updateVolumeControl());

// A song couldn't play: remember it (main saves it if the file still exists), mark its row,
// and say so. The player has already moved on to the next song if it was playing.
player.addEventListener("unplayable", (event) => {
  const { song } = (event as CustomEvent<{ song: Song }>).detail;
  window.miautify.markUnplayable(song.id);
  if (preferences["library.hideUnplayable"] && openFolder) {
    showFolder(openFolder, { keepScroll: true }); // Takes it off the list.
  } else {
    songList.refresh(); // Marks it in red.
  }
  showNotice(t("player.cantPlay", { name: song.title ?? song.fileName }));
});

player.addEventListener("time", () => {
  if (!draggingSeek) {
    showPosition(player.currentTime);
  }
});

chooseButton.addEventListener("click", async () => {
  try {
    const folder = await window.miautify.chooseFolder();
    if (folder !== null) {
      await openLibrary(folder);
    }
    // null means cancelled: keep whatever was showing before.
  } catch (error) {
    console.error(error);
  }
});

refreshButton.addEventListener("click", () => {
  void checkForChanges();
});

// On launch: open the folder from last time, and put the last song back in the player bar,
// paused. Called from the end of this file, once everything above and below is defined.
async function restoreLastSession(): Promise<void> {
  try {
    const state = await window.miautify.getStartupState();
    const { folder, lastSongId, volume, muted } = state;
    savedSongId = lastSongId;
    preferences = state.preferences;
    aboutText.textContent = t("settings.version", { version: state.version });
    if (volume !== null) {
      player.volume = volume;
    }
    player.muted = muted;
    updateVolumeControl();
    if (folder === null) {
      showMessage(t("library.empty"));
      return;
    }
    await openLibrary(folder, lastSongId);
  } catch (error) {
    console.error(error);
    showMessage(t("library.empty"));
  }
}

// Shows the folder's songs from the cache right away, then checks the folder for changes
// in the background. Only a folder that was never scanned has to wait for the scan.
async function openLibrary(folder: string, restoreSongId: string | null = null): Promise<void> {
  folderLabel.textContent = folder;
  folderLabel.title = folder;
  refreshButton.hidden = false;
  libraryRoot = folder;
  openFolder = null; // A new library opens at its top folder.

  const cached = await window.miautify.cachedSongs();
  if (cached.length > 0) {
    showLibrary(cached);
    restoreSong(restoreSongId);
  } else {
    tree = null;
    folderTree.setTree(null);
    listedSongs = [];
    countLabel.textContent = "";
    showMessage(t("library.scanning"));
  }

  const songs = await checkForChanges();
  if (songs && cached.length === 0) {
    restoreSong(restoreSongId);
  }
}

// Puts a song back in the player bar, paused, if nothing is loaded yet and it can play. Its queue is the
// list on screen if the song is in it (like double-clicking it there), otherwise the
// folder it's in. It may have been deleted or moved since, then there's nothing to restore.
function restoreSong(id: string | null): void {
  if (!tree || id === null || player.current !== null) {
    return;
  }
  // A song known not to play isn't worth putting back.
  if (tree.allSongs.some((song) => song.id === id && song.unplayable)) {
    return;
  }
  const shownIndex = listedSongs.findIndex((song) => song.id === id);
  if (shownIndex >= 0) {
    player.selectFrom(listedSongs, shownIndex);
    return;
  }
  const folder = folderOfSong(tree, id);
  if (folder) {
    player.selectFrom(
      folder.songs,
      folder.songs.findIndex((song) => song.id === id),
    );
  }
}

// Scans the chosen folder in the background. The list stays usable meanwhile, and is only
// replaced if something changed. Returns the songs, or null if the folder couldn't be read.
async function checkForChanges(): Promise<Song[] | null> {
  // Both buttons wait for the scan to finish, so two scans can't overlap.
  chooseButton.disabled = true;
  refreshButton.disabled = true;
  statusLabel.textContent = t("library.checking");
  const stopListening = window.miautify.onScanProgress((done, total) => {
    const progress = t("library.readingTags", { done, total });
    statusLabel.textContent = progress;
    if (tree === null) {
      showMessage(progress); // Nothing shown yet: show it in the middle too.
    }
  });

  try {
    const { songs, changed } = await window.miautify.scanChosenFolder();
    if (changed || tree === null) {
      showLibrary(songs, { keepScroll: true });
    }
    return songs;
  } catch (error) {
    console.error(error);
    if (tree === null) {
      showMessage(t("library.scanFailed"));
    }
    return null;
  } finally {
    stopListening();
    statusLabel.textContent = "";
    chooseButton.disabled = false;
    refreshButton.disabled = false;
  }
}

// Shows the library's songs as folders, and their total count. keepScroll stays in the same
// folder at the same scroll position, for updates the user didn't ask for (like the
// background scan finding a new file).
function showLibrary(songs: Song[], { keepScroll = false } = {}): void {
  countLabel.textContent = t("library.songCount", { count: songs.length });
  if (songs.length === 0) {
    tree = null;
    folderTree.setTree(null);
    listedSongs = [];
    showMessage(t("library.noSongs"));
    return;
  }
  tree = buildFolderTree(libraryRoot, songs);
  folderTree.setTree(tree);
  // Stay in the open folder, or its nearest parent if it was deleted since.
  showFolder(findFolder(tree, openFolder?.segments ?? []), { keepScroll });
}

// Opens a folder: its path at the top, its subfolders, then its own songs.
function showFolder(folder: Folder, { keepScroll = false } = {}): void {
  const scrollTop = content.scrollTop;
  openFolder = folder;
  // What's listed is what plays: double-clicking queues from this same list.
  listedSongs = songsShown(
    folder,
    preferences["library.showAllSongs"],
    preferences["library.hideUnplayable"],
  );
  folderTree.setOpen(folder);
  renderBreadcrumb(folder);
  renderFolderGrid(folder);

  const parts: HTMLElement[] = [folderHeader];
  if (!preferences["library.showAllSongs"] && folder.folders.length > 0) {
    parts.push(folderGrid);
  }
  if (listedSongs.length > 0) {
    parts.push(songList.element);
  }
  // Taking an element off the page drops its keyboard focus, even if it's put straight
  // back. Give focus back afterwards, so for example the "Include subfolders" switch keeps
  // it when toggled with Space.
  const focused = document.activeElement;
  content.replaceChildren(...parts);
  if (focused instanceof HTMLElement && focused.isConnected && focused !== document.activeElement) {
    focused.focus({ preventScroll: true });
  }
  // After it's on the page: the list measures where it is to know which rows to draw.
  songList.setSongs(listedSongs);
  content.scrollTop = keepScroll ? scrollTop : 0;
}

// "Music › Artist › Album": every part but the last opens that folder.
function renderBreadcrumb(folder: Folder): void {
  if (!tree) {
    return;
  }
  const parts: HTMLElement[] = [];
  const names = [tree.name, ...folder.segments];
  for (const [depth, name] of names.entries()) {
    if (depth > 0) {
      const separator = document.createElement("span");
      separator.className = "separator";
      separator.setAttribute("aria-hidden", "true");
      separator.textContent = "›";
      parts.push(separator);
    }
    if (depth === names.length - 1) {
      const current = document.createElement("span");
      current.className = "current";
      current.setAttribute("aria-current", "location");
      current.textContent = name;
      parts.push(current);
    } else {
      const link = document.createElement("button");
      link.type = "button";
      link.textContent = name;
      const segments = folder.segments.slice(0, depth);
      link.addEventListener("click", () => {
        if (tree) {
          showFolder(findFolder(tree, segments));
        }
      });
      parts.push(link);
    }
  }
  breadcrumb.replaceChildren(...parts);
}

// One tile per subfolder: icon, name and how many songs it holds (including its own
// subfolders). Double-click or Enter opens it; single click is kept free, like for songs.
function renderFolderGrid(folder: Folder): void {
  const tiles = folder.folders.map((child) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "folder-tile";
    tile.title = t("library.openFolderHint");

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = child.name;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = t("library.songCount", { count: child.allSongs.length });
    const text = document.createElement("span");
    text.className = "text";
    text.append(name, count);

    tile.append(icon(folderIconPath), text);
    tile.addEventListener("dblclick", () => showFolder(child));
    tile.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        showFolder(child);
      }
    });
    return tile;
  });
  folderGrid.replaceChildren(...tiles);
}

function showMessage(text: string): void {
  const message = document.createElement("p");
  message.className = "message";
  message.textContent = text;
  content.replaceChildren(message);
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

const percent = new Intl.NumberFormat(language, { style: "percent" });

function updateVolumeControl(): void {
  const { volume, muted } = player;
  const silent = muted || volume === 0;
  const iconPath = silent
    ? volumeOffIconPath
    : volume < 0.5
      ? volumeLowIconPath
      : volumeHighIconPath;
  muteButton.replaceChildren(icon(iconPath));
  const label = muted ? t("player.unmute") : t("player.mute");
  muteButton.title = label;
  muteButton.setAttribute("aria-label", label);

  // While muted the slider shows empty; unmuting brings the level back.
  const shown = muted ? 0 : volume;
  volumeSlider.value = String(shown);
  volumeSlider.style.setProperty("--progress", `${shown * 100}%`);
  volumeSlider.setAttribute("aria-valuetext", percent.format(shown));
}

// Shows `text` in the toolbar for a few seconds. A newer notice replaces an older one.
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

function showNotice(text: string): void {
  noticeLabel.textContent = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    noticeLabel.textContent = "";
  }, 6000);
}

function saveVolume(): void {
  window.miautify.saveVolume(player.volume, player.muted);
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
