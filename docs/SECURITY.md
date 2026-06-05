# Security Model

## Authentication

Authentication is handled by Supabase Auth (email magic-link and Google OAuth).
The browser holds a short-lived JWT (auto-refreshed) and an anon API key. The
JWT identifies the user to Postgres as `auth.uid()`.

## Authorization — Row Level Security

All authorization is enforced in the database, not the client. The client uses
the **public anon key**; this is safe because every table has RLS enabled and
the anon role can do nothing that policies don't explicitly allow.

`travel_records` policies (see `supabase/migrations/0001_init.sql`):

| Action | Policy        | Rule                              |
| ------ | ------------- | --------------------------------- |
| SELECT | `owner_select`| `auth.uid() = user_id`            |
| INSERT | `owner_insert`| `with check auth.uid() = user_id` |
| UPDATE | `owner_update`| `using` + `with check` on owner   |
| DELETE | `owner_delete`| `auth.uid() = user_id`            |

There is **no** public SELECT policy. A user can never read or write another
user's row regardless of what the client sends.

The `friend_links` table (the per-user follow list) has a single owner-scoped
`for all` policy (`auth.uid() = user_id`), so a user's follow list is private to
them. Following someone stores only that person's **public** share slug; the
friend's map is then read through the same `get_shared_travel` function, so
following never exposes anything the friend didn't choose to publish.

## Public sharing without data leakage

Public, read-only sharing is exposed through a single `SECURITY DEFINER`
function:

```sql
get_shared_travel(p_slug text) returns jsonb
```

It returns **only** the `data` payload for rows where `is_public = true`. Because
it selects one column under a constrained predicate, ownership metadata
(`user_id`, timestamps, version) is never exposed — which a broad public SELECT
policy on the table would have leaked. Execute is granted to `anon` and
`authenticated`; the function pins `search_path = public` to prevent search-path
hijacking.

Share slugs are minted server-side from `gen_random_bytes(12)` (≈96 bits of
entropy), so they are unguessable.

## Defense in depth

- **Validation at every boundary**: the client validates with the shared Zod
  schema before saving; `saveMyRecord` refuses to write invalid data; the
  database enforces types and constraints. Untrusted input (imports, cached
  data, server responses) is run through lenient normalization that never
  throws.
- **No secrets in the client**: only the anon key and public URLs ship to the
  browser. The `service_role` key is never referenced. `.env` is gitignored;
  `.env.example` documents the contract.
- **HTTP hardening** (via `vercel.json`): a strict Content-Security-Policy
  (`default-src 'self'`, scripts self-only, connections limited to Supabase),
  HSTS with preload, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
  / `frame-ancestors 'none'`, a tight `Referrer-Policy`, and a restrictive
  `Permissions-Policy`.
- **Per-user offline cache**: `localStorage` keys are namespaced by user id so
  switching accounts on a shared device cannot surface another user's cached
  data.
- **Static analysis**: CodeQL runs on every push/PR and weekly; the CI gate
  blocks merges on type, lint, or test failures.

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the maintainers rather than
opening a public issue. Include reproduction steps and impact assessment.

## Known limitations / future work

- Rate limiting relies on Supabase defaults; add per-IP/per-user limits before
  high-volume public exposure.
- No audit log of edits yet; the `version` column is the foundation for one.
- Magic-link and OAuth redirect URLs must be locked to the production origin in
  the Supabase dashboard to prevent open-redirect-style abuse.
