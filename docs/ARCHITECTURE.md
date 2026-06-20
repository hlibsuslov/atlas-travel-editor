# Architecture

## Overview

Atlas is an open-source, **local-first** personal travel-map editor. A clean
clone runs with nothing but `npm install && npm run dev`: it stores everything in
the browser (IndexedDB), works fully offline, and needs no account, no login
wall, and no `.env`. Sharing and social features are an **optional** layer served
by a small, self-hostable backend (the Atlas Server); when no server is
connected, all of that UI stays hidden and the app is pure local-first.

```
┌───────────────────────────┐
│  Browser SPA (React/TS)    │
│  ┌─────────────────────┐   │
│  │ Zustand editor store │  │   the working TravelData document
│  └──────────┬──────────┘   │
│             │ load / save  │
│  ┌──────────▼──────────┐   │
│  │  Storage seam        │  │   one DocumentStore contract + registry
│  │  (normalize / valid.)│  │   (normalize-on-load, validate-on-save)
│  └──────────┬──────────┘   │
└─────────────┼──────────────┘
              │
   ┌──────────┼───────────────┬──────────────┐
   ▼          ▼               ▼              (stubbed, ready:false)
indexeddb   localfile      selfhost  ┄┄┄  github · webdav · gdrive · dropbox
(default)   (one JSON      (optional
            file, FSA API)  Atlas Server, HTTPS)
```

The two design pillars:

1. **Local-first is the source of truth.** All travel data lives on the device.
   The document is portable as one self-describing JSON envelope
   (`{ app, schemaVersion, updatedAt, data }`). Any server is only ever a
   *publish / sync / social target*, never the primary store.
2. **Pluggable storage behind one seam.** Every backend implements the same
   `DocumentStore` contract, so the editor only ever loads and saves one
   self-contained `TravelData` blob plus a little sync metadata — and never knows
   which backend is behind it.

## Layers

### Domain (`src/domain`) — the single source of truth

The entire data model is defined once as Zod schemas (`schema.ts`). From it we
derive:

- **TypeScript types** (`z.infer`) used everywhere — no hand-maintained
  duplicate interfaces.
- **Runtime validation** (`validateTravelData`) used by the UI to show errors and
  by the storage seam to refuse persisting malformed data.
- **Lenient normalization** (`normalize.ts`) for untrusted input — pasted JSON,
  legacy caches, an imported file, a server payload — which never throws and
  best-effort shapes data into the current model, walking older `schemaVersion`s
  up the ladder.

This layer has zero React or backend dependencies, so it is trivially
unit-tested and is the most heavily covered part of the codebase. The optional
Atlas Server **vendors this exact domain** (guarded by a CI drift check) so the
client and server can never disagree on what counts as valid data.

### Lib (`src/lib`)

Cross-cutting infrastructure: optional environment validation (`env.ts`, which
never throws so a misconfiguration shows a readable screen rather than a blank
page), the storage seam (`src/lib/storage/`), the TanStack Query client, and
small utilities.

### Features (`src/features`)

Vertical slices, each owning its UI, state, and data access:

- **auth** — a local session provider. With no server connected it is a
  no-op/local provider; when an Atlas Server is configured it brokers
  register / sign-in / sign-out against it. Social/sharing UI is gated on whether
  a sharing-capable backend is connected.
- **editor** — a Zustand store holds the working document with a `dirty` flag;
  `useTravelData` bridges the store and the active store (load on mount, explicit
  save, optional share toggle); presentational components (`CountryCard`,
  `CityTimeline`, `TagList`, `JsonPreview`, …) are thin and prop-driven.
- **sharing / friends / profile** — read a public map by slug or handle, follow
  by handle or share link, and browse the feed/discovery — all served by the
  Atlas Server and hidden when none is connected.

## The storage seam (`src/lib/storage`)

This is the heart of the architecture. A single `DocumentStore` contract
(`types.ts`) plus a registry (`registry.ts`) decouple the editor from any
particular persistence backend.

### The `DocumentStore` contract

Each backend implements:

- `load()` → the stored `StorageDoc` (`{ data, meta }`) or `null`.
- `save(data, expected?)` → persist, returning the new `StorageDoc`. When the
  backend supports optimistic concurrency (`capabilities.concurrency === 'token'`)
  it takes the `expected` version token loaded earlier and throws `ConflictError`
  (carrying the fresh remote document) on a stale write.
- optional `setSharing(isPublic)` / `readPublic(slug)` for sharing-capable
  backends, and optional `connect()` / `disconnect()` / `isConnected()` for
  backends that hold a connection (a file handle, an OAuth grant, a server
  session).

`meta` carries an opaque `VersionToken` (an Atlas Server row `version`, a Drive
`headRevisionId`, a Dropbox `rev`, a GitHub blob `sha`, a WebDAV `ETag`, or an
IndexedDB counter), plus `isPublic` / `shareSlug` / `updatedAt`. The editor never
interprets the token — it just round-trips it.

### The registry: two invariants enforced once

The registry is the single place that knows every backend, picks the active one,
and — critically — enforces two cross-cutting invariants for **all** providers in
one wrapper (a net code reduction versus per-adapter duplication):

- **normalize-on-load** — every `load()` runs the raw blob through
  `normalizeTravelData`, so no adapter can forget it and no backend can hand the
  editor an off-version or malformed shape.
