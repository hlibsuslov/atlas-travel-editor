# Atlas — Product & Engineering Plan

> **This is the current north star.** It supersedes the Supabase-era direction in
> [`STRATEGY.md`](./STRATEGY.md) (kept for its subsystem analysis, but its
> "keep Supabase as default" conclusion no longer holds). Decision date: 2026-06-19.

## Status — all six sprints shipped (2026-06-19)

The full plan below is **implemented** on branch
`feat/storage-seam-correctness-and-portable-io` (client + `server/`), CI-green at
every step:

- **Sprint 1** — Supabase removed; local-first by default (IndexedDB), no login wall. ✓
- **Sprint 2** — **Atlas Server** (Hono + `node:sqlite`, zero native deps, Docker) +
  `SelfHostStore`; connect a server, register/sign-in, sync with optimistic
  concurrency. ✓
- **Sprint 3** — publish (private/unlisted/public + rotatable slug); read-only view by
  `/share/:slug` and `/u/:handle`; handles + column-minimized public reads (leak-tested). ✓
- **Sprint 4** — directed follow graph (by handle or pasted link); Friends page with
  real names/colors/mini-maps. ✓
- **Sprint 5** — discovery search, activity feed, and mutual-follow friends. ✓
- **Sprint 6** — diary foundation (schema v2: optional `Money` + `travel.stays`,
  v1→v2 normalize ladder, zero backend migration) + an in-app stays editor. ✓

**Deferred (documented, not yet built):** the explicit friend-request handshake +
`audience:'friends'` visibility tier (needs a consent table + an authed friends-only
read path); a CI locale-key-parity linter; map matching by ISO code. Mutual-follow
already provides a "friends" set today.

## 1. What we are building

Atlas is a **serious, open-source, local-first travel social network**. A person
records where they have been — countries, cities, dates — on a beautiful world
map, and (when they want to) **shares their profile and map with others and
follows people back**. Everything works fully offline on one device; sharing is an
opt-in layer on top, served by **our own self-hostable backend**, not a third party.

Two commitments shape every decision:

1. **Local-first is the source of truth.** All travel data lives on the device
   (IndexedDB), works with no account and no network, and is portable as a single
   self-describing JSON envelope (`{app,schemaVersion,updatedAt,data}`). The server
   is only ever a *publish / sync / social target*.
2. **The whole thing is OSS and easy to self-host.** Anyone can `docker run` our
   backend and have a working instance — accounts, sharing, follows — in minutes.
   No vendor lock-in. (Supabase is being removed entirely.)

The product grows in sprints toward a **rich travel diary** (visited places,
hotels + cost, journal entries) and **full social features** (follows, friends,
feed, discovery).

## 2. Architecture: "Atlas Server" + the storage seam

The client already has a pluggable storage seam (`src/lib/storage/`): every
backend implements one `DocumentStore` contract (`load` / `save` /
`setSharing?` / `readPublic?`), and a registry wrapper enforces normalize-on-load
and validate-on-save centrally. We reuse it **verbatim**.

- **Client (this repo):** the React SPA. Default backend = `IndexedDbStore`
  (account-less, offline). Optional file backend. When a user points the app at an
  Atlas Server instance, a new **`SelfHostStore`** (`id: 'selfhost'`) becomes
  available — the first store with **both** `sharing: true` **and** real
  `concurrency: 'token'` (which the seam was designed for).
- **Atlas Server (new `server/` workspace):** a small OSS **Hono + SQLite**
  (Postgres-optional) single-binary REST backend, shipped as one Docker image that
  can also serve the static SPA (single origin → CSP `'self'`, no CORS for the
  common self-host case).
  - **Document storage is an opaque `PortableEnvelope` blob + a few indexed
    metadata columns** (`visibility`, `share_slug`, `version`, `updated_at`),
    *not* a relational country/city/year tree. This is the key graft: diary growth
    (places / stays / journal) needs **zero backend migration** — only a
    `schemaVersion` bump + a `normalize.ts` step.
  - **One source of truth for the document contract:** the server reuses the
    client's exact Zod `travelDataSchema` / `normalizeTravelData` (vendored, with a
    CI drift check) so client and server can never disagree on valid data.
  - **Identity:** instance-local accounts (`handle@instance`), server-side
    Argon2id/scrypt password hashing, **opaque revocable session tokens** (Bearer
    access token in memory + HttpOnly/Secure/SameSite refresh cookie — never a
    secret in the SPA bundle, never tokens in localStorage). First account = admin.
  - **Optimistic concurrency:** `PUT /me/document` takes `If-Match: <version>`;
    a stale write returns `409` with the remote document, which the client surfaces
    via the existing `ConflictError` → keep-mine / take-theirs / merge UI.

### Sharing logic (end to end)

- **Publish:** user A edits locally (IndexedDB is the mirror), then sets document
  visibility `private | unlisted | public`. First publish mints an **opaque,
  rotatable** `share_slug`. Profile visibility is independent of map visibility.
- **Address:** share `/share/{slug}` (link-only, backward-compatible with existing
  links) **or** the human `/u/{handle}` (revives the long-dead `public_handle`).
