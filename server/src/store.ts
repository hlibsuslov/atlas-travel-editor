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

/** Rotate (or, if now private, clear) the share slug — revokes the old link. */
export function rotateSlug(db: DB, userId: string): DocRow | undefined {
  const current = getDocument(db, userId);
  if (!current) return undefined;
  const slug = current.visibility === 'private' ? null : newSlug();
  const ts = now();
  db.prepare('UPDATE documents SET share_slug = ?, updated_at = ? WHERE user_id = ?').run(
    slug,
    ts,
    userId,
  );
  return { ...current, share_slug: slug, updated_at: ts };
}

/** Update the user's public profile (name, color, optional handle). Handle is stored
 * lowercased; a UNIQUE-constraint violation propagates for the caller to map to 409. */
export function updateProfile(
  db: DB,
  userId: string,
  displayName: string,
  accentColor: string,
  handle: string | null,
): ProfileRow {
  const ts = now();
  db.prepare(
    'UPDATE profiles SET display_name = ?, accent_color = ?, handle = ?, updated_at = ? WHERE user_id = ?',
  ).run(displayName, accentColor, handle, ts, userId);
  return getProfile(db, userId)!;
}

export function getProfileByHandle(db: DB, handle: string): ProfileRow | undefined {
  return db.prepare('SELECT * FROM profiles WHERE lower(handle) = ?').get(handle.toLowerCase()) as
    | ProfileRow
    | undefined;
}

/** Whether a handle is already claimed by someone other than `exceptUserId`. */
export function handleTaken(db: DB, handle: string, exceptUserId?: string): boolean {
  const row = db
    .prepare('SELECT user_id FROM profiles WHERE lower(handle) = ?')
    .get(handle.toLowerCase()) as { user_id: string } | undefined;
  return !!row && row.user_id !== exceptUserId;
}

export interface PublicView {
  doc: DocRow;
  profile: ProfileRow;
}

/** Resolve a share slug to a document visible by link (unlisted) or publicly. */
export function getPublicBySlug(db: DB, slug: string): PublicView | undefined {
  const doc = db
    .prepare(
      "SELECT * FROM documents WHERE share_slug = ? AND visibility IN ('unlisted', 'public')",
    )
    .get(slug) as DocRow | undefined;
  if (!doc) return undefined;
  const profile = getProfile(db, doc.user_id);
  return profile ? { doc, profile } : undefined;
}

/** Resolve a handle to its owner's PUBLICLY-discoverable map (visibility = public). */
export function getPublicByHandle(db: DB, handle: string): PublicView | undefined {
  const profile = getProfileByHandle(db, handle);
  if (!profile) return undefined;
  const doc = db
    .prepare("SELECT * FROM documents WHERE user_id = ? AND visibility = 'public'")
    .get(profile.user_id) as DocRow | undefined;
  return doc ? { doc, profile } : undefined;
}

/** A directed follow edge, enriched with the target's public profile + live slug. */
export interface FollowView {
  target_id: string;
  handle: string | null;
  display_name: string;
  accent_color: string;
  /** The target's current public/unlisted slug (for rendering their map), else null. */
  share_slug: string | null;
  label: string | null;
}

/** Resolve a follow target by handle, falling back to a share slug → its user id. */
export function resolveTargetId(
  db: DB,
  by: { handle?: string; slug?: string },
): string | undefined {
  if (by.handle) {
    const byHandle = getProfileByHandle(db, by.handle)?.user_id;
    if (byHandle) return byHandle;
  }
  if (by.slug) return getPublicBySlug(db, by.slug)?.doc.user_id;
  return undefined;
}

/** Create a directed follow edge. Throws on the PK (already-following) collision. */
export function addFollow(
  db: DB,
  followerId: string,
  targetId: string,
  label: string | null,
): void {
  db.prepare(
    'INSERT INTO follows (follower_id, target_id, label, created_at) VALUES (?, ?, ?, ?)',
  ).run(followerId, targetId, label, now());
}

export function removeFollow(db: DB, followerId: string, targetId: string): void {
  db.prepare('DELETE FROM follows WHERE follower_id = ? AND target_id = ?').run(
    followerId,
    targetId,
  );
}

