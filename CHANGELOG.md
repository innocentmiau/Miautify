# Changelog

All notable changes to Miautify are listed here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Until 1.0.0, anything may still change.

## [Unreleased]

### Added

- A Settings page, from the menu or with Ctrl+,: all the options in one place.
- An option to hide files that can't play.

### Changed

- "Include subfolders" moved from the folder view into Settings.
- The keyboard shortcuts list is now in Settings (`?` still shows it).

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
