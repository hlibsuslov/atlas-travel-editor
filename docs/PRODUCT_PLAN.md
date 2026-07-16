# Atlas — product and engineering plan

> Current north star. It replaces the hosted-backend direction preserved in
> [STRATEGY.md](STRATEGY.md). For shipped detail, use
> [PROJECT_STATUS.md](PROJECT_STATUS.md); for task-level backlog, use
> [ROADMAP.md](ROADMAP.md).

## Product promise

Atlas helps a person build a durable map and diary of their travel life without
giving up control of their data.

The first useful session requires no account, environment variables, or backend.
The user can record countries, cities, timelines, and stays; understand their map
and statistics; export the complete document; and return offline.

An Atlas Server is an explicit upgrade for people who want cross-device sync,
public maps, profiles, and social features on infrastructure they choose.

## Commitments

### 1. Local-first is the default experience

- The editor starts without a login wall.
- IndexedDB is ready immediately.
- Network/server failure never silently discards unsaved local edits.
- The complete travel document is exportable in a documented format.
- Server-only UI is hidden or explains the required connection honestly.

Local-first does not mean automatic conflict-free collaboration. Atlas currently
detects stale versions; a guided conflict resolver is a priority.

### 2. User-controlled persistence

Every backend implements one `DocumentStore` contract. Features do not couple to
a storage vendor. Providers advertise honest capabilities and remain disabled
until they work end to end.

The portable envelope and normalization policy are product features, not internal
implementation details: they protect migration, backup, and exit.

### 3. Optional, self-hostable social layer

Atlas Server owns:

- instance-local accounts and sessions;
- one versioned document per user;
- private/unlisted/public publication;
- handles and revocable links;
- follows, mutual friends, discovery, and feed.

The static frontend remains independently useful. Vercel hosting never implies a
central Atlas database.

### 4. Privacy by explicit publication

- New documents are private.
- Public endpoints return minimized DTOs.
- A share slug can be rotated/revoked.
- Following does not grant access to private data.
- Future audience tiers need explicit server authorization and tests.

### 5. Compatibility before novelty

Schema changes are additive when possible. Older supported documents normalize
forward. Newer unsupported documents must eventually fail closed instead of
losing unknown fields. Every change is validated on both client and server.

## Who Atlas serves

### Private traveler

Wants a beautiful personal map and diary with no account. Values offline use,
export, predictable autosave, and long-term ownership.

### Self-hoster

Wants sync and sharing without a mandatory SaaS. Values a small Docker service,
clear TLS/CORS configuration, backups, and reversible upgrades.

### Social traveler

Wants a public profile, shareable map, follows, mutual friends, and discovery.
Values clear visibility and identity controls.

### Contributor

Wants strong boundaries, executable tests, truthful docs, and small changes that
do not require reconstructing project history.

## Current product architecture

```text
React/Vite PWA
  -> Zustand working TravelData + bounded history
  -> global autosave / TanStack Query
  -> DocumentStore registry (normalize-load, validate-save)
       -> IndexedDB (default)
       -> local file
       -> Atlas Server (optional)

Atlas Server
  -> Hono HTTP API
  -> authenticated ownership boundary
  -> SQLite (users, sessions, profiles, opaque documents, follows)
```

The travel contract is one opaque document, not a relational country/city tree.
Server tables model identity, authorization, publication, and concurrency.

## Evolution priorities

### Priority 0 — prevent data loss and ambiguity

1. Interactive conflict resolution using the already-returned remote document.
2. Fail-closed handling for unsupported future envelope versions.
3. Tested backup/restore and release rollback for Atlas Server.
4. Resolve inherited map dependency advisories without behavior regression.

### Priority 1 — deepen the travel product

1. Persist ISO country codes and localize map labels.
2. Compare maps and explore travel over time.
3. Improve bulk entry/editing and diary detail.
4. Add E2E, accessibility, and performance budgets around core journeys.

### Priority 2 — make public social use safer

1. Explicit private/unlisted/public UX.
2. Optional friend requests and audience authorization.
3. Block/report and abuse controls.
4. Rate limiting, request limits, account recovery, session management, and audit
   logging before broad multi-tenant claims.

### Priority 3 — expand user-owned storage

Implement WebDAV/GitHub/Drive/Dropbox one at a time. Each needs least-privilege
credentials, concurrency semantics, failure recovery, provider-specific setup,
and an exit path. Placeholder classes are not progress toward “shipped”.

## What “shipped” means

A capability is shipped only when:

- the normal and failure journeys are usable;
- persisted/public contracts are documented;
- client and server authorization/validation tests cover it;
- all locale keys are complete;
- `npm run ci` and the server gate pass;
- deployment/runtime changes have smoke or health evidence;
- project status and changelog are updated;
- security and recovery implications are explicit.

An implementation branch, disabled adapter, design mock, or unchecked migration
does not count.

## Deliberate non-goals today

- A mandatory hosted Atlas account.
- Real-time multi-user editing.
- Multiple travel documents per account.
- Server-side SQL analytics over every country/city field.
- Claiming production-grade public SaaS security from the current self-host
  defaults.
- Enabling every cloud provider at once.

These can be revisited through an ADR when user evidence outweighs the simplicity
and ownership benefits of the current model.