/** The people the follower follows, with each target's public profile + live slug. */
export function listFollows(db: DB, followerId: string): FollowView[] {
  return db
    .prepare(
      `SELECT f.target_id, p.handle, p.display_name, p.accent_color, f.label,
              CASE WHEN d.visibility IN ('unlisted', 'public') THEN d.share_slug ELSE NULL END AS share_slug
         FROM follows f
         JOIN profiles p ON p.user_id = f.target_id
         LEFT JOIN documents d ON d.user_id = f.target_id
        WHERE f.follower_id = ?
        ORDER BY f.created_at DESC`,
    )
    .all(followerId) as unknown as FollowView[];
}

/** How many people follow this user (for mutual-follow detection). */
export function followersCount(db: DB, userId: string): number {
  return (
    db.prepare('SELECT COUNT(*) AS n FROM follows WHERE target_id = ?').get(userId) as {
      n: number;
    }
  ).n;
}

/** Count of statused countries in a stored envelope (for feed summaries). */
function countryCount(envelope: string): number {
  try {
    const data = (JSON.parse(envelope) as { data?: { travel?: { countries?: unknown[] } } }).data;
    return data?.travel?.countries?.length ?? 0;
  } catch {
    return 0;
  }
}

export interface DiscoverProfile {
  handle: string | null;
  display_name: string;
  accent_color: string;
}

/** Search discoverable (handled) profiles by handle or display name. */
export function searchProfiles(db: DB, q: string, limit = 20): DiscoverProfile[] {
  const like = `%${q.trim().toLowerCase()}%`;
  return db
    .prepare(
      `SELECT handle, display_name, accent_color FROM profiles
        WHERE handle IS NOT NULL AND (lower(handle) LIKE ? OR lower(display_name) LIKE ?)
        ORDER BY handle LIMIT ?`,
    )
    .all(like, like, limit) as unknown as DiscoverProfile[];
}

export interface FeedEntry {
  handle: string | null;
  display_name: string;
  accent_color: string;
  share_slug: string | null;
  updated_at: string;
  country_count: number;
}

/** Recent shared-map updates from people the user follows (column-minimized). */
export function listFeed(db: DB, followerId: string, limit = 30): FeedEntry[] {
  const rows = db
    .prepare(
      `SELECT p.handle, p.display_name, p.accent_color, d.share_slug, d.updated_at, d.envelope
         FROM follows f
         JOIN documents d ON d.user_id = f.target_id AND d.visibility IN ('unlisted', 'public')
         JOIN profiles p ON p.user_id = f.target_id
        WHERE f.follower_id = ?
        ORDER BY d.updated_at DESC LIMIT ?`,
    )
    .all(followerId, limit) as unknown as Array<{
    handle: string | null;
    display_name: string;
    accent_color: string;
    share_slug: string | null;
    updated_at: string;
    envelope: string;
  }>;
  return rows.map((r) => ({
    handle: r.handle,
    display_name: r.display_name,
    accent_color: r.accent_color,
    share_slug: r.share_slug,
    updated_at: r.updated_at,
    country_count: countryCount(r.envelope),
  }));
}

export interface FriendView {
  handle: string | null;
  display_name: string;
  accent_color: string;
  share_slug: string | null;
}

/** Mutual friends: people the user follows who also follow the user back. */
export function listMutualFriends(db: DB, userId: string): FriendView[] {
  return db
    .prepare(
      `SELECT p.handle, p.display_name, p.accent_color,
              CASE WHEN d.visibility IN ('unlisted', 'public') THEN d.share_slug ELSE NULL END AS share_slug
         FROM follows f1
         JOIN follows f2 ON f2.follower_id = f1.target_id AND f2.target_id = f1.follower_id
         JOIN profiles p ON p.user_id = f1.target_id
         LEFT JOIN documents d ON d.user_id = f1.target_id
        WHERE f1.follower_id = ?
        ORDER BY p.display_name`,
    )
    .all(userId) as unknown as FriendView[];
}
