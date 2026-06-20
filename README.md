# Atlas

[![CI](https://github.com/hlibsuslov/atlas-travel-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/hlibsuslov/atlas-travel-editor/actions/workflows/ci.yml)
[![CodeQL](https://github.com/hlibsuslov/atlas-travel-editor/actions/workflows/codeql.yml/badge.svg)](https://github.com/hlibsuslov/atlas-travel-editor/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Atlas** is an open-source, **local-first** personal travel-map editor. Record the
country you were born in, the places you've lived and visited, and your city/year
timelines into one self-contained `TravelData` document — edited through a typed
React UI with a live, validated JSON preview and an interactive world map.

Your data lives in **your browser** (IndexedDB). Atlas works fully **offline**,
needs **no account**, **no login wall**, and **no `.env` file**. Sharing and social
features are entirely optional and only appear when you connect your own
self-hosted [Atlas Server](#optional-atlas-server--accounts--sharing--social).

## Try it in 60 seconds

No backend, no account, no configuration:

```bash
git clone https://github.com/hlibsuslov/atlas-travel-editor.git
cd atlas-travel-editor
npm install
npm run dev                 # http://localhost:5173
```

That's it. The app boots straight into the editor and stores everything locally in
your browser via IndexedDB. Edit your document, watch the live JSON preview, colour
the map, and use **Export** / **Import** to back up your data to a JSON file or move
it between machines.

Account-only features (public sharing, friends, public profile) are simply hidden
until you point Atlas at an Atlas Server — see below.

## Features

- **Editor** — typed, validated UI over the travel document with a live JSON preview.
- **Interactive world map** — countries coloured by status (birthplace / lived /
  visited / capital-only), built on react-simple-maps; load your own data or view
  a friend's.
- **Local-first & offline** — installable PWA backed by IndexedDB and a service
  worker. No account, no network required. Back up and move data via JSON
  Export/Import.
- **Travel diary** — keep stays (places/hotels with dates and cost) alongside the
  map.
- **Friends** (optional, needs an Atlas Server) — follow people by **handle** or a
  share link and browse their public maps.
- **Internationalization** — 8 languages (de, en, es, fr, it, pt, ru, uk) via
  i18next with browser-language detection; adding a locale is one JSON file.
- **Light / dark / system theme** — shared CSS tokens, no per-component styling.
- **Toasts** for non-blocking feedback; **Sentry** hook for error monitoring.

> This is the production rebuild of the original single-file `index.html` MVP.
> See [`docs/adr/0001-stack-and-architecture.md`](docs/adr/0001-stack-and-architecture.md)
> for why the architecture looks the way it does, and
> [`docs/PRODUCT_PLAN.md`](docs/PRODUCT_PLAN.md) for the north star.

## Stack

| Concern      | Choice                                                          |
| ------------ | -------------------------------------------------------------- |
| Frontend     | React 18 + TypeScript (strict) + Vite                          |
| State        | Zustand (editor) + TanStack Query (data cache)                |
| Validation   | Zod — one schema shared by UI, storage, and tests             |
| Storage      | Pluggable `DocumentStore` seam — IndexedDB by default          |
| Server (opt) | Node + Hono + built-in `node:sqlite` (zero native deps)        |
| Hosting / CI | Static PWA on any host + GitHub Actions (typecheck · lint · test · build) |

## Storage options

The whole document is one self-contained `TravelData` JSON blob, so where it lives
is pluggable. Every backend sits behind a single `DocumentStore` contract with
normalize-on-load and validate-on-save enforced centrally
(see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)).

| Mode | Account? | Data lives in | Sharing / social | Status |
| ---- | -------- | ------------- | ---------------- | ------ |
| **Local-first (IndexedDB)** | no | your browser | no | **default, ready** |
| **Single local file** | no | one JSON file on disk (File System Access API) | no | ready |
| **Atlas Server (self-hosted)** | yes | your own server (SQLite) | yes — public maps, follows, feed | ready (optional) |
| GitHub / WebDAV / Google Drive / Dropbox | varies | your own cloud / repo | no | coming soon (not yet enabled) |

- **Local-first (IndexedDB)** — the default. No account, no network. This is the
  "Try it in 60 seconds" path above.
- **Single local file** — point Atlas at one JSON file on disk; reads and writes go
  straight to that file (with a download/upload fallback on browsers without the
  File System Access API).
- **Atlas Server** — the optional, self-hostable backend for accounts, public
  read-only sharing, and social features. See below.
- **Bring-your-own-cloud (coming soon)** — store the single JSON blob in a cloud
  you control. These adapters are registered but **not yet enabled**.

## Optional Atlas Server — accounts + sharing + social

Atlas Server is a small, self-hostable backend (Node + Hono + the built-in
`node:sqlite`, **zero native dependencies**). It is entirely optional: with no
server connected, every social/sharing surface stays hidden and Atlas is pure
local-first.

When you do run it, you get:

- **Accounts** — email + password (scrypt password hashing; bearer tokens stored
  only as a SHA-256 hash with a 30-day TTL).
- **Public sharing** — publish a read-only map by slug (`/share/:slug`) or at your
  handle (`/u/:handle`). DTOs are column-minimized and never leak email or internal
  ids; missing/private/revoked maps all return a generic 404.
- **Friends** — directed follows by **handle** or share link, mutual friends, an
  activity feed, and profile discovery.

### Run with Docker

```bash
docker compose up --build   # http://localhost:8787
```

Then open the web app's storage picker and point it at your server, or set
`VITE_SELFHOST_URL=http://localhost:8787` before building. See
[`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) for the full walkthrough.

## Environment

Atlas needs **no configuration** to run. Every variable below is **optional** and
only `VITE_`-prefixed values reach the browser (embedded at build time). See
[`.env.example`](.env.example).

| Variable               | Required | Purpose                                                     |
| ---------------------- | -------- | ----------------------------------------------------------- |
| `VITE_APP_URL`         | no       | Base URL used to build share links (defaults to the origin) |
| `VITE_SELFHOST_URL`    | no       | Atlas Server instance URL — enables sharing/social          |
| `VITE_LOCAL_ONLY`      | no       | Force pure local-first even if a server URL is set          |
| `VITE_DEMO_AUTH`       | no       | Enable an explorable demo login screen (dev only)           |
| `VITE_DEMO_LOGIN`      | no       | Demo login username (default `1`)                           |
| `VITE_DEMO_PASSWORD`   | no       | Demo login password (default `1`)                           |
| `VITE_SENTRY_DSN`      | no       | Enables Sentry error/performance monitoring if set          |

## Scripts

| Script                  | Description                                       |
| ----------------------- | ------------------------------------------------ |
| `npm run dev`           | Vite dev server                                  |
| `npm run build`         | Typecheck + production build to `dist/`          |
| `npm run preview`       | Serve the production build locally               |
| `npm run typecheck`     | `tsc` project references, no emit                |
| `npm run lint`          | ESLint (type-aware)                              |
| `npm run format`        | Prettier write                                   |
| `npm run test`          | Vitest unit + component tests                    |
| `npm run test:coverage` | Tests with V8 coverage                           |
| `npm run ci`            | The full gate: typecheck → lint → test → build   |

The optional server has its own gate: `npm --prefix server run ci`
(check:domain → typecheck → `node:test`).

## Deployment

Atlas is a **static PWA** — build it and host `dist/` anywhere.

- **Vercel** — `vercel.json` configures SPA rewrites, long-term asset caching, and
  security headers (CSP/HSTS/etc.). The CSP `connect-src` is `'self' https: wss:`
  so a hosted Atlas can reach a user-configured Atlas Server.
- **GitHub Pages** — build and publish `dist/` (a workflow pointer lands alongside
  this release).
- **Netlify / any static host / a container** — serve `dist/` with SPA fallback.

The optional **Atlas Server** deploys separately via Docker
(`docker compose up --build`); see [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

## Project layout

```
src/
  domain/      Zod schemas, validators, normalization — the source of truth
  i18n/        i18next config + locale JSON (de, en, es, fr, it, pt, ru, uk)
  lib/
    storage/   the DocumentStore seam + backend registry (indexeddb, localfile, selfhost, …)
    env.ts     optional env validation
  features/
    editor/    store (Zustand), data hooks, components
    map/       world map, country-name matching, legend
    diary/     stays (places/hotels) with dates and cost
    friends/   follow by handle / share link, browse friends' maps
    settings/  theme + language switchers
    sharing/   public read-only share page (with map)
  components/  cross-feature UI (AppShell nav, ErrorBoundary)
server/        optional Atlas Server (Node + Hono + node:sqlite)
docs/          product plan, architecture, security, ADRs
```

## Contributing

PRs are welcome — start with [`CONTRIBUTING.md`](CONTRIBUTING.md), and be kind per
our [`Code of Conduct`](CODE_OF_CONDUCT.md). To report a vulnerability, see the
[`Security Policy`](.github/SECURITY.md).

## Documentation

- [Docs index](docs/README.md) — start here
- [Product plan](docs/PRODUCT_PLAN.md) — the north star
- [Architecture overview](docs/ARCHITECTURE.md)
- [Self-hosting & run modes](docs/SELF_HOSTING.md)
- [Security model](docs/SECURITY.md)
- [Brand & assets](docs/brand/BRAND.md)
- [ADRs](docs/adr)
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](.github/SECURITY.md)

## License

[MIT](LICENSE)
