# Security Model

Atlas is **local-first by default**, and its security posture follows from that:
in the default mode there is no account, no server, and no network — so there is
almost nothing to attack. Accounts and sharing only exist when you opt into the
optional, self-hostable **Atlas Server**, which has a small, auditable model of
its own. This document covers both.

## Local-first default: nothing leaves the device

A clean clone runs entirely in the browser. The travel document lives in
**IndexedDB**; there is no account, no login wall, no `.env`, and no network call
for normal use. Data only ever leaves the device when **you** choose to export a
JSON file, save to a local file, or connect a server. With no server connected,
all sharing/social UI is hidden because no sharing-capable backend is advertised.

Because there is no shared backend in this mode, classic web-app concerns
(authn/authz, multi-tenant isolation, RLS) simply do not apply — the only data on
hand is your own, on your own device.

## The optional Atlas Server

When you stand up an Atlas Server (see [`SELF_HOSTING.md`](./SELF_HOSTING.md)) and
point the app at it, the server becomes the trust boundary for accounts and
sharing. It is deliberately small (Hono + `node:sqlite`, zero native deps) so the
whole surface is easy to read end to end.

### Authentication — passwords and opaque session tokens

- **Passwords** are hashed with Node's built-in **scrypt** (no native
  dependency). Each password gets a fresh random 16-byte salt; the stored value is
  `scrypt$<salt>$<derived-key>`, and verification uses a constant-time compare
  (`timingSafeEqual`).
- **Session tokens** are random 32-byte strings. The plaintext token is shown to
  the client exactly once and sent back as a `Bearer` credential; the database
  stores **only its SHA-256 hash**. A database leak therefore never yields a
  usable token. Sessions carry a **30-day TTL** and are checked (and lazily
  purged) on every authenticated request; logout deletes the session row.

### Authorization — server is the trust boundary

There is no row-level security to lean on, so every data-access query is **scoped
by the authenticated `userId` in its WHERE clause**, enforced in the data-access
layer (`server/src/store.ts`). A request can only read or write its own document,
profile, and follow list.

### Public sharing without data leakage

Public reads (`GET /share/:slug`, `GET /u/:handle`, and the profile variants) are
**unauthenticated** and go through narrow projections that select only what is
meant to be public:

- a **column-minimized public DTO** — the bare `TravelData` (extracted from the
  envelope) plus a public profile slice (`{ display_name, accent_color, handle }`)
  — never email, internal user id, password hash, session token, or version
  internals.
- a single **generic 404** for everything not publicly visible: a missing slug, a
  `private` document, and a revoked/rotated slug are **indistinguishable**, so
  existence cannot be probed.

Share slugs are minted server-side from `randomBytes(9)` (URL-safe base64), so
they are unguessable, and they can be **rotated** to instantly revoke an old link.
A document is public-by-link (`unlisted`) or fully `public` (also discoverable by
handle); `private` exposes nothing.

### Following never widens exposure

Following is a **directed edge keyed on the target's handle**, private to the
follower. The feed and friends views reuse the same column-minimized projections
and only ever surface a target's already-public/unlisted map. Following someone
exposes nothing they did not choose to publish.

### Optimistic concurrency

`PUT /me/document` takes `If-Match: <version>`; a stale version returns `409` with
the current remote document. This prevents a lagging client from silently
clobbering a newer server copy and gives the editor the data it needs to offer
keep/take/merge.

### Configurable CORS and signup gating

- **CORS** origins are configurable via `ATLAS_CORS_ORIGINS` (comma-separated);
  the common single-origin self-host (server also serves the SPA) needs no CORS at
  all. Only `Authorization`, `Content-Type`, and `If-Match` request headers are
  allowed.
- **Signup gating**: set `ATLAS_ALLOW_SIGNUP=0` to close registration after you
  have created the first account(s). `/auth/register` then returns `403`, and
  `/healthz` advertises `registrationOpen: false` so the UI can hide the sign-up
  form.

## Defense in depth (client)

- **Validation at every boundary**: the client validates with the shared Zod
  schema before saving (the storage registry refuses to persist invalid data);
  the Atlas Server normalizes and validates again with the **same vendored
  schema**. Untrusted input (imports, caches, server responses) is run through
  lenient normalization that never throws.
- **No secrets in the client**: the default build ships no credentials at all.
  The only optional `VITE_` values are public URLs/flags (see `src/lib/env.ts`);
  no API tokens or service secrets are embedded anywhere in the bundle. `.env` is
  gitignored.
- **HTTP hardening** (via [`vercel.json`](../vercel.json) for a Vercel-hosted
  build): a strict Content-Security-Policy with `default-src 'self'` and
  `script-src 'self'`, HSTS with preload, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY` / `frame-ancestors 'none'`, a tight `Referrer-Policy`,
  and a restrictive `Permissions-Policy`. The `connect-src` directive is:

  ```
  connect-src 'self' https: wss:;
  ```

  It is intentionally `https:`/`wss:`-wide (not pinned to one host) so a hosted
  Atlas build can reach whatever **user-configured** Atlas Server origin its
  owner connects to. If you deploy somewhere other than Vercel, re-express these
  headers for your host. (The Vite dev server does not apply `vercel.json`
  headers, so local development is unaffected.)

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the maintainers rather than
opening a public issue. Include reproduction steps and an impact assessment.

## Known limitations / future work

- **Rate limiting** is not built into the Atlas Server; put it behind a reverse
  proxy (Caddy/Traefik/nginx) that adds per-IP limits before exposing it
  publicly.
- **Transport security is your reverse proxy's job.** The Atlas Server speaks
  plain HTTP; a PWA served over HTTPS cannot call an `http://` backend (mixed
  content), so terminate TLS in front of it (see [`SELF_HOSTING.md`](./SELF_HOSTING.md)).
- **No edit audit log yet**; the per-document `version` column is the foundation
  for one.
- **Bring-your-own-cloud backends** (GitHub, WebDAV, Google Drive, Dropbox) are
  stubbed and not enabled in the default build; their OAuth/credential handling
  will be documented as each ships.
