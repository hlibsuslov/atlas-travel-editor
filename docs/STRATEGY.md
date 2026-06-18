# Travel Editor — Architecture & Strategy

> Decision-grade reference for the maintainer. Integrates the subsystem analysis, the judged storage design, and the UX/OSS design into one execution plan. Every claim is grounded in real file paths. Effort key: **S** < 0.5 day, **M** 0.5–2 days, **L** 2–5 days, **XL** > 5 days.

---

## 1. Executive Summary

Travel Editor is a React 18 + TypeScript + Vite single-page app: a personal world-travel map where a signed-in user records countries (visited / lived / capital / birthplace), per-city visit years, and free-form country timelines into one self-contained `TravelData` JSON document. The domain is a single Zod source of truth (`src/domain/schema.ts`) with strict validation and lenient normalization; the editor is a Zustand store with undo/redo, debounced autosave, and an offline localStorage mirror; the map is an Equal-Earth `react-simple-maps` choropleth with PNG export and public read-only sharing. Persistence is **single-backend Supabase** (Postgres + RLS), stored relationally (migration `0003_normalize.sql`) but exchanged as whole-document JSON through `SECURITY DEFINER` RPCs. It is MIT-licensed, CI-gated (`npm run ci`: typecheck/lint/format/test/build), PWA-installable, Vercel-deployed, and unusually well-documented (5 ADRs) — but it is **positioned as a Supabase-coupled SaaS, not yet a frictionless local-first OSS app**, and a working no-backend demo path exists in code yet is unreachable behind the env gate.

---

## 2. Subsystem State of the Codebase

### 2.1 Domain model — `src/domain/`
Healthy and the strongest part of the codebase. `schema.ts` is the single source of truth (Zod → inferred TS types → `validateTravelData()` returning flat path-prefixed errors). `normalize.ts` is a never-throwing coercion layer applied on every read (cache, server, import). `countries.ts`/`continents.ts` give ISO-3166 alpha-2 reference + runtime-localized labels; `stats.ts` derives the dashboard aggregate; `timeline.ts`/`constants.ts` validate the four timeline formats.

**Key weaknesses:**
- **No schema version inside `TravelData`.** `version` is only a server row-concurrency integer (`src/lib/database.types.ts`); exported JSON (`ExportMenu.tsx`, bare `JSON.stringify(data, null, 2)`) carries no envelope, app id, or migration anchor.
- **Two inconsistent timeline models:** country-level = free-form strings (`YYYY`/`YYYY-MM`/`YYYY-MM-DD`/`YYYY-YYYY`); city-level = integer years only. `computeStats()` year stats ignore country-level strings entirely.
- **No geography:** no ISO `code`, no `lat`/`lng` persisted — country identity is lossy English names; map matching falls back to `'Other'`/`'none'` silently.
- **Status is 3 booleans + a separate `capitalVisit` boolean,** so contradictory states are representable.

### 2.2 Editor — `src/features/editor/`
Primary data-entry surface. Zustand + Immer store (`store.ts`) with all edits funneled through `mutate()` (snapshot onto `past[]`, cap 50, clear `future[]`, set `dirty`). Three-tier persistence: store → per-user localStorage cache (`cache.ts`, key `travel-editor:v1:<userId>`) → Supabase via `api.ts`. `useTravelData.ts` orchestrates hydrate-from-cache → reconcile-from-server; `useAutosave.ts` is debounced (1500ms) and backend-agnostic (opaque `onSave` callback + `canSave` gate, flush on `pagehide`/`visibilitychange`).

**Key weaknesses (entry friction):**
- City years can **only add `CURRENT_YEAR`** (`CityTimeline.tsx` ~line 75) — no past-year entry.
- City rename is **per-keystroke** → each character is its own undo step + autosave trigger; an interim empty name silently invalidates the doc and blocks save with no nearby explanation (`validation.errors[0]` lives only in the JSON pane pill, `EditorPage.tsx`).
- New countries `ensureCountry()` **append to the end**, not auto-opened; `store.addCountry()` (blank) is unreachable from the UI.
- `TagList.tsx` and `Switch.tsx` are **dead components** (only their own tests reference them).
- Import only **fully replaces** and can load schema-invalid "warn" data into an unsaveable doc. Export cloud/email targets are toast-only stubs.
- The **reconcile effect overwrites the store with server data on every fetch success** (`useTravelData.ts:38-43`) → edits made during the load window are discarded.

