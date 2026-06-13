# ADR 0005: Normalize the travel document into a relational schema

- **Status:** Accepted
- **Date:** 2026-06-13
- **Context owners:** Principal Engineer

## Context

ADR 0002 stored the whole travel document as a single JSONB blob in
`travel_records.data`. This kept offline sync trivial but made server-side
analytics, search, and the growing social features awkward: every query had to
unpack JSON, and there was no referential integrity between countries, cities,
and years.

## Decision

Branch the document into a relational model (migration `0003_normalize.sql`):

- `travel_documents` — one row per user; carries the sharing metadata
  (`is_public`, `share_slug`, `version`) and the scalar `birthplace_country`.
- `visited_countries` → `country_timeline_entries` and `cities` → `city_visit_years`,
  each with a `position` column so order survives a round-trip.

Crucially, **the client contract is unchanged**. The editor still reads and
writes a whole `TravelData` JSON; the translation happens in SECURITY DEFINER
functions that assemble/disassemble the document atomically:

- `get_my_travel_document()` / `save_travel_document(jsonb)` — owner read/write.
- `set_travel_sharing(boolean)` — toggle publishing.
- `get_shared_travel(slug)` — public read (same contract as ADR 0003).

`build_travel_json()` is the single place that defines the read-path JSON shape;
`replace_document_children()` is reused by both the save path and the backfill.

## Consequences

**Positive**

- Referential integrity (cascading deletes) and indexable columns for analytics
  and search, without touching the offline-first store or the Zod model.
- `travel_records` is kept as a read-only archive; a later migration drops it
  once the relational model is confirmed in production.

**Negative / trade-offs**

- Writes are "replace all children" (delete + reinsert) rather than a diff. This
  is simple and correct for a single-user document of this size; a future
  optimization could diff if documents grow large.
- The JSON shape now lives in two places (Zod on the client, `build_travel_json`
  on the server) and must be kept in sync — covered by round-trip checks.
