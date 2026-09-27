import { DatabaseSync } from "node:sqlite";

// Everything the app remembers between launches, by key, with the type of each value.
// Adding a setting means adding a line here; a typo in a key is then a compile error.
export interface Settings {
  "library.folder": string;
  "player.lastSongId": string;
}

// Each entry upgrades the database by one version. Never edit one that has shipped: add a
// new entry instead. SQLite's `user_version` remembers how many have run on this file.
const migrations: string[] = [
  // 1: key/value settings, stored as JSON text.
  "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT",
];

// The app's SQLite database. Lives in the app's data folder, never in the music folder:
// deleting it loses settings, never music.
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
      this.#db.exec("BEGIN");
      try {
        this.#db.exec(migrations[version]);
        this.#db.exec(`PRAGMA user_version = ${version + 1}`);
        this.#db.exec("COMMIT");
      } catch (error) {
        this.#db.exec("ROLLBACK");
        throw error;
      }
    }
  }
}
