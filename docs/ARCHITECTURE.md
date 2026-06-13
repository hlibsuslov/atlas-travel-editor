# Architecture

## Overview

Travel Editor is a single-page React application backed by Supabase. There is no
bespoke backend service: the "API" is Postgres (via PostgREST) with all
authorization enforced by Row Level Security. This keeps the operational
surface small while remaining horizontally scalable — Supabase/Postgres scales
read replicas and connection pooling independently of the static frontend, which
is served from a CDN.

```
┌──────────────┐      HTTPS       ┌───────────────────────────┐
│  Browser SPA │ ───────────────▶ │ Supabase                  │
│  (React/TS)  │                  │  ├─ Auth (JWT)            │
│              │ ◀─────────────── │  ├─ PostgREST (data API)  │
│  Zustand     │   anon key +     │  └─ Postgres + RLS        │
│  TanStack Q  │   user JWT       │     + get_shared_travel() │
└──────────────┘                  └───────────────────────────┘
        │ offline cache (localStorage, per-user)
        ▼
   instant hydrate
```

## Layers

### Domain (`src/domain`) — the source of truth

The entire data model is defined once as Zod schemas (`schema.ts`). From it we
derive:

- **TypeScript types** (`z.infer`) used everywhere — no hand-maintained
  duplicate interfaces.
- **Runtime validation** (`validateTravelData`) used by the UI to show errors
  and by the API layer to refuse writing malformed data.
- **Lenient normalization** (`normalize.ts`) for untrusted input — pasted JSON,
  legacy `localStorage`, server payloads — which never throws and best-effort
  shapes data into the current model.

This layer has zero React/Supabase dependencies, so it is trivially unit-tested
and is the most heavily covered part of the codebase.

### Lib (`src/lib`)

Cross-cutting infrastructure: fail-fast environment validation (`env.ts`), the
typed Supabase singleton (`supabase.ts`), the TanStack Query client, and small
utilities. `database.types.ts` mirrors the SQL schema and gives the Supabase
client end-to-end type safety.

### Features (`src/features`)

Vertical slices, each owning its UI, state, and data access:

- **auth** — `AuthProvider` subscribes to Supabase auth state and exposes
  sign-in (magic link / Google OAuth) and sign-out. Routing gates the editor
  behind a session.
- **editor** — a Zustand store holds the working document with a `dirty` flag;
  `useTravelData` bridges the store, the offline cache, and the server
  (load on mount, explicit save, share toggle); presentational components
  (`CountryCard`, `CityTimeline`, `TagList`, `JsonPreview`, …) are thin and
  prop-driven.
- **sharing** — a public, read-only page that resolves a slug to a document via
  the `get_shared_travel` RPC.

## State & data flow

1. On auth, the store hydrates instantly from the per-user `localStorage` cache
   (offline-first), then TanStack Query fetches the server record and
   reconciles, writing back to cache.
2. UI mutations go through typed store actions (immutable via Immer) and flip
   `dirty`. The JSON preview and validation badge derive from store state with
   `useMemo`.
3. **Save** is explicit and user-triggered. `saveMyRecord` validates against the
   strict schema before calling `save_travel_document` — the client never
   persists invalid data, and the database constrains it further.
4. **Storage is relational** (ADR 0005): the document is branched into
   `travel_documents → visited_countries → cities → city_visit_years` (plus
   country timeline entries). The client still works with a whole `TravelData`
   JSON; SECURITY DEFINER functions assemble/disassemble it atomically, so the
   offline cache and public share contract are unchanged.

## Scaling to x100

- **Frontend**: static assets on a CDN; vendor code is split into cacheable
  chunks (`react`, `supabase`, `query`) so app deploys don't bust dependency
  caches.
- **Data**: one document per user keyed by a unique `user_id`, branched into
  indexed child tables (countries/cities/years) for analytics and search.
  Public sharing is an indexed slug lookup.
- **Auth/throughput**: handled by Supabase (connection pooling, read replicas).
  No stateful app server to scale or fail over.
- **Cost**: pay-per-use hosting + managed Postgres; no idle compute.

## Testing strategy

- **Domain** — exhaustive unit tests on validation, timeline parsing, and
  normalization (the riskiest, purest logic).
- **Store** — behavioral tests on mutations, dedup/sort invariants, and
  out-of-range safety.
- **Components** — Testing Library tests on the validated inputs and the
  store↔UI binding.
- **CI gate** — `typecheck → lint → format:check → test (coverage) → build`
  must pass on every PR.

## Notable trade-offs

- **PostgREST over a custom API**: less control over bespoke endpoints, but far
  less code to own and a smaller attack surface. Complex server logic, when
  needed, lives in SQL functions (as `get_shared_travel` already does).
- **Explicit save over autosave**: simpler conflict story and predictable
  writes for the MVP→SaaS transition. `version` is already tracked in the schema
  to enable optimistic concurrency / autosave later without a migration.
