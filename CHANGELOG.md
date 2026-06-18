# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Pluggable storage layer** (`DocumentStore`) — the travel document can be saved
  to multiple backends behind one interface, with normalize-on-load and
  validate-on-save enforced centrally for every provider.
- **Local-first mode** — run with no backend at all: an account-less IndexedDB
  store, and a "save to a real file on disk" store (File System Access API, with a
  download/upload fallback on browsers without it).
- **No-backend quickstart** — `VITE_LOCAL_ONLY=1` (or demo auth) boots straight
  into the editor with no Supabase configuration and no login wall.
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

- Friends, profile and sharing degrade gracefully when no cloud backend is active.
- Sign-out now purges the signed-in user's local cache.

### Removed

- Dead `TagList` and `Switch` components.

## [1.0.0]

Initial production rebuild of the original single-file MVP: typed React editor over
the travel document, interactive world map, friends/sharing via Supabase, 8-language
i18n, light/dark theming, offline-first PWA, and full CI
(typecheck · lint · test · build).