### 2.3 Persistence / storage — `src/features/editor/api.ts` + `cache.ts` + SQL
`api.ts` is exactly four `supabase.rpc(...)` calls (`get_my_travel_document`, `save_travel_document`, `set_travel_sharing`, `get_shared_travel`) returning a `TravelDocumentEnvelope { data, is_public, share_slug, version }` mapped 1:1 by `toRecord()`. Server stores relationally (`travel_documents → visited_countries → cities → city_visit_years`, plus `country_timeline_entries`); reads reassemble via `build_travel_json`, writes do **full delete+reinsert of the whole subtree** (`replace_document_children`) — coarse but atomic.

**Key weaknesses:**
- **No optimistic concurrency.** `save_travel_document(p_data)` takes only the data; the `version` column is read into the envelope but **never sent back** — concurrent edits last-write-wins. This is the central correctness gap and a prerequisite for any sync/BYO work.
- localStorage cache: ~5MB, synchronous, silently drops on quota/private-mode. No IndexedDB/OPFS.
- Hard Supabase coupling: `supabase.ts` is a global singleton imported by every `api.ts`. No storage abstraction seam.
- Legacy `travel_records` table (`0001`) and a skipped migration `0004` remain; `share_slug` is never rotated/revoked.

### 2.4 Map — `src/features/map/` + `src/features/sharing/SharePage.tsx`
Interactive Equal-Earth map (`WorldMap.tsx` + `MiniMap`), click-to-cycle status, zoom-to-fit (`useMapZoom.ts`), legend with counts, PNG export at 3 aspect ratios (`mapExport.ts`), explicit Crimea overlay (`crimea.ts`), read-only `SharePage`.

**Key weaknesses:**
- **Name-only matching** via `canonical()` + a brittle hand-maintained `ALIASES` table (`countryMatch.ts`) with redundant no-op self-maps; unmatched free-text countries render `'none'` **with no user feedback** (`computeCoverage()` exists but is surfaced nowhere). This is the central map correctness risk.
- Only **visited/lived are click-settable**; capital and birthplace are display-only on the map.
- Tooltips render **raw English** geography names; no choropleth/time-slider despite `yearTrips` existing; **no GeoJSON export** (only PNG); no city markers (no coords in schema).
- `SharePage` banner mixes two "countries" metrics (`stats.traveled` vs `data.travel.countries.length`).

### 2.5 Auth / Friends / Sharing / Profile — `src/features/{auth,friends,sharing,profile}/`
Supabase auth (email/password, magic link, Google OAuth) + a local **demo bypass** (`auth/demo.ts`, `VITE_DEMO_AUTH=1`, synthetic session, creds `1/1`). Friends = one-directional follow-by-share-code (`friend_links`, direct table access — diverges from the RPC-everywhere pattern). Opt-in public sharing via minted opaque slug. Minimal public profile (display name + accent color).

**Key weaknesses:**
- **Demo mode is auth-only.** `friends/api.ts`, `profile/api.ts`, `editor/api.ts` call Supabase unconditionally, so the "degrade gracefully" promise in `demo.ts` is **not backed by code** — in demo mode those calls fail.
- One-directional follow (no reciprocity/request/notification); friending silently degrades if the target goes private (no "this map went private" state on `FriendCard`).
- `public_handle` is carried through types/tables but **never used** (dead field). Identity is entirely Supabase-coupled (`Session`/`User` types, `auth.uid()` assumption).

### 2.6 Build / Infra / PWA / CI
Vite (es2022, vendor `manualChunks`), VitePWA (`autoUpdate`, Workbox precache + StaleWhileRevalidate for world-atlas), strict TS (project refs, `noUncheckedIndexedAccess`), `vercel.json` security headers (strict CSP, HSTS, `connect-src` hardcoded to `*.supabase.co`/`*.sentry.io`), CI (`ci.yml`) + CodeQL + Dependabot, optional Sentry.

