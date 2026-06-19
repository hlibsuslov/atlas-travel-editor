import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * SQLite via Node's built-in `node:sqlite` — zero native dependencies, so the
 * server installs and runs anywhere Node 22+ does (no compiler, no prebuilds).
 * The whole document is stored as ONE opaque PortableEnvelope JSON blob plus a few
 * indexed metadata columns, so growing the travel diary (places / stays / journal)
 * needs no schema migration — only a `schemaVersion` bump in the shared domain.
 */
export type DB = DatabaseSync;

export function openDb(file = process.env.ATLAS_DB ?? 'data/atlas.db'): DB {
  if (file !== ':memory:') {
    try {
      mkdirSync(dirname(file), { recursive: true });
    } catch {
      /* directory already exists or is not creatable — let SQLite surface it */
    }
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}

/** Idempotent schema setup — safe to run on every boot. */
function migrate(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS profiles (
      user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL DEFAULT '',
      accent_color TEXT NOT NULL DEFAULT '#2f6df0',
      handle       TEXT UNIQUE,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      envelope   TEXT NOT NULL,                          -- opaque PortableEnvelope JSON
      visibility TEXT NOT NULL DEFAULT 'private',        -- private | unlisted | public
      share_slug TEXT UNIQUE,
      version    INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label       TEXT,
      created_at  TEXT NOT NULL,
      PRIMARY KEY (follower_id, target_id)
    );
    CREATE INDEX IF NOT EXISTS idx_follows_target ON follows(target_id);
  `);
}
