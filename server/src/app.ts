import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import type { DB } from './db';
import { hashPassword, hashToken, newToken, verifyPassword } from './auth';
import {
  VersionConflict,
  createSession,
  createUser,
  deleteSession,
  emailOrUsernameTaken,
  getDocument,
  getProfile,
  getSessionUserId,
  getUserById,
  getUserByLogin,
  putDocument,
  type DocRow,
} from './store';
import { validateTravelData } from './domain/schema';
import { normalizeTravelData } from './domain/normalize';

/**
 * Atlas Server HTTP surface (Hono). The client (a local-first SPA) reaches this
 * through one DocumentStore adapter; local data stays the source of truth and the
 * server is a publish/sync/social TARGET. Auth is an opaque Bearer session token.
 */

export const APP_NAME = 'atlas-server';
export const APP_VERSION = '0.1.0';
export const SCHEMA_VERSION = 1;
const ENVELOPE_APP_ID = 'travel-editor';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const registrationOpen = (): boolean => process.env.ATLAS_ALLOW_SIGNUP !== '0';

type Vars = { Variables: { userId: string } };

const registerBody = z.object({
  email: z.string().email(),
  username: z.string().regex(/^[a-z0-9_]{3,30}$/i, 'Username must be 3-30 chars: a-z, 0-9, _'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});
const loginBody = z.object({ login: z.string().min(1), password: z.string().min(1) });
const documentBody = z.object({ data: z.unknown() });

/** Map a stored document row to the client-facing record shape. */
function docToResponse(row: DocRow): {
  data: unknown;
  is_public: boolean;
  share_slug: string | null;
  version: number;
} {
  let data: unknown;
  try {
    data = (JSON.parse(row.envelope) as { data?: unknown }).data ?? null;
  } catch {
    data = null;
  }
  return {
    data: normalizeTravelData(data),
    is_public: row.visibility !== 'private',
    share_slug: row.share_slug,
    version: row.version,
  };
}

export function createApp(db: DB) {
  const app = new Hono<Vars>();

  app.use(
    '*',
    cors({
      origin: process.env.ATLAS_CORS_ORIGINS?.split(',').map((s) => s.trim()) ?? '*',
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type', 'If-Match'],
      exposeHeaders: ['ETag'],
    }),
  );

  // --- Public endpoints ------------------------------------------------------
  app.get('/healthz', (c) =>
    c.json({
      ok: true,
      name: APP_NAME,
      version: APP_VERSION,
      schemaVersionRange: [1, SCHEMA_VERSION],
      capabilities: { sharing: true, social: true, concurrency: 'token' },
      registrationOpen: registrationOpen(),
    }),
  );

  app.get('/config', (c) =>
    c.json({ name: APP_NAME, version: APP_VERSION, registrationOpen: registrationOpen() }),
  );

  // --- Auth ------------------------------------------------------------------
  app.post('/auth/register', async (c) => {
    if (!registrationOpen())
      return c.json({ error: 'Registration is closed on this instance.' }, 403);
    const parsed = registerBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, 400);
    const email = parsed.data.email.trim().toLowerCase();
    const username = parsed.data.username.trim().toLowerCase();
    if (emailOrUsernameTaken(db, email, username))
      return c.json({ error: 'That email or username is already taken.' }, 409);
    const user = createUser(db, email, username, hashPassword(parsed.data.password));
    return c.json(issueSession(db, user.id, { id: user.id, email, username }), 201);
  });

  app.post('/auth/login', async (c) => {
    const parsed = loginBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
    const user = getUserByLogin(db, parsed.data.login);
    if (!user || !verifyPassword(parsed.data.password, user.password_hash))
      return c.json({ error: 'Invalid credentials.' }, 401);
    return c.json(
      issueSession(db, user.id, { id: user.id, email: user.email, username: user.username }),
    );
  });

  app.post('/auth/logout', requireAuth(db), (c) => {
    const token = bearer(c.req.header('Authorization'));
    if (token) deleteSession(db, hashToken(token));
    return c.body(null, 204);
  });

  // --- Me --------------------------------------------------------------------
  app.get('/me', requireAuth(db), (c) => {
    const userId = c.get('userId');
    const user = getUserById(db, userId);
    if (!user) return c.json({ error: 'Not found' }, 404);
    const profile = getProfile(db, userId);
    return c.json({
      user: { id: user.id, email: user.email, username: user.username },
      profile: profile
        ? {
            display_name: profile.display_name,
            accent_color: profile.accent_color,
            handle: profile.handle,
          }
        : null,
    });
  });

  app.get('/me/document', requireAuth(db), (c) => {
    const row = getDocument(db, c.get('userId'));
    if (!row) return c.json({ error: 'No document yet' }, 404);
    return c.json(docToResponse(row));
  });

  app.put('/me/document', requireAuth(db), async (c) => {
    const parsed = documentBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);

    // Normalize untrusted input, then validate against the SAME schema the client
    // uses (vendored) so client and server can never disagree on what is valid.
    const data = normalizeTravelData(parsed.data.data);
    const validation = validateTravelData(data);
    if (!validation.ok)
      return c.json({ error: `Cannot save invalid data: ${validation.errors[0]}` }, 422);

    const ifMatch = c.req.header('If-Match');
    const expected = ifMatch !== undefined && ifMatch !== '' ? Number(ifMatch) : null;
    const envelope = JSON.stringify({
      app: ENVELOPE_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      data,
    });

    try {
      const row = putDocument(db, c.get('userId'), envelope, expected);
      return c.json(docToResponse(row));
    } catch (err) {
      if (err instanceof VersionConflict) {
        return c.json({ error: 'conflict', remote: docToResponse(err.current) }, 409);
      }
      throw err;
    }
  });

  return app;
}

/** Create a session for a user and return the auth payload (token shown once). */
function issueSession(
  db: DB,
  userId: string,
  user: { id: string; email: string; username: string },
): { token: string; user: { id: string; email: string; username: string } } {
  const token = newToken();
  createSession(db, userId, hashToken(token), TOKEN_TTL_MS);
  return { token, user };
}

/** Extract the Bearer token from an Authorization header value. */
function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1]!.trim() : null;
}

/** Hono middleware: require a valid Bearer session, exposing `userId` on context. */
function requireAuth(db: DB) {
  return createMiddleware<Vars>(async (c, next) => {
    const token = bearer(c.req.header('Authorization'));
    const userId = token ? getSessionUserId(db, hashToken(token)) : undefined;
    if (!userId) return c.json({ error: 'Not authenticated.' }, 401);
    c.set('userId', userId);
    await next();
  });
}