**Key weaknesses:**
- **`src/lib/env.ts` unconditionally requires `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`** (verified — no demo bypass), and `main.tsx` renders `ConfigError` before `AuthProvider` mounts → **the demo no-backend path is unreachable on a clean clone.**
- Security headers live **only in `vercel.json`** — they silently disappear off Vercel (GitHub Pages serves none; CSP must move to a `<meta>` tag there).
- PWA ships only `favicon.svg` (no PNG 192/512/maskable) → degraded installability.
- `connect-src` hardcoded → self-hosted Supabase or any BYO backend is CSP-blocked without editing `vercel.json`.

### 2.7 Docs / OSS readiness
Excellent for its size: 5 cross-referenced ADRs, `ARCHITECTURE.md`, `SECURITY.md`, a real prioritized `ROADMAP.md`, and a runnable orchestration model. **Gaps:** no `CODE_OF_CONDUCT.md`, no GitHub-recognized `SECURITY.md`, no `SUPPORT.md`/`CHANGELOG.md`/`FUNDING.yml`/`CODEOWNERS`/issue-template `config.yml`; no badges, no screenshots/GIF (only `favicon.svg`); README Quick Start documents **only** the Supabase path; no `good-first-issue` on-ramp; vague vuln-reporting contact.

---

## 3. Strategic Direction

**Turn this Supabase-only SaaS into an open-source, local-first, bring-your-own-storage app — without breaking the hosted path.**

The leverage is one structural fact: **the entire document is already exchanged as a single self-contained `TravelData` JSON blob.** Every persistence concern collapses to "load one blob / save one blob + sharing metadata" — exactly the `TravelDocumentEnvelope` shape. That makes a pluggable storage layer cheap.

Three guiding principles:

1. **Backend-optional, not backend-removed.** Supabase stays the default and stays byte-identical. A second mode runs with **zero backend** (IndexedDB / local file), chosen automatically when Supabase env is absent or demo mode is on. Sharing/friends/profile remain Supabase-only capabilities and degrade gracefully (UI hidden) when no cloud is connected — that social layer genuinely needs a server.
2. **The domain stays untouched.** `schema.ts`, `normalize.ts`, `store.ts`, `useAutosave.ts`, and all editor/map components only ever see bare `TravelData`. All storage/sync metadata is split off at the storage boundary and rejoined there. This preserves the single-source-of-truth invariant.
3. **Ship usable increments behind a clean seam.** The first PR is a sub-200-line refactor that introduces the interface and keeps every behavior identical. Each subsequent layer (account-less local, conflict safety, BYO-cloud, robust sync) is independently shippable and CI-green.

This is the explicit conclusion of the storage design judgment: **adopt the pluggable `DocumentStore` architecture as the skeleton**, and graft the BYO-cloud security depth and the version-vector sync robustness as later capability-gated layers.

---

## 4. Recommended Storage Architecture

**Winner: pluggable `DocumentStore` interface + capability-gated adapters + thin Supabase refactor.** It wins smallest-refactor and contributor-friendliness, ties for breadth (7 providers), is near-best on security, and concedes only deep multi-device sync — which can be grafted later on the same seam.

### 4.1 The interface — new `src/lib/storage/`

```ts
// src/lib/storage/types.ts
export type VersionToken = string | number | null; // Supabase int | Drive headRevisionId | Dropbox rev | GitHub sha | WebDAV ETag | IDB counter
export interface StorageDoc { data: TravelData; meta: DocMeta; }
export interface DocMeta { version: VersionToken; isPublic: boolean; shareSlug: string | null; updatedAt?: string; }

export interface DocumentStore {
  readonly id: 'supabase' | 'indexeddb' | 'localfile' | 'gdrive' | 'dropbox' | 'webdav' | 'github';
  readonly capabilities: Capabilities;            // { sharing, concurrency, watch, list, binary, auth }
  load(): Promise<StorageDoc | null>;             // null = nothing stored yet (mirrors fetchMyRecord)
  save(data: TravelData, expected?: VersionToken): Promise<StorageDoc>; // throws ConflictError on mismatch
  setSharing?(isPublic: boolean): Promise<DocMeta>;   // ONLY Supabase
  readPublic?(slug: string): Promise<TravelData | null>; // ONLY Supabase
  connect?(): Promise<void>; isConnected(): boolean;
  watch?(cb: (doc: StorageDoc) => void): () => void;  // capability-gated
}
```

