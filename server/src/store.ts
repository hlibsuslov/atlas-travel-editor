import type { DB } from './db';
import { newId, newSlug } from './auth';

/**
 * Thin data-access layer over the SQLite tables. Every query is scoped by the
 * authenticated `userId` in the WHERE clause — the server is the trust boundary
 * (no row-level-security to lean on), so ownership is enforced here and public
 * reads go through narrow projections that never select internal columns.
 */

export interface UserRow {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface DocRow {
  user_id: string;
  envelope: string;
  visibility: string;
  share_slug: string | null;
  version: number;
  updated_at: string;
}

export interface ProfileRow {
  user_id: string;
  display_name: string;
  accent_color: string;
  handle: string | null;
  created_at: string;
  updated_at: string;
}

const now = (): string => new Date().toISOString();

/** Thrown by {@link putDocument} when the supplied version is stale. */
export class VersionConflict extends Error {
  constructor(public current: DocRow) {
    super('Document was modified elsewhere');
    this.name = 'VersionConflict';
  }
}

export function createUser(db: DB, email: string, username: string, passwordHash: string): UserRow {
  const id = newId();
  const ts = now();
  db.prepare(
    'INSERT INTO users (id, email, username, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, email, username, passwordHash, ts);
  db.prepare(
    'INSERT INTO profiles (user_id, display_name, accent_color, handle, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
  ).run(id, username, '#2f6df0', ts, ts);
  return { id, email, username, password_hash: passwordHash, created_at: ts };
}

export function getUserByLogin(db: DB, login: string): UserRow | undefined {
  const key = login.trim().toLowerCase();
  return db
    .prepare('SELECT * FROM users WHERE lower(email) = ? OR lower(username) = ? LIMIT 1')
    .get(key, key) as UserRow | undefined;
}

export function getUserById(db: DB, id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function emailOrUsernameTaken(db: DB, email: string, username: string): boolean {
  const row = db
    .prepare('SELECT 1 FROM users WHERE lower(email) = ? OR lower(username) = ? LIMIT 1')
    .get(email.trim().toLowerCase(), username.trim().toLowerCase());
  return !!row;
}

export function createSession(db: DB, userId: string, tokenHash: string, ttlMs: number): void {
  const created = Date.now();
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(
    tokenHash,
    userId,
    new Date(created).toISOString(),
    new Date(created + ttlMs).toISOString(),
  );
}

/** Resolve a token hash to its (unexpired) user id, or undefined. */
export function getSessionUserId(db: DB, tokenHash: string): string | undefined {
  const row = db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
    .get(tokenHash) as { user_id: string; expires_at: string } | undefined;
  if (!row) return undefined;
  if (Date.parse(row.expires_at) < Date.now()) {
    deleteSession(db, tokenHash);
    return undefined;
  }
  return row.user_id;
}

export function deleteSession(db: DB, tokenHash: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export function getProfile(db: DB, userId: string): ProfileRow | undefined {
  return db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as
    | ProfileRow
    | undefined;
}

export function getDocument(db: DB, userId: string): DocRow | undefined {
  return db.prepare('SELECT * FROM documents WHERE user_id = ?').get(userId) as DocRow | undefined;
}

/**
 * Insert or update the user's document with optimistic concurrency. When
 * `expectedVersion` is provided and does not match the stored version, a
 * {@link VersionConflict} is thrown carrying the current row so the client can
 * resolve it. Returns the new row on success.
 */
export function putDocument(
  db: DB,
  userId: string,
  envelope: string,
  expectedVersion: number | null,
): DocRow {
  const current = getDocument(db, userId);
  if (current && expectedVersion !== null && expectedVersion !== current.version) {
    throw new VersionConflict(current);
  }
  const version = (current?.version ?? 0) + 1;
  const ts = now();
  if (current) {
    db.prepare(
      'UPDATE documents SET envelope = ?, version = ?, updated_at = ? WHERE user_id = ?',
    ).run(envelope, version, ts, userId);
    return { ...current, envelope, version, updated_at: ts };
  }
  db.prepare(
    'INSERT INTO documents (user_id, envelope, visibility, share_slug, version, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
  ).run(userId, envelope, 'private', version, ts);
  return {
    user_id: userId,
    envelope,
    visibility: 'private',
    share_slug: null,
    version,
    updated_at: ts,
  };
}

/** Set document visibility, minting a share slug on first publish. Returns the row. */
export function setVisibility(db: DB, userId: string, visibility: string): DocRow | undefined {
  const current = getDocument(db, userId);
  if (!current) return undefined;
  const slug = visibility !== 'private' && !current.share_slug ? newSlug() : current.share_slug;
  const ts = now();
  db.prepare(
    'UPDATE documents SET visibility = ?, share_slug = ?, updated_at = ? WHERE user_id = ?',
  ).run(visibility, slug, ts, userId);
  return { ...current, visibility, share_slug: slug, updated_at: ts };
}
