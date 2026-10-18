# Changelog

All notable changes to Miautify are listed here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Until 1.0.0, anything may still change.

## [Unreleased]

### Added

- A Settings page, from the menu or with Ctrl+,: all the options in one place.
- An option to hide files that can't play.
- Search (Ctrl+F) across the whole library: songs by title, artist or album (or file
  name, for untagged files), and folders by name. Words can come in any order;
  accents, punctuation and case are ignored, in any script.
- Sort the song list by any column: click a column title for A to Z, again for Z to A,
  and a third time to go back to the folder's order. Songs play in the sorted order, and
  the sort is remembered.
- Album covers in the song list, the player bar, on folder tiles (the folder's first
  song) and in the system's media controls. They come from the picture inside the mp3,
  or from a cover.jpg, folder.jpg, front.jpg or album.jpg in the same folder. Each
  picture is shrunk once to a small thumbnail and kept in the app's data folder.
- Shuffle (S) and repeat (R) buttons in the player bar. Shuffle plays every song of the
  list once in random order, starting with the song you chose, and deals the songs you
  heard most recently last, using a play history kept between sessions. Repeat cycles
  through off, the whole list (reshuffled each round when shuffling) and the current
  song. Both are remembered.

- The window opens at the size and place it had when it was closed, maximized if it was.
  If that place is no longer on a screen (a monitor was unplugged), it opens centered,
  sized to fit.

- A "Choose music folder" button under "Nothing to play yet.", "Could not read this
  folder." and "No mp3 files in this folder.", so there's always a way forward.

### Changed

- "Include subfolders" moved from the folder view into Settings.
- The keyboard shortcuts list is now in Settings (`?` still shows it).
- Song list columns are sized by what's in them. As the window grows, a column stops
  growing once its longest text fits, and the others get that room instead.
- The player bar gives the song's title and artist room first. The timeline is as wide as
  the buttons above it, and once the song's name fits it takes a quarter of the extra
  space as the window grows. The volume slider is up to twice as wide as before.
- A settings button at the right end of the toolbar (Settings stays in the menu too).

### Fixed

- Choosing another folder no longer keeps the song from the old one in the player, unless
  the new folder has it too (for example a subfolder of the old one).
- When the music folder is deleted or unplugged, Refresh now clears its path, song count,
  list and the song in the player, leaving only "Could not read this folder.", like a
  launch without the folder.

## [0.0.2] - 2026-09-28

Test pre-release.

### Added

- The app icon, on the installers, the window and taskbar, and in the app.
- Double-click a song to play it; play and pause, next and previous.
- When a song ends, the next one in the list starts.
- A timeline with elapsed and total time: click or drag to jump anywhere in the song.
- Volume and mute, remembered between launches.
- Folders work like playlists: a folder shows its subfolders at the top and its own songs
  below, with the path to it for going back up.
- The main menu on the left edge (hover to open) with all your folders as a tree, and
  the Choose music folder and Refresh buttons.
- An "Include subfolders" switch to list and play everything in a folder at once.
- Remembers the music folder and the last song, which waits in the player bar, paused.
- Fast launches: tags are cached, the library shows right away, and changes are picked
  up in the background. A Refresh button checks without restarting.
- Smooth scrolling through thousands of songs.
- Keyboard shortcuts (press `?` to see them all).
- Media keys, headphone buttons and the system's media controls (KDE, GNOME, Windows).
- Files that can't play are skipped and marked in red, until the file changes.
- An ocean blue look.

## [0.0.1] - 2026-09-26

Test pre-release.

### Added

- Choose a music folder: Miautify finds every mp3 in it and its subfolders and lists them
  with their title, artist, album and length.
- Windows installer and Linux AppImage.

[Unreleased]: https://github.com/innocentmiau/Miautify/compare/v0.0.2...HEAD
[0.0.2]: https://github.com/innocentmiau/Miautify/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/innocentmiau/Miautify/releases/tag/v0.0.1