**Contract invariants — lifted into the registry wrapper, run ONCE for all providers (a net code reduction):**
- `load()` always runs `normalizeTravelData` on the raw blob (today `cache.ts` and `api.ts` each do this — centralize so no adapter forgets).
- `save()` always runs `validateTravelData` first. **Critical:** preserve the exact message string `Cannot save invalid data: …` — `src/lib/mutationError.ts:8` `NON_RETRIABLE` matches it by regex (`/^Cannot save invalid data/i`, verified); changing the string silently makes react-query retry validation errors.

### 4.2 Providers

| Provider | id | Auth | Version token (concurrency) | Sharing |
|---|---|---|---|---|
| **Supabase** (existing) | `supabase` | session + anon key + RLS | `envelope.version` (int) — *needs `p_expected_version` RPC* | yes |
| **IndexedDB** (default, account-less) | `indexeddb` | none | monotonic counter; `watch()` via BroadcastChannel | no |
| **Local file** (FS Access API) | `localfile` | none (user grants handle) | `mtime:size` hash; download fallback on FF/Safari | no |
| **Google Drive** | `gdrive` | OAuth2 **PKCE** (public client) | `headRevisionId`/`etag` via `If-Match` | no |
| **Dropbox** | `dropbox` | OAuth2 **PKCE** offline | `rev` (native update-mode conflict) | no |
| **WebDAV / Nextcloud** | `webdav` | user URL + app-password | `ETag` via `If-Match` (412 = conflict) | no |
| **GitHub** | `github` | user-pasted fine-grained PAT | blob `sha` (stale sha → 409, **free OCC**) | repo URL |

`SupabaseStore` is a ~40-line wrapper that **delegates verbatim** to the existing `editor/api.ts` functions, so the hosted path stays byte-identical and `SharePage.tsx` keeps importing `fetchPublicRecord` directly. All cloud providers store **one blob** `travel-data.json` in a scope-minimized location (Drive `appDataFolder`, Dropbox App Folder, GitHub one repo file, WebDAV `TravelEditor/`).

### 4.3 File format (portable envelope)

```json
{ "app": "travel-editor", "schemaVersion": 1, "updatedAt": "<ISO>", "data": { /* TravelData */ } }
```

Byte-compatible with today's `ExportMenu` output once wrapped. On read, detect a bare legacy doc (no envelope) and synthesize defaults, then normalize. This adds a **migration anchor without modifying `schema.ts`**.

### 4.4 Sync & conflict
- The **only behavioral rewrite** is the reconcile effect in `useTravelData.ts:38-43`: change "cache-hydrate then server-overwrite" → "local store loads first for instant paint; remote merges and re-`setData` only when it actually differs." The conflict/version check must land **before** any multi-provider mirroring, or slower cloud providers amplify the existing lost-edit bug.
- Thread `expected = loadedVersion` through `save()`. Providers with native tokens (GitHub `sha`, Dropbox `rev`, WebDAV `If-Match`, Drive `headRevisionId`) get OCC for free; Supabase needs the `p_expected_version` migration; providers without it declare `concurrency: 'none'` and the conflict prompt simply hides (no regression — same last-write-wins as today).
- On `ConflictError`: re-load remote, present **keep mine / take theirs / merge-by-`canonicalCountryName`** (the store's existing dedup key via `ensureCountry`). Suppress autosave while a conflict is open (`canSave && !hasConflict`). Reuse the existing `retryTransient`/`backoffDelay`.
- **Deferred (Layer 4, optional):** upgrade to version vectors + an outbox queue + 409 pull-merge-retry for true multi-device causality, behind the `watch`/`concurrency` capabilities — keeping the integer `version` as the Supabase replica's clock so no further DB migration is needed to begin.

### 4.5 Security of client-only tokens
A static SPA has **no server to hold a secret** — anything in the bundle is public (like the Supabase anon key, safe only because RLS enforces access server-side). Therefore **only secretless flows are viable:**
- **Drive/Dropbox:** Authorization-Code + **PKCE** with public clients (no client secret). `code_verifier` via `crypto.getRandomValues`, `code_challenge = base64url(SHA-256(verifier))` via WebCrypto, `state` validated on callback. **Avoid implicit flow.**
- **GitHub:** web flow requires a secret → impossible statically → use a **user-pasted fine-grained PAT** scoped to one repo (or a thin Worker for the optional OAuth variant, which breaks "pure static").
- **WebDAV:** user-supplied **app-password** (revocable, not the main password).
- **Token storage:** short-lived access tokens in memory/`sessionStorage`; refresh tokens / PATs / app-passwords in **IndexedDB** under an app-scoped key — never in the bundle, never logged. Offer a session-only mode. Wipe on `disconnect()`.
- **Scope minimization:** Drive `appDataFolder` (hidden, app-private), Dropbox App Folder, GitHub fine-grained PAT to one repo, WebDAV app-password — narrowest grant that still reads/writes the single JSON file.
- **CSP is load-bearing** (XSS is the real threat to client-held tokens). `connect-src` must be **derived per active provider** rather than hardcoded; on GitHub Pages, re-express CSP as an `index.html <meta http-equiv>` tag and register exact per-origin OAuth redirect URIs. The exported/synced blob contains **no auth material** (only `TravelData` + sync meta), so it is safe to hand to another device.
- **WebDAV CORS** is the one provider that can't be guaranteed from a static origin (stock Nextcloud won't send `Access-Control-Allow-Origin` to a `github.io` origin) — **detect and message this explicitly** rather than dead-ending on every save.

