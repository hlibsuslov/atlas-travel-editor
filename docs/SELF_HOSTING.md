# Self-hosting & run modes

Atlas runs in three modes. Pick the one that matches how much infrastructure you
want to own. The **default needs nothing at all** — no account, no server, no
`.env`.

| Mode | Account? | Data lives in | Sharing / friends | Best for |
| ---- | -------- | ------------- | ----------------- | -------- |
| **(a) Local-only / no backend** | no | your device (IndexedDB) + JSON you export | no | the default — private/offline use, trying it out |
| **(b) Docker-hosted Atlas Server** | yes | a SQLite DB in a persistent volume | yes | a personal/group instance on one box |
| **(c) Split client + server (hosted)** | yes | your Atlas Server | yes | a public deployment, separate static host + API |

All three use the **same build**; the only difference is whether (and how) you
connect an Atlas Server.

---

## (a) Local-only / no backend (the default)

Nothing to set up. No server, no account, no network, no `.env`.

```bash
git clone https://github.com/hlibsuslov/atlas-travel-editor
cd atlas-travel-editor
npm install
npm run dev          # http://localhost:5173
```

Your travel document is stored in the browser (IndexedDB) and works fully
offline. You can edit the document, see the live JSON preview, colour the map, and
**Export** / **Import** a JSON file to back up or move your data between machines.
You can also point the storage picker at a single local **JSON file** (via the
File System Access API) if you prefer a file you can put in your own Dropbox/Drive
folder.

Account-only features (public sharing, friends, public profile) are hidden in
this mode — they genuinely need a server. To get them, connect an Atlas Server
(mode (b) or (c)).

---

## (b) Docker-hosted Atlas Server

The optional **Atlas Server** is a small OSS backend (Hono + the built-in
`node:sqlite`, **zero native dependencies**) that adds accounts, publishing,
follows, friends, a feed, and discovery. Stand it up with one command:

```bash
docker compose up --build      # http://127.0.0.1:8787
```

That boots the server and a local static web container. Both bind to loopback by
default (`8787` and `8080`), and SQLite persists in the `atlas-data` volume.
Then connect the web app to it — either way works:

- **At runtime**: open the web app's **storage picker**, choose the Atlas Server
  backend, and paste the server URL (`http://localhost:8787`). Register an
  account, sign in, and your map syncs with optimistic concurrency.
- **At build time**: set `VITE_SELFHOST_URL=http://localhost:8787` before
  building the SPA so it defaults to that server.

Useful server environment variables:

| Var | Purpose |
| --- | ------- |
| `ATLAS_DB` | SQLite file path (default `data/atlas.db`; `:memory:` for tests) |
| `ATLAS_ALLOW_SIGNUP` | set to `0` to close registration after bootstrapping |
| `ATLAS_CORS_ORIGINS` | comma-separated allowed origins (default `*` for development) |
| `ATLAS_BIND_IP` | Compose host bind (default `127.0.0.1`) |

For a quick local trial over plain HTTP (the dev server at `http://localhost:5173`
talking to `http://localhost:8787`) there is no mixed-content problem because both
are `http://`. That changes the moment either side is served over HTTPS — see mode
(c).

---

## (c) Split client + server, hosted for real

Host the static SPA on any static host (Vercel, GitHub Pages, Netlify, a
container) and run the Atlas Server separately. Two things matter here.

### HTTPS is required — put the server behind TLS

A PWA served over **`https://`** **cannot** call an **`http://`** backend: the
browser blocks it as **mixed content**. The Atlas Server speaks plain HTTP, so in
a hosted split deployment you must put it **behind a TLS-terminating reverse
proxy** — Caddy, Traefik, or nginx — and connect the app to the `https://`
origin.

A minimal Caddy example (automatic HTTPS):

```caddyfile
atlas.example.com {
    reverse_proxy localhost:8787
}
```

Then either point the storage picker at `https://atlas.example.com`, or build the
SPA with `VITE_SELFHOST_URL=https://atlas.example.com`.

Set `ATLAS_CORS_ORIGINS` to your SPA's origin if the SPA and the API are on
different origins:

```bash
ATLAS_CORS_ORIGINS=https://atlas-app.example.com
```

(If the Atlas Server also serves the SPA from the same origin, you don't need CORS
at all.)

### First-account bootstrap when signup is closed

Registration is open by default. For a public deployment you typically want to
create your account(s) first and then **close signup**:

1. Deploy with signup open, register your account at the app's sign-up screen.
2. Set `ATLAS_ALLOW_SIGNUP=0` and restart. `/auth/register` now returns `403`,
   and `/healthz` reports `registrationOpen: false` so the UI hides the sign-up
   form. Existing accounts keep working.

### CSP for a hosted build

The Content-Security-Policy in [`vercel.json`](../vercel.json) ships a
deliberately host-agnostic `connect-src` so a hosted Atlas can reach whatever
Atlas Server its owner connects to:

```
connect-src 'self' https: wss:;
```

This already covers any `https://`/`wss://` Atlas Server origin — no per-host edit
needed. If you want to **tighten** it to your one server, replace `https: wss:`
with your explicit origin(s):

```diff
- connect-src 'self' https: wss:;
+ connect-src 'self' https://atlas.example.com wss://atlas.example.com;
```

> The Vite dev server (`npm run dev`) does not apply `vercel.json` headers, so
> local development works without any CSP edit; it only matters for a hosted
> build. If you deploy somewhere other than Vercel, the `vercel.json` headers are
> not served at all — re-express the CSP (and the other security headers) for your
> host. See [`docs/SECURITY.md`](SECURITY.md).

---

## Which mode am I in?

- No server connected (the default) → **local-only**. Sharing/social UI is hidden.
- Storage picker (or `VITE_SELFHOST_URL`) pointed at an Atlas Server on the same
  box → **Docker-hosted server**.
- SPA and Atlas Server on different hosts, server behind TLS → **split / hosted**.

---

## Advanced / coming soon: bring-your-own-cloud

The storage seam reserves backends for **GitHub, WebDAV, Google Drive, and
Dropbox**, but they are **stubbed and not enabled in the default build**
(`ready: false`) — the picker lists them as "coming soon". They are not yet usable.

When they land, the OAuth providers (Google Drive, Dropbox) will need a
**self-registered OAuth public client id** that you supply via a `VITE_`
environment variable at build time — a public client id, **not** a committed
secret. Nothing is shipped in the default build, so there is no credential to
configure today.

See [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for the storage seam and Atlas
Server design, [`SERVER_OPERATIONS.md`](SERVER_OPERATIONS.md) for backups,
upgrades, and rollback, and [`docs/SECURITY.md`](SECURITY.md) for the security
model.
