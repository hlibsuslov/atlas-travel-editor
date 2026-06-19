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

## Run it

```bash
# Docker (recommended)
docker compose up --build           # from the repo root → http://localhost:8787

# or bare metal (Node 22+)
cd server && npm install && npm start
```

Then open the Atlas web app, go to the storage picker, choose **Atlas Server**,
and paste your instance URL (e.g. `http://localhost:8787`).

## Configuration (env)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | Listen port |
| `ATLAS_DB` | `data/atlas.db` | SQLite file path (`:memory:` for ephemeral) |
| `ATLAS_ALLOW_SIGNUP` | `1` | Set `0` to close public registration |
| `ATLAS_CORS_ORIGINS` | `*` | Comma-separated allowed web-app origins |

## API (v0.1)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/healthz` | — | Health + advertised capabilities |
| `GET` | `/config` | — | Public instance config |
| `POST` | `/auth/register` | — | Create account → `{ token, user }` |
| `POST` | `/auth/login` | — | Sign in → `{ token, user }` |
| `POST` | `/auth/logout` | Bearer | Revoke the current session |
| `GET` | `/me` | Bearer | Current user + profile |
| `GET` | `/me/document` | Bearer | Load your document (`404` if none) |
| `PUT` | `/me/document` | Bearer | Save (`If-Match: <version>` → `409` on stale) |

Auth is an opaque Bearer session token (passwords hashed with scrypt; tokens
stored only as a SHA-256 hash). Publishing, public reads, handles, follows and the
feed land in subsequent sprints (see [docs/PRODUCT_PLAN.md](../docs/PRODUCT_PLAN.md)).

## Domain is vendored

`src/domain/` is a verbatim copy of the web app's `src/domain/` so the server
validates documents against the exact same Zod schema. A CI guard
(`npm run check:domain`) fails if the copies drift; re-sync with:

```bash
cp src/domain/{schema,normalize,timeline,constants}.ts server/src/domain/
```