---

## 5. Data-Entry & Actualization UX Upgrades

Ordered by leverage (value × confidence ÷ effort). Full file lists and acceptance criteria are in the phased plan (§7).

**Tier 1 — high leverage, low risk:**
- **Arbitrary-year city entry (S).** Replace the `CURRENT_YEAR`-only button in `CityTimeline.tsx` with the validated numeric-stepper+chip pattern from `TimelineField.tsx`. `addCityYear` already dedupes/sorts.
- **Batch text mutations into one undo step (S).** Make city rename a controlled local input that commits on blur/Enter (or coalesce same-path mutations in `store.mutate`) — kills the per-keystroke undo spam and the interim-empty-name save block.
- **Inline "why can't I save?" (S).** Surface `validation.errors[0]` next to the Save button in `EditorPage.tsx`, click-to-focus the offending card (`invalidCountries` set already exists).
- **zundo for undo/redo (S/M).** Replace the hand-rolled `past`/`future`/`mutate` history with `temporal` middleware (`partialize` to `data`, `limit: 50`, `handleSet` debounce) — also delivers the coalescing in item 2.
- **Paste-a-list bulk import (M).** New "Paste list" tab in `ImportModal.tsx` accepting `Spain, France, Japan` or `Spain: Madrid 2019`; resolve via `countries.ts`; batch `mergeCountries(...)` as one undo step with a per-line resolved/unmatched preview. Biggest entry-speed win.
- **Map-click precision (S/M).** Modifier/long-press status menu in `MapPage.tsx` so capital and birthplace become settable from the map (currently 2 of 4 statuses are display-only).

**Tier 2 — higher value, more build:**
- **Smart city autocomplete + persisted ISO `code`/`lat`/`lng` (L).** Additive optional fields on `countrySchema`/`citySchema`; backfill `code` in `normalize.ts`; bundled offline gazetteer first (keeps CSP clean). Unlocks exact code-based map matching and pins.
- **Quick-actualize "visited X again in {year}" (M)** — per-card quick button + command-palette entry.
- **Trip-first modeling (L/XL)** — optional `travel.trips?[]` that derives into the existing per-city timelines; a "Log a trip" wizard; makes country-level dates visible in stats. Behind a flag, with `schemaVersion` + migration in `normalize.ts`.
- **Command palette (M)** — Cmd/Ctrl-K to add/jump/toggle/actualize/import/export/share.
- **Inline chip editing (S/M)** and **city drag-reorder (S/M)**.

**Tier 3 — robustness:**
- **Import merge mode + refuse/flag warn-state data (M).**
- **Optimistic-concurrency on save (M)** — see §4.4 and §7 Phase 4.
- **Surface map name-match coverage (S)** — show `computeCoverage()` ("N of M matched the atlas") so silent `none` countries become visible.

---

## 6. Open-Source Hardening

