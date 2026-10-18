import { DatabaseSync } from "node:sqlite";
import type { RepeatMode } from "../shared/library.js";
import type { Preferences } from "../shared/preferences.js";
import type { SongSort } from "../shared/sort.js";
import type { CachedSong } from "./scanner.js";
import type { WindowState } from "./window-state.js";

// Everything the app remembers between launches, by key, with the type of each value: the
// user's preferences (shared/preferences.ts) plus the app's own state below. A typo in a
// key is a compile error.
export interface Settings extends Preferences {
  "library.folder": string;
  "player.lastSongId": string;
  // Where playback was in a song. Kept with the song's id, so it only applies to that song.
  "player.position": { songId: string; seconds: number };
  // Volume slider position, 0 to 1 (not the gain: see src/renderer/volume.ts).
  "player.volume": number;
  "player.muted": boolean;
  "player.shuffle": boolean;
  "player.repeat": RepeatMode;
  // Not set while the list is in the folder's own order.
  "library.sort": SongSort;
  // The window's size, place and maximized state when it was last closed.
  "window.state": WindowState;
}

// Each entry upgrades the database by one version. Never edit one that has shipped: add a
// new entry instead. SQLite's `user_version` remembers how many have run on this file.
const migrations: string[] = [
  // 1: key/value settings, stored as JSON text.
  "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT",
  // 2: scan cache, one row per mp3 file.
  `CREATE TABLE songs (
    path TEXT PRIMARY KEY,
    size INTEGER NOT NULL,
    mtime_ms REAL NOT NULL,
    title TEXT,
    artist TEXT,
    album TEXT,
    duration_seconds REAL
  ) STRICT`,
  // 3: files that failed to play. Existing rows start as playable (0).
  "ALTER TABLE songs ADD COLUMN unplayable INTEGER NOT NULL DEFAULT 0",
  // 4: each song's cover: the thumbnail's hash, "" for none, NULL if not looked up yet.
  "ALTER TABLE songs ADD COLUMN cover TEXT",
  // 5: when each song last started playing (ms since 1970), for shuffle. By song id, not
  // in the songs table: the history outlives rescans and folder changes.
  "CREATE TABLE last_played (song_id TEXT PRIMARY KEY, played_at INTEGER NOT NULL) STRICT",
];

// The app's SQLite database. Lives in the app's data folder, never in the music folder:
// deleting it loses settings and the scan cache, never music.
//
// No Electron imports, so tests can open it on ":memory:" (see test/storage.test.ts).
export class Storage {
  readonly #db: DatabaseSync;

  constructor(path: string) {
    this.#db = new DatabaseSync(path);
    this.#migrate();
  }

  get<K extends keyof Settings>(key: K): Settings[K] | undefined {
    const row = this.#db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    return row ? (JSON.parse(String(row.value)) as Settings[K]) : undefined;
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.#db
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) " +
          "ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      )
      .run(key, JSON.stringify(value));
  }

  delete(key: keyof Settings): void {
    this.#db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  }

  // Every cached song, by path. A few thousand rows load in milliseconds.
  cachedSongs(): Map<string, CachedSong> {
    const rows = this.#db.prepare("SELECT * FROM songs").all();
    return new Map(
      rows.map((row) => [
        String(row.path),
        {
          path: String(row.path),
          size: Number(row.size),
          mtimeMs: Number(row.mtime_ms),
          // SQL NULL comes back as null; the rest of the app uses undefined for "no tag".
          title: (row.title as string | null) ?? undefined,
          artist: (row.artist as string | null) ?? undefined,
          album: (row.album as string | null) ?? undefined,
          durationSeconds: (row.duration_seconds as number | null) ?? undefined,
          unplayable: row.unplayable === 1 ? true : undefined,
        },
      ]),
    );
  }

  // Saves the result of a scan: adds or updates the changed songs, deletes the removed
  // paths. All in one transaction: thousands of writes in one go are much faster than one
  // transaction each, and a crash can't leave the cache half updated.
  saveScan(changed: readonly CachedSong[], removed: readonly string[]): void {
    const upsert = this.#db.prepare(
      `INSERT INTO songs (path, size, mtime_ms, title, artist, album, duration_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (path) DO UPDATE SET
         size = excluded.size, mtime_ms = excluded.mtime_ms, title = excluded.title,
         artist = excluded.artist, album = excluded.album,
         duration_seconds = excluded.duration_seconds,
         -- The file changed, so it gets another chance to play, and its cover may be new.
         unplayable = 0, cover = NULL`,
    );
    const remove = this.#db.prepare("DELETE FROM songs WHERE path = ?");

    this.#transaction(() => {
      for (const song of changed) {
        upsert.run(
          song.path,
          song.size,
          song.mtimeMs,
          song.title ?? null,
          song.artist ?? null,
          song.album ?? null,
          song.durationSeconds ?? null,
        );
      }
      for (const file of removed) {
        remove.run(file);
      }
    });
  }

  // Remembers that a file failed to play, until it changes (see saveScan).
  markUnplayable(path: string): void {
    this.#db.prepare("UPDATE songs SET unplayable = 1 WHERE path = ?").run(path);
  }

  // The song's cover hash, "" if it has none, or undefined if it was never looked up (see
  // main/covers.ts).
  coverOf(path: string): string | undefined {
    const row = this.#db.prepare("SELECT cover FROM songs WHERE path = ?").get(path);
    return (row?.cover as string | null | undefined) ?? undefined;
  }

  setCover(path: string, hash: string): void {
    this.#db.prepare("UPDATE songs SET cover = ? WHERE path = ?").run(hash, path);
  }

  // Remembers that a song started playing at `time`.
  notePlayed(songId: string, time: number): void {
    this.#db
      .prepare(
        "INSERT INTO last_played (song_id, played_at) VALUES (?, ?) " +
          "ON CONFLICT (song_id) DO UPDATE SET played_at = excluded.played_at",
      )
      .run(songId, time);
  }

  // When each song last started playing, as [song id, time] pairs.
  lastPlayed(): [string, number][] {
    const rows = this.#db.prepare("SELECT song_id, played_at FROM last_played").all();
    return rows.map((row) => [String(row.song_id), Number(row.played_at)]);
  }

  close(): void {
    this.#db.close();
  }

  get version(): number {
    const row = this.#db.prepare("PRAGMA user_version").get();
    return Number(row?.user_version ?? 0);
  }

  #migrate(): void {
    for (let version = this.version; version < migrations.length; version++) {
      // Each migration runs in a transaction with its version bump, so a crash halfway
      // leaves the file on the old version instead of half upgraded.
      this.#transaction(() => {
        this.#db.exec(migrations[version]);
        this.#db.exec(`PRAGMA user_version = ${version + 1}`);
      });
    }
  }

  // Runs `work` so that either all of its writes happen or none do.
  #transaction(work: () => void): void {
    this.#db.exec("BEGIN");
    try {
      work();
      this.#db.exec("COMMIT");
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }
}
