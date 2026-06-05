# ADR 0003: Public sharing via a SECURITY DEFINER function

- **Status:** Accepted
- **Date:** 2026-06-05
- **Context owners:** Security Engineer

## Context

Users can publish their travel map to a public, read-only link. The obvious
implementation is an RLS policy like `for select using (is_public = true)`. But
RLS is row-level, not column-level: such a policy lets anyone read **every**
column of a public row — including `user_id`, timestamps, and `version` — not
just the document the user meant to share.

## Decision

Expose sharing through a single `SECURITY DEFINER` SQL function:

```sql
get_shared_travel(p_slug text) returns jsonb
```

It returns only the `data` column for rows where `is_public = true`, with
`search_path` pinned to `public`. The base table has **no** public SELECT
policy. The client calls it via `supabase.rpc('get_shared_travel', …)`.

Share slugs are minted server-side from `gen_random_bytes(12)` and are unique
and unguessable.

## Consequences

**Positive**

- Column-level minimization: ownership metadata can never leak through the
  public path.
- The public read path is one auditable function, not a broad table policy.

**Negative**

- Slightly more indirection than a plain table read; the function and its grants
  must be kept in sync with the schema (covered by the migration).

## Alternatives considered

- **Broad public SELECT policy** — simplest, but leaks columns. Rejected.
- **A dedicated public view** — workable, but column/grant management and
  `security_invoker` semantics are subtler than a single explicit function.