- **O1 — No-backend quickstart actually works (S, highest leverage).** Make Supabase vars optional in `src/lib/env.ts` when `VITE_DEMO_AUTH=1`/`VITE_LOCAL_ONLY` is set; skip the `envError` gate in `main.tsx`; make `friends/api.ts`/`profile/api.ts`/`editor/api.ts` degrade gracefully without Supabase. Unblocks every other OSS item.
- **O2 — README "Try it in 60s" + badges + screenshot/GIF (S/M).**
- **O3 — `CODE_OF_CONDUCT.md` (S)** (Contributor Covenant, linked from CONTRIBUTING/README).
- **O4 — Real `SECURITY` policy at a GitHub-recognized path (S)** (`.github/SECURITY.md` with a concrete private contact; keep `docs/SECURITY.md` as the deep-dive).
- **O5 — Good-first-issues + issue-template `config.yml` (S).**
- **O6 — Self-host / run-modes doc (M)** (`docs/SELF_HOSTING.md`: demo/localStorage, hosted Supabase, fully self-hosted; note the `connect-src` CSP edit).
- **O7 — Demo deploy + one-click deploy buttons (M)** (Vercel/Netlify preset to demo mode; `netlify.toml`/`_redirects` mirroring `vercel.json`).
- **O8 — Round out community files (S)** (`SUPPORT.md`, `CODEOWNERS`, `FUNDING.yml`, `CHANGELOG.md`; clarify `LICENSE` ownership).

---

## 7. Phased Execution Plan

Each phase ships something usable and keeps `npm run ci` green. Phases are ordered so OSS adoption is unblocked first, then fast low-risk UX wins, then the storage seam, then schema/backend-touching work.

### Phase 0 — Unblock adoption & quick wins (no schema, no backend change)
| # | Task | Size | Depends on | Acceptance |
|---|---|---|---|---|
| 0.1 | **O1** no-backend quickstart (`env.ts`, `main.tsx`, demo-degrade in `friends/profile/editor api.ts`) | S | — | `cp .env.example .env`, set `VITE_DEMO_AUTH=1`, `npm run dev` boots into the editor (login `1/1`), no ConfigError; editor/map/import/export work offline |
| 0.2 | Arbitrary-year city entry (`CityTimeline.tsx`, reuse `TimelineField.tsx`) | S | — | Any year in `[1900,2100]` addable via Enter/button; invalid rejected inline; "this year" still one tap; new `CityTimeline.test.tsx` |
| 0.3 | Batch text mutations / commit-on-blur (`CityTimeline.tsx`, opt. `store.ts`) | S | — | Typing one city name = exactly 1 undo entry + 1 autosave; empty interim value never blocks save |
| 0.4 | Inline "why can't I save?" (`EditorPage.tsx`, `CountryCard.tsx`, i18n) | S | — | First blocking error shown by Save button; click focuses the field; clears when fixed |
| 0.5 | Delete dead `TagList.tsx`/`Switch.tsx` (+ tests) | S | — | Removed; `npm run ci` green |
| 0.6 | **O3/O4/O5** CoC + SECURITY + good-first-issues + `config.yml` | S | — | GitHub community-standards: CoC + Security Policy recognized; ≥5 `good-first-issue` |

**Ships:** a clonable, runnable-without-Supabase app with the worst entry-friction removed and a credible OSS front door.

### Phase 1 — Undo & bulk entry
| # | Task | Size | Depends on | Acceptance |
|---|---|---|---|---|
| 1.1 | zundo migration (`store.ts`, `EditorPage.tsx`, add dep) | S/M | 0.3 | Undo/redo matches today (Cmd/Ctrl+Z, Shift+Z, 50-cap), `setData` clears history, rapid keystrokes group; store tests updated |
| 1.2 | Paste-a-list import (`parseCountryList.ts`, `ImportModal.tsx`, `mergeCountries` in `store.ts`) | M | — | N resolved / M unmatched preview; Add = one undo step, dedupe by canonical name; unmatched listed not dropped; parser unit tests |
| 1.3 | **O2** README "Try in 60s" + badges + hero screenshot + GIF | S/M | 0.1 | Badges render; ≥1 screenshot + 1 GIF; copy-paste demo block |

**Ships:** dramatically faster data entry + the public-facing README that converts visitors.