- **View:** anyone opens the address; the server returns a **column-minimized**
  public DTO (bare `TravelData` + `{handle, displayName, avatarColor}`) — never
  email / account id / version internals. Missing / private / revoked all return an
  **identical generic 404** so existence can't be probed.
- **Follow:** signed-in user B follows A by handle (or by pasting a `/share/<slug>`
  URL, resolved via the existing `extractSlug`). A real **directed follow edge**
  (keyed on handle) replaces the opaque `friend_links` code; `FriendCard` shows
  real names + avatar colors. Following is private to the follower.
- **Friendship / feed / discovery (later):** consent-gated symmetric friendship,
  an `audience:'friends'` visibility tier, a column-minimized activity feed, and
  handle search over discoverable public profiles.

**Capability gating:** a pure local-first deployment (no server configured) hides
all Follow / Profile / Feed UI via `DocumentStore.capabilities.sharing` plus a
social capability advertised by the server's `GET /healthz` — exactly like today's
`cloudAvailable()` degrade pattern.

## 3. Sprint plan

Every sprint ships something usable, keeps the app **local-first by default**, and
keeps `npm run ci` green.

| Sprint | Goal | Ships |
|---|---|---|
| **1 — Local-first decoupling** *(no backend yet)* | Remove Supabase from the default/runtime path; a clean clone runs entirely on IndexedDB — no accounts, no cloud, no env required. | Supabase client/store/types deleted; `AuthProvider` becomes a local-session provider; editor/friends/profile `api.ts` become local degraded stubs satisfying the same types; `env.ts` backend-agnostic; CSP `connect-src 'self'`; `@supabase/supabase-js` removed; the three Supabase-mocking tests rewritten local. |
| **2 — Atlas Server skeleton + `SelfHostStore`** | One Docker container: register, sign in, sync your map. Server opt-in via the storage picker. | `server/` (Hono + better-sqlite3, WAL, idempotent migrations); vendored Zod domain; `users/sessions/profiles/documents`; Argon2id + opaque Bearer + refresh cookie; `/auth/*`, `/me`, `GET/PUT /me/document` (If-Match → 409 + remote), `/healthz`, `/config`; client `SelfHostStore` + URL field in the picker; `AuthProvider` wired to `/auth`. |
| **3 — Publishing + public read + handles** | Publish a map, address it by slug **and** by `/u/{handle}`, view it read-only. | `profiles.handle` (unique), availability check, visibility `PATCH`, slug rotate/revoke; column-minimized public DTO endpoints; identical generic 404; a **CI test asserting no public response leaks email/id/hash/token**; client `SharePage` reads by slug + handle; `ProfileEditor` sets handle + visibility. |
| **4 — Follow graph** | Real directed follow edges replace follow-by-code; `FriendsPage` shows real people. | `follows(follower,target,label)` UNIQUE + CASCADE; enriched `GET/POST/DELETE /follows`; `GET /followers`; client `friends/api.ts` rewritten; `FriendCard` renders handle + name + color; backward-compatible with pasted `/share` links. |
| **5 — Friendship + feed + discovery** | The "serious social network" inflection. | Consent-gated friend requests → symmetric Friendship + reciprocal follow; `audience:'friends'` tier; cursor-paginated column-minimized feed; handle discovery over discoverable public profiles; all gated by `/healthz`. |
| **6 — Rich diary growth** *(schemaVersion 2+)* | Grow toward the travel diary entirely via **additive** optional fields — zero backend migration. | `schemaVersion 2` optional `travel.places?[]` (+ Country/City `code/lat/lng`); v3 `travel.stays?[]` (`Money` = integer minor units + ISO-4217); v4 `travel.journal?[]` with per-entry visibility; non-throwing `v1→vN` ladder in `normalize.ts`; `/healthz` advertises `schemaVersionRange` for feature detection; Postgres-optional driver + one-click deploy templates. |

## 4. Key decisions & open questions

- **Single-instance self-host is the default deploy.** The server serves its own
  SPA with a templated `connect-src`, so CSP/CORS just work. A split
  client/server hosted variant is a separately-built target (build-time
  `VITE_SELFHOST_URL` injection). Sprint 1 sets `connect-src 'self'`.
- **`is_public` → `visibility` migration maps to `unlisted`** (link-only), not
  `public`, so existing shared maps are never silently made discoverable. (Sprint 3.)
- **Existing hosted-Supabase data migration is manual:** export the JSON envelope
  from the old build, import it into the new one. No automated importer.
- **Server reuses the client's Zod domain by vendoring** `src/domain` into
  `server/`, guarded by a CI diff check, until a monorepo package is justified.
- **Tokens are never stored in localStorage** (access token in memory + HttpOnly
  refresh cookie) — a deliberate change from the old Supabase `persistSession`.
- **Diary per-entry visibility on partially-public docs** (Sprint 6): decide
  between client-only private entries on public docs vs. a small server-side
  per-entry visibility index. To be settled before Sprint 6.

## 5. What stays from the pre-pivot work

The local-first correctness foundation already landed and is unaffected: correct
`dirty`/undo semantics, the reconcile race fix, city-rename validation, and the
portable export/import envelope (`{app,schemaVersion,updatedAt,data}`) — the same
envelope the server stores opaquely. The domain model, editor store, map, and i18n
core never touched Supabase, so the decoupling blast radius is small and contained.
