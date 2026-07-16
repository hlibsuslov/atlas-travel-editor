# ADR 0007: Static Vercel frontend and separate stateful server

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

The Atlas browser application is a static PWA, while Atlas Server requires a
durable SQLite file and a continuously available Node process. Treating them as
one Vercel deployment would blur ownership and encourage an ephemeral/serverless
database topology that the server was not designed for.

The repository also contained an automatic GitHub Pages workflow even though
Pages was disabled, creating a recurring failed deployment alongside healthy
Vercel production.

## Decision

1. Vercel is the canonical public host for the static frontend.
2. `main` produces Production; other branches produce Preview deployments.
3. The frontend build requires no backend environment variables.
4. `vercel.json` owns SPA fallback, cache policy, and security headers.
5. Every build emits non-secret `build-info.json` provenance.
6. A black-box smoke verifies production HTTP, PWA, assets, routes, and headers.
7. Atlas Server deploys separately to a host with persistent storage and HTTPS.
8. GitHub Pages remains a manually dispatched optional mirror, not a second
   automatic production channel.

## Consequences

### Positive

- Static frontend deploys are simple, cacheable, reversible, and independent of
  user data.
- Local-first mode remains available even when no Atlas Server exists.
- Operators can identify the live commit without Vercel dashboard access.
- A broken optional Pages configuration no longer marks every `main` push red.
- Stateful-server backup and rollback remain explicit.

### Negative

- Social/server mode requires a second deployment and CORS/TLS coordination.
- A frontend status does not prove server health.
- Preview authentication limits unauthenticated automated smoke checks.
- Host-specific headers must be reimplemented on non-Vercel mirrors.

## Alternatives considered

- **Deploy SQLite server as Vercel functions:** rejected; the current server
  assumes durable local storage and process-style operation.
- **Make Pages canonical:** rejected because it cannot apply the security headers
  in `vercel.json`.
- **Run automatic deploys to both hosts:** rejected because duplicate production
  channels create noisy failures and ambiguous rollback ownership.