- **validate-on-save** — every `save()` runs `validateTravelData` first and
  throws the exact `Cannot save invalid data: …` string on failure, so invalid
  data never reaches any backend.

Individual stores therefore deal only in shaping bytes ↔ `StorageDoc`; they never
remember to validate or normalize.

### READY gating

A `READY` map marks which backends are selectable this wave:

| Store       | Ready | Role                                                        |
| ----------- | ----- | ---------------------------------------------------------- |
| `indexeddb` | ✓     | the local-first default — account-less, offline, always on |
| `localfile` | ✓     | a single JSON file via the File System Access API          |
| `selfhost`  | ✓     | the optional Atlas Server (sharing + token concurrency)    |
| `github`    | —     | coming soon / not yet enabled (`ready: false`)             |
| `webdav`    | —     | coming soon / not yet enabled (`ready: false`)             |
| `gdrive`    | —     | coming soon / not yet enabled (`ready: false`)             |
| `dropbox`   | —     | coming soon / not yet enabled (`ready: false`)             |

The default backend is always `indexeddb`; a remote backend is only ever used
when the user explicitly opts in via the picker. `getStoreById` returns `null`
for unknown **or** not-ready ids, so a stale or forced choice can never resolve to
a "coming soon" stub — callers fall back to the default.

## The optional Atlas Server (`server/`)

A small, self-hostable OSS backend: **Hono + the built-in `node:sqlite`**, with
**zero native dependencies**, so it installs and runs anywhere Node 22+ does (no
compiler, no prebuilds). It is shipped as one Docker image — `docker compose up
--build` → `http://localhost:8787` — and the web app points its storage picker at
it (or you set `VITE_SELFHOST_URL`).

### Opaque envelope storage

The server does **not** model a relational country/city/year tree. The whole
travel document is stored as **one opaque `PortableEnvelope` JSON blob** plus a
few indexed metadata columns:

```sql
documents (
  user_id    PRIMARY KEY,
  envelope   TEXT NOT NULL,          -- opaque {app,schemaVersion,updatedAt,data}
  visibility TEXT,                   -- private | unlisted | public
  share_slug TEXT UNIQUE,
  version    INTEGER,                -- optimistic-concurrency counter
  updated_at TEXT
)
```

This is the key graft: growing the diary (places / stays / journal) needs **zero
backend migration** — only a `schemaVersion` bump and a `normalize.ts` step in
the shared domain. On every write the server still normalizes the untrusted input
and validates it against the vendored Zod schema, so it can never store data the
client would reject.

### Optimistic concurrency (If-Match)

`PUT /me/document` takes an `If-Match: <version>` header. If the supplied version
no longer matches the stored row, the server returns `409` with the current
remote document, which the `SelfHostStore` surfaces as the seam's `ConflictError`
so the editor can offer keep-mine / take-theirs / merge. On success it bumps
`version`.

### What else it provides

Instance-local accounts (email + password), a directed follow graph, mutual
friends, an activity feed, profile discovery, and public read-only maps addressed
by `/share/:slug` or `/u/:handle`. Public reads go through narrow,
column-minimized projections; missing / private / revoked all return an identical
generic 404. The security model is documented in [`SECURITY.md`](./SECURITY.md).

A pure local-first deployment (no server configured) advertises no sharing
capability, so all Follow / Profile / Feed UI is hidden.

## State & data flow

1. On boot the editor store loads from the **active store** (IndexedDB by
   default), normalized by the registry wrapper. With no server, this is instant
   and offline.
2. UI mutations go through typed store actions (immutable via Immer) and flip
   `dirty`. The JSON preview and validation badge derive from store state with
   `useMemo`.
3. **Save** is explicit and user-triggered. The registry validates against the
   strict schema before any backend writes — the client never persists invalid
   data; the Atlas Server validates again server-side.
4. When the active backend is the Atlas Server, the loaded `VersionToken` is sent
   back on save as `If-Match`; a `409` becomes a `ConflictError` the UI resolves.

## Testing strategy

- **Domain** — exhaustive unit tests on validation, timeline parsing, and the
  `v1→vN` normalization ladder (the riskiest, purest logic).
- **Storage seam** — the registry invariants (normalize-on-load,
  validate-on-save), READY gating, and per-adapter behavior.
- **Store** — behavioral tests on mutations, dedup/sort invariants, and
  out-of-range safety.
- **Components** — Testing Library tests on validated inputs and the store↔UI
  binding.
- **CI gate** — client `npm run ci` = typecheck + lint + tests + build. Server
  `npm run ci` = `check:domain` (the vendored-domain drift guard) + typecheck +
  `node:test`. A leak test asserts no public response ever contains an
  email/id/hash/token.

## Notable trade-offs

- **Opaque envelope over a relational schema**: the server can't run SQL
  analytics over countries/cities, but diary growth never needs a migration and
  the document contract lives in exactly one place (the Zod domain). Search and
  analytics, if ever needed, can index derived columns without changing the
  contract.
- **Explicit save over autosave**: a simpler, predictable write story; the
  per-backend `VersionToken` is already the foundation for autosave with
  conflict resolution later.
- **Local-first default over an always-on backend**: the app is useful with zero
  infrastructure and zero accounts; everyone who wants sharing opts into a server
  they (or someone) self-hosts, with no vendor lock-in.
