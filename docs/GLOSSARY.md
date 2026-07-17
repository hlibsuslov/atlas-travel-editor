# Glossary

## Atlas

The browser application: a local-first travel map, editor, diary, statistics
dashboard, and PWA.

## Atlas Server

The optional Hono/SQLite service that adds real accounts, remote document sync,
public sharing, handles, follows, friends, discovery, and feed. It is not part of
the Vercel static deployment.

## Local-first

The application is useful and stores the user's work locally without requiring a
network, account, or vendor service. It does not mean “local storage is the only
possible backend” or guarantee collaborative conflict-free merging.

## `TravelData`

The canonical typed domain document containing birthplace, countries, timelines,
cities, and optional stays. Features exchange this complete document rather than
maintaining independent persistence shapes.

## Portable envelope

The self-describing wrapper around `TravelData` with app id, schema version,
timestamp, and data. IndexedDB, files, and the Atlas Server use it.

## Normalization

Lenient conversion of untrusted or legacy input into the current structural
shape. Normalization can drop unusable values and is not proof that data is valid.

## Validation

Strict Zod parsing of the current contract. All saves must validate; errors carry
field paths.

## Storage seam

The `DocumentStore` interface plus registry wrapper that separates product
features from IndexedDB, local files, Atlas Server, and future providers.

## Active store

The one provider currently used for load/save. IndexedDB is the default; remote
stores require explicit user choice.

## Version token

Opaque metadata used for optimistic concurrency. The caller returns the token
from load on the next save; adapters decide whether it is an integer, revision,
ETag, hash, or null.

## Conflict

A save rejected because the stored version changed after the caller loaded it.
Atlas preserves the remote document in `ConflictError`; interactive merge UI is
not shipped yet.

## Local cache

A fast localStorage mirror keyed by account/provider. It improves hydration and
offline resilience but is not a second editable source of truth.

## Visibility

- **private**: no public read.
- **unlisted**: accessible to someone holding the share slug.
- **public**: accessible by slug and discoverable/readable by handle.

The frontend's legacy `isPublic` boolean is true for both unlisted and public
records; the server retains the three-state model.

## Share slug

A random URL-safe identifier for a shared document. Rotating it revokes the old
link. It is a capability link, not an authentication token.

## Handle

A unique, lower-case public profile name used by `/u/:handle`, discovery, and
follows.

## Follow and friend

A follow is a private directed edge from one user to another. A friend is derived
when both users follow each other; there is no separate friend-request record.

## Build provenance

The non-secret `build-info.json` emitted with a frontend build, identifying app,
version, commit (when supplied by CI/Vercel), environment, and build time.

## SPA fallback

Hosting behavior that serves `index.html` for client routes such as `/map`.
Without it, refreshing a `BrowserRouter` route returns a host-level 404.