### Phase 2 — The storage seam (Layer 0, <200-line first PR, zero behavior change)
| # | Task | Size | Depends on | Acceptance |
|---|---|---|---|---|
| 2.1 | `src/lib/storage/{types.ts,registry.ts}` + `SupabaseStore` delegating to `api.ts` + lift `validate`/`normalize` into registry (preserve exact `Cannot save invalid data:` string) | S | — | Supabase path byte-identical; `useTravelData.ts` resolves `useActiveStore()`; `SharePage.tsx` unchanged; CI green |
| 2.2 | `IndexedDbStore` (account-less default) + `LocalFileStore` (FS Access API + handle persistence; download/FileReader fallback) | S/M | 2.1, 0.1 | No-Supabase/demo build defaults to IndexedDB (no login wall); local file round-trips; FF/Safari fall back cleanly |
| 2.3 | Provider-selection UI (wire `ExportMenu` `CLOUD_TARGETS` `connect()` seam to the registry; persist choice) | S/M | 2.1 | User picks Local/File/Cloud; choice persists; Share/Friends UI hidden when active provider lacks `sharing` |

**Ships:** real local-first mode (IndexedDB / local file) coexisting with an unchanged Supabase default.

### Phase 3 — Map correctness & geography (schema-additive)
| # | Task | Size | Depends on | Acceptance |
|---|---|---|---|---|
| 3.1 | Add `schemaVersion` to `TravelData` + migration hook in `normalize.ts`; portable export envelope in `ExportMenu`/`useImportPreview` | S/M | — | Old bare-JSON imports still work (envelope synthesized); export carries `{app,schemaVersion,updatedAt,data}` |
| 3.2 | Optional `code`/`lat`/`lng` on `countrySchema`/`citySchema`; backfill `code` in `normalize.ts`; code-first matching in `countryMatch.ts` | L | 3.1 | Old JSON imports unchanged; map matches by `code` first, name fallback; ALIASES reliance reduced |
| 3.3 | Surface `computeCoverage()` + map-click capital/birthplace (`MapPage.tsx`, `WorldMap.tsx`) | S/M | — | "N of M matched" chip; unmatched clickable to editor; all 4 statuses settable from map; double-click zoom preserved |
| 3.4 | City autocomplete (offline gazetteer) writing `lat/lng` (`CitySelect.tsx`, `geocode.ts`) | L | 3.2 | Ranked suggestions; chosen city stores coords; offline/demo works with no network |

**Ships:** accurate map matching, geography in the model, visible coverage feedback, full map editing.

### Phase 4 — Conflict safety (Layer 2)
| # | Task | Size | Depends on | Acceptance |
|---|---|---|---|---|
| 4.1 | Fix reconcile-overwrite (`useTravelData.ts:38-43`) → merge-not-clobber; never lose in-flight edits | M | 2.1 | Edits during load survive; remote re-`setData` only on actual diff |
| 4.2 | `ConflictError` + thread `expected` version + keep/take/merge-by-`canonicalCountryName` UI; suppress autosave during conflict | M | 4.1 | Stale save → clear conflict prompt with 3 deterministic options; single-device save unchanged |
| 4.3 | DB migration: `save_travel_document(p_expected_version)` with back-compat/feature-detect | S/M | 4.2 | Stale Supabase save rejected (409-style); migration test; old clients tolerated during rollout |

**Ships:** multi-device-safe saves on Supabase and free OCC on every native-token provider.

### Phase 5 — BYO-cloud breadth + deployment hardening (Layer 3)
| # | Task | Size | Depends on | Acceptance |
|---|---|---|---|---|
| 5.1 | GitHub (PAT, sha) + WebDAV (app-password, ETag) adapters | M each | 2.1, 4.2 | One-blob CRUD; native conflict surfaces via `ConflictError`; WebDAV CORS dead-end detected and messaged |
| 5.2 | Google Drive + Dropbox (PKCE, appDataFolder/App-Folder, token storage per §4.5) | L / M-L | 5.1 | One-click connect; tokens in IndexedDB/sessionStorage per policy; scopes minimized; refresh handled |
| 5.3 | Deploy hardening: derive CSP `connect-src` per provider; GitHub Pages `<meta>` CSP + Vite `base` subpath + `404.html` SPA fallback + per-origin OAuth redirect registration; **O6/O7** docs + deploy buttons | M | 5.1 | BYO providers not CSP-blocked; Pages build mounts; headers parity off Vercel |

**Ships:** true bring-your-own-storage to four external providers, deployable to GitHub Pages/Netlify with header parity.

