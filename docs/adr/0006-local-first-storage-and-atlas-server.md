# ADR 0006: Local-first storage seam and optional Atlas Server

- **Status:** Accepted
- **Date:** 2026-06-19
- **Supersedes:** backend portions of [ADR 0001](0001-stack-and-architecture.md),
  [ADR 0003](0003-sharing-via-security-definer.md), and
  [ADR 0005](0005-relational-normalization.md)

## Context

Atlas should remain useful without infrastructure or an account while supporting
portable data, self-hosted sync, public maps, and social features. Tying feature
code directly to one hosted database made offline use, provider choice, and
self-hosting harder. Modeling every country/city detail relationally also made
additive diary evolution require backend migrations.

## Decision

1. Make IndexedDB the no-account default.
2. Represent user travel data as one validated `TravelData` document inside a
   portable envelope.
3. Put all persistence providers behind `DocumentStore`.
4. Enforce normalization on load and validation on save in the registry wrapper.
5. Ship local-file and self-hosted-server providers; keep unfinished cloud
   providers disabled.
6. Provide an optional Atlas Server using Hono and built-in SQLite for accounts,
   sync, sharing, and social behavior.
7. Store the envelope opaquely on the server, with only ownership, visibility,
   slug, version, and timestamps modeled relationally.
8. Use opaque version tokens and optimistic concurrency instead of silent
   last-write-wins behavior.

## Consequences

### Positive

- A clean clone works offline with no configuration.
- The user's document can move between providers and files.
- Feature code is independent of persistence vendors.
- Additive diary fields do not require a country/city SQL migration.
- Self-hosters own accounts and data.
- Public reads and social queries still have a narrow server trust boundary.

### Negative

- Server-side analytics over travel details require parsing/indexing the envelope.
- The domain subset is vendored into the independent server package and needs a
  drift guard.
- Optimistic conflict detection exists before a full interactive merge experience.
- Browser-held server tokens remain sensitive to XSS.
- Operators own TLS, rate limiting, backups, upgrades, and availability.

## Alternatives considered

- **Always-online hosted backend:** rejected because it makes infrastructure and
  accounts prerequisites.
- **One direct integration per feature:** rejected because validation, migration,
  and error behavior would drift.
- **Relational country/city schema:** rejected as the canonical contract because
  it couples diary evolution to database migrations.
- **File-only application:** rejected because it cannot provide server-authorized
  sharing or a follow graph.
