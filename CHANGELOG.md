# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Operational knowledge** — project status, data-model, development, testing,
  deployment, server-operations, glossary, ADR index, and coding-agent guides.
- **Deployment verification** — public `build-info.json`, a reusable black-box
  HTTP/PWA/header smoke script, and a scheduled canonical-production check.
- Documentation link validation in the local and GitHub CI gates.
- **Rebrand to Atlas** — the project is now **Atlas**, an open-source, local-first
  personal travel-map editor (formerly "Travel Editor").
- **Local-first by default** — a clean clone runs with `npm install && npm run dev`
  and stores everything in the browser (IndexedDB), fully offline, with no account,
  no login wall, and no `.env` file required.
- **Pluggable storage layer** (`DocumentStore`) — the travel document can be saved
  to multiple backends behind one interface, with normalize-on-load and
  validate-on-save enforced centrally for every provider. Ready backends:
  `indexeddb` (default), `localfile` (single JSON file via the File System Access
  API), and `selfhost` (the optional Atlas Server).
- **Optional self-hostable Atlas Server** (`server/`) — Node + Hono + the built-in
  `node:sqlite` (zero native deps): accounts (email + password; scrypt hashing;
  bearer tokens stored only as a SHA-256 hash, 30-day TTL), public read-only maps by
  slug and at `/u/:handle`, directed follows, mutual friends, an activity feed, and
  profile discovery. Stand it up with `docker compose up --build`. With no server
  connected, all social/sharing UI stays hidden and the app is pure local-first.
- **Travel diary** — keep stays (places/hotels with dates and cost) alongside the
  map, on an additive schema bump.
- **Bring-your-own-cloud scaffolding** — Google Drive, Dropbox, WebDAV and GitHub
  adapters are registered as "coming soon" and will be enabled incrementally.
- **Portable export envelope** — `{ app, schemaVersion, updatedAt, data }` for
  forward-compatible import/export; bare legacy JSON still imports.
- **Paste-a-list bulk import** — paste `Spain, France` or `Spain: Madrid 2019` to
  add many countries/cities at once, with a resolved/unmatched preview and a
  single-undo-step merge.
- **Editor entry upgrades** — arbitrary-year city entry, inline timeline-chip
  editing, commit-on-blur renaming (one undo step), and an inline "why can't I
  save?" hint next to the Save button.
- **Quick-actualize** — record a new visit year on an existing country in one tap.
- **Map** — set all four statuses (visited / lived / capital / birthplace) directly
  from the map, plus a coverage chip ("N of M matched on the map") with
  click-through to fix unmatched names.
- Open-source project files: code of conduct, support, changelog, self-hosting
  guide, issue routing, and code owners.

### Changed

- Vercel is documented as the canonical static frontend; GitHub Pages is now an
  optional manual mirror instead of a failing automatic parallel deployment.
- Root tooling, CI, and the frontend Docker build align on Node 22.
- Docker Compose binds web/API ports to loopback by default and accepts signup,
  CORS, and bind settings from the environment.
- The documented `npm run ci` gate now really includes Prettier.
- Friends, profile and sharing degrade gracefully when no Atlas Server is connected.
- Sign-out now purges the signed-in user's local cache.

### Removed

- **Supabase removed entirely** from the app — no `VITE_SUPABASE_*` config, no
  hosted Postgres/RLS/anon-key path. `src/` has zero Supabase references. Accounts
  and sharing now come from the optional, self-hostable Atlas Server instead.
- Dead `TagList` and `Switch` components.

## [1.0.0]

Initial production rebuild of the original single-file MVP: typed React editor over
the travel document, interactive world map, friends/sharing, 8-language i18n,
light/dark theming, offline-first PWA, and full CI
(typecheck · lint · test · build).