### Phase 6 — Robust multi-device sync (Layer 4, optional) + remaining UX & OSS polish
| # | Task | Size | Depends on | Acceptance |
|---|---|---|---|---|
| 6.1 | Version vectors + outbox queue + 409 pull-merge-retry behind `watch`/`concurrency` caps (keep int `version` as supabase replica clock) | L | 4.x, 5.x | Concurrent multi-device edits detected and merged, not clobbered; reuses `retryTransient`/`backoffDelay`; no further DB migration to begin |
| 6.2 | Trip-first modeling + wizard (`tripSchema`, `stats.ts`, `TripWizard.tsx`), behind flag | L/XL | 3.1 | Trip logged in one flow, round-trips through export/import; docs without `trips` unaffected; trip-derived years in stats |
| 6.3 | Command palette, inline chip edit, city drag-reorder, quick-actualize, import merge mode | S–M each | 1.1 | Per item §5 |
| 6.4 | **O8** SUPPORT/CODEOWNERS/FUNDING/CHANGELOG; PWA PNG icons | S | — | Community-standards checklist fully green; install prompt shows raster icon |

**Ships:** power-user UX, trip modeling, and full multi-device convergence.

---

## 8. Risks & Open Questions for the Maintainer

**Decide before building:**

1. **Source-of-truth inversion — yes or no?** The judged winner (Design 3) keeps the server-reconcile model and adds conflict checks; Design 1 inverts the truth to the device (version vectors + outbox). The plan ships Design 3 first and grafts Design 1 as optional Layer 4 (Phase 6.1). **Confirm you want to defer full device-primary sync** rather than build it up front.

2. **`p_expected_version` rollout (Phase 4.3).** This is a real DB migration. A naive rollout can 409-loop if the comparison is wrong, and old clients must tolerate the new signature. Until it ships, the `expected` arg on `SupabaseStore` is decorative — **do not advertise conflict-safety for Supabase before this lands.**

3. **Per-origin OAuth registration burden (Phase 5.2).** You cannot ship one universal Google/Dropbox client id that works on arbitrary `github.io` forks — each fork/deployment URL needs its own client id + whitelisted redirect. **Decide:** default forks to the no-registration providers (GitHub PAT / WebDAV), and document Drive/Dropbox as "configure your own client id."

4. **WebDAV CORS may be unfixable from the app (Phase 5.1).** Stock Nextcloud won't send `Access-Control-Allow-Origin` to a static origin. **Accept** that WebDAV may require a user-side server/proxy header change, and ship explicit detection+messaging rather than a silent dead end.

5. **IndexedDB failure modes (Phase 2.2).** Async, blocked transactions, private-mode rejections differ from `cache.ts`'s silent-swallow localStorage. **Decide** the fallback: in-memory store + visible warning when IDB is unavailable (mirroring how `cache.ts` swallows today), and whether to migrate the existing `travel-editor:v1:<userId>` localStorage key one-shot/idempotently to avoid an apparent "reset."

6. **Status model: enum vs booleans.** Three booleans + `capitalVisit` allow contradictory states and complicate import strictness. **Decide** whether to add a normalized status enum alongside (Phase 3.x candidate) or leave as-is and rely on `primaryStatus()` precedence.

7. **Trip-first modeling scope (Phase 6.2).** A first-class `Trip` entity is the most valuable data-model enrichment but the largest (L/XL) and a `schemaVersion` bump. **Decide** whether it's in-scope at all, or whether the derived city-year model is sufficient.

8. **Schema-version policy.** Once `schemaVersion` exists (Phase 3.1), every future change needs a migration step in `normalize.ts`. **Confirm** you want `normalize.ts` (not a separate migrations module) as the single upgrade path, and what the policy is for dropping unknown fields (currently silent — a documented data-loss risk on import).

9. **Legacy cleanup.** `travel_records` (migration `0001`) and the skipped `0004` remain; `public_handle` is dead; `share_slug` is never revoked. **Decide** whether to ship a cleanup migration (drop/archive `travel_records`, reclaim `0004`, add slug rotation) — low urgency, real contributor-confusion cost.

10. **Governance.** `LICENSE` attributes copyright to anonymous "contributors," no `CODEOWNERS`/maintainer named. **Decide** the named owner/org before O8, since it gates review routing and contributor trust.
