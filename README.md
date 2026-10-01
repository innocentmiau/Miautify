<p align="center"> <img src="assets/icon.svg" width="128" height="128"
alt="Miautify icon"> </p>

# Miautify

[![CI](https://github.com/innocentmiau/Miautify/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/innocentmiau/Miautify/actions/workflows/ci.yml)
[![Latest
release](https://img.shields.io/github/v/release/innocentmiau/Miautify?include_prereleases&label=release)](https://github.com/innocentmiau/Miautify/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A music player for Linux and Windows that points at a folder of mp3 files and
plays it. No server, no import step, and it never renames or moves your files.

> **Early development.** Miautify is being rebuilt feature by feature. The
> releases so far are test builds; the first real release will be v0.1.0.

## Features

- **Your folder is the library.** Pick a folder and Miautify finds every mp3 in
  it, subfolders included, and reads the title, artist, album and length from
  the tags. Songs without tags show their file name.
- **Folders work like playlists.** Opening a folder shows its subfolders at the
  top and its own songs below. Double-click a subfolder to go in, and use the
  path at the top to go back up. Playing a song plays through the rest of that
  folder. The main menu on the left edge opens when you hover it and shows all
  your folders as a tree. Turn on **Include subfolders** to list (and play)
  every song in a folder and its subfolders together instead.
- **Opens straight into your music.** It remembers the folder and the last song,
  which waits in the player bar, paused, ready to play.
- **Fast with big libraries.** Tags are cached, so launching shows your list
  right away and only new or changed files are read, in the background. A
  Refresh button picks up changes without restarting.
- **Playback:** double-click a song to play it, then play and pause, next and
  previous, and a timeline to jump anywhere in the song. When a song ends, the
  next one starts.
- **Keyboard shortcuts:** Space to play or pause, the arrows to jump 5 seconds,
  Ctrl with the arrows for previous, next and volume, M to mute, Backspace (or
  the mouse back button) to go up a folder. Press `?` to see them all.
- **Media keys and system controls.** The keyboard's media keys and headphone
  buttons work even when Miautify isn't focused, and the song shows in the
  system's media controls (KDE's media widget, GNOME, the Windows media
  overlay).
- **Broken files don't stop the music.** A file that can't play is skipped,
  marked in red, and skipped from then on, until the file changes.
- **Volume and mute**, remembered between launches. The slider follows how
  loudness is heard, so the whole range is useful.
- **Your files stay yours.** Miautify only reads the music folder. Its own data
  (settings and the tag cache) lives in the app's data folder:
  `~/.config/Miautify` on Linux, `%APPDATA%\Miautify` on Windows.

## Install

Download the latest build from the [Releases
page](https://github.com/innocentmiau/Miautify/releases).

- **Windows:** run `Miautify-Setup-<version>.exe`. The builds aren't code-signed
  yet, so Windows SmartScreen will warn: click **More info**, then **Run
  anyway**.
- **Linux:** download `Miautify-<version>.AppImage`, make it executable and run
  it:

  `sh chmod +x Miautify-*.AppImage ./Miautify-*.AppImage`

  AppImages need FUSE 2 (`fuse2` on Arch-based distros, `libfuse2` on Debian and
  Ubuntu).

## Usage

1. Move the mouse to the left edge to open the menu, click **Choose music
   folder** and pick the folder with your mp3s.
2. Double-click a folder to open it, and a song to play it. The songs after it
   in that folder play next. Click a folder name in the path at the top to go back
   up, or any folder in the menu's tree.
3. Use the player bar at the bottom to pause, skip, jump in the song or change
   the volume.
4. Added or changed files? Click **Refresh** in the menu.

## Roadmap

What is planned to be done with the dates where each features has been fully pushed to the main branch.

- [x] Pick a folder, scan it and its subfolders for mp3s, and list them with
      their tags (2026-09-25)
- [x] Windows installer and Linux AppImage, built automatically for each release
      (2026-09-26)
- [x] Double-click to play, play and pause (2026-09-26)
- [x] Timeline with elapsed and total time, click or drag to jump (2026-09-27)
- [x] Ocean blue look (2026-09-27)
- [x] Next and previous, and auto-advance to the next song (2026-09-27)
- [x] Remember the folder and the last song between launches (2026-09-27)
- [x] Tag cache for fast launches, background check for changes, Refresh button
      (2026-09-28)
- [x] Volume and mute, remembered between launches (2026-09-28)
- [x] Smooth scrolling through thousands of songs (2026-09-28)
- [x] Browse by folder: a folder shows its subfolders above its songs, like a
      playlist (2026-09-28)
- [x] Main menu on the left edge with the folder tree, opens when you hover it
      (2026-09-28)
- [x] "Include subfolders" switch: list and play every song in a folder and its
      subfolders together (2026-09-28)
- [x] Keyboard shortcuts, with a list of them on `?` (2026-09-28)
- [x] Files that can't play are skipped and marked in red, until the file
      changes (2026-09-28)
- [x] Media keys, headphone buttons and the system's media controls (2026-09-28)

- [ ] Album covers
- [ ] Search, ignoring accents, punctuation and word order
- [ ] Sort by any column
- [ ] Setting to hide files that can't play
- [ ] Favorites and playlists
- [ ] Play counts and your most played songs
- [ ] Home page with albums, artists, genres and years
- [ ] Shuffle without repeating recent songs, and repeat
- [ ] Crossfade and an equalizer
- [ ] Settings page, color themes and a language picker (Portuguese first)
- [ ] Discord "Listening to" status
- [ ] Edit tags (one song, or a whole album or artist at once)
- [ ] Keep favorites and play counts when a file is renamed or moved
- [ ] More formats: flac, ogg and m4a

## Build from source

Needs [Node.js](https://nodejs.org/) 22.12 or newer.

`sh npm install npm start`

Other scripts:

- `npm test`: run the unit tests.
- `npm run typecheck`: check the TypeScript types.
- `npm run check`: lint and check formatting with [Biome](https://biomejs.dev/).
- `npm run format`: fix formatting.
- `npm run dist`: build an installer for your OS into `release/`.

Built with Electron, TypeScript, SQLite (`node:sqlite`), music-metadata and
i18next.

## License

[MIT](LICENSE)
