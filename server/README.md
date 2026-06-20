# Atlas Server

The self-hostable, open-source **sharing & social backend** for
[Atlas](../README.md) — the local-first travel map. The web app works fully
offline with no account; this server is an **opt-in** publish / sync / social
target. Local data stays the source of truth.

- **Zero native dependencies.** SQLite is Node's built-in `node:sqlite`, so it
  installs and runs anywhere Node 22+ does — no compiler, no prebuilds.
- **Tiny surface.** Node + [Hono](https://hono.dev) + `node:sqlite` + Zod.
- **One opaque blob per user.** The travel document is stored as a single portable
  envelope plus a little metadata, so the diary can grow (places / stays / journal)
  with no database migration.

Everything below is **shipped and tested** — accounts, document sync with
optimistic concurrency, profiles & handles, public sharing, the directed follow
graph, mutual friends, the activity feed and profile discovery all work today.

## Run it

```bash
# Docker (recommended) — one command, from the repo root:
docker compose up --build           # → http://localhost:8787

# or bare metal (Node 22+)
cd server && npm install && npm start
```

Then open the Atlas web app, go to the storage picker, choose **Atlas Server**,
and paste your instance URL (e.g. `http://localhost:8787`). With no server
connected, all social/sharing UI stays hidden and the app is pure local-first.

## Configuration (env)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | Listen port |
| `ATLAS_DB` | `data/atlas.db` (`/data/atlas.db` in the container) | SQLite file path (`:memory:` for ephemeral) |
| `ATLAS_ALLOW_SIGNUP` | `1` | Set `0` to close public registration |
| `ATLAS_CORS_ORIGINS` | `*` | Comma-separated allowed web-app origins |

The SQLite database is the only state. In Docker it lives in the `atlas-data`
volume mounted at `/data`; back that volume up and you've backed up everything.
On bare metal it defaults to `./data/atlas.db` next to where you launched the
process.

> **WARNING — set `ATLAS_CORS_ORIGINS` in production.** It defaults to `*`,
> which is convenient for local dev but means *any* website can call your
> instance from a browser. In production set it to exactly your web app's
> origin, e.g. `ATLAS_CORS_ORIGINS=https://your-atlas.example.com` (comma-separate
> multiple origins).

## API (v0.1)

Auth is an opaque **Bearer session token**: passwords are hashed with scrypt;
tokens are stored only as a SHA-256 hash with a 30-day TTL. Public read
endpoints take no auth and return column-minimized DTOs (never email or internal
ids); missing, private and revoked all return the **same generic `404`** so they
can't be told apart.

### Public

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/healthz` | — | Health + advertised capabilities + `registrationOpen` |
| `GET` | `/config` | — | Public instance config (`name`, `version`, `registrationOpen`) |
| `GET` | `/share/:slug` | — | Public map by share slug → `{ data, profile }` |
| `GET` | `/share/:slug/profile` | — | Public profile slice for a share slug |
| `GET` | `/u/:handle` | — | Public profile slice for a handle |
| `GET` | `/u/:handle/map` | — | Public map for a handle → `{ data, profile }` |

### Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create account → `{ token, user }` (`403` if signups closed) |
| `POST` | `/auth/login` | — | Sign in by email *or* username → `{ token, user }` |
| `POST` | `/auth/logout` | Bearer | Revoke the current session |

### Me — account, document, profile

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/me` | Bearer | Current user + profile |
| `GET` | `/me/document` | Bearer | Load your document (`404` if none) |
| `PUT` | `/me/document` | Bearer | Save with `If-Match: <version>` optimistic concurrency (`409` + remote on stale; `422` on invalid data) |
| `PUT` | `/me/profile` | Bearer | Upsert display name / accent color / handle (`409` if handle taken) |
| `GET` | `/handles/:handle/available` | Bearer | Check whether a handle is free |
| `PATCH` | `/me/document/visibility` | Bearer | Set `private` / `unlisted` / `public` |
| `POST` | `/me/document/rotate-slug` | Bearer | Mint a fresh share slug (revokes the old link) |

### Social — follows, friends, feed, discovery

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/follows` | Bearer | People you follow (never exposes their user id) |
| `POST` | `/follows` | Bearer | Follow by `handle` or `slug` (+ optional `label`); `409` if already following |
| `DELETE` | `/follows/:handle` | Bearer | Unfollow |
| `GET` | `/followers` | Bearer | Your follower `{ count }` |
| `GET` | `/friends` | Bearer | Mutual follows (both directions) |
| `GET` | `/feed` | Bearer | Activity feed from the people you follow |
| `GET` | `/discover/profiles?q=` | Bearer | Search public profiles by handle / display name |

## Deploy for real

The Atlas web app is a PWA. When it's served over **HTTPS**, browsers block
plain-`http` requests to your server as **mixed content** — so a production
Atlas Server must be reachable over **HTTPS** too. The server itself speaks
plain HTTP on `PORT`; put a TLS-terminating reverse proxy in front of it.

A minimal [Caddy](https://caddyserver.com) example (automatic certificates):

```caddyfile
atlas-api.example.com {
    reverse_proxy localhost:8787
}
```

Traefik or nginx work just as well — proxy `https://atlas-api.example.com` to
the container's port `8787`. Then, in production:

1. Set `ATLAS_CORS_ORIGINS` to your web app's HTTPS origin (see the warning above).
2. Point the web app at `https://atlas-api.example.com` — either via the storage
   picker, or by baking it in with the web app's `VITE_SELFHOST_URL`.

### Bootstrapping the first account with signups closed

To run a private instance, close public registration with `ATLAS_ALLOW_SIGNUP=0`
(`/auth/register` then returns `403`). Because the bootstrap account can't be
created through a closed endpoint, create it **before** locking down — for
example:

```bash
# 1. Start with signups open (default) and register your account, then stop.
docker compose up --build           # register via the web app at :8787
docker compose down

# 2. Re-launch with registration closed.
ATLAS_ALLOW_SIGNUP=0 docker compose up
```

Your account (and its data volume) persists across the restart, so you can keep
logging in while new signups are refused.

## Domain is vendored

`src/domain/` is a verbatim copy of the web app's `src/domain/` so the server
validates documents against the exact same Zod schema. A CI guard
(`npm run check:domain`) fails if the copies drift; re-sync with:

```bash
cp src/domain/{schema,normalize,timeline,constants}.ts server/src/domain/
```
