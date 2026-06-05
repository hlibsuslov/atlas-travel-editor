# ADR 0001: Stack and overall architecture

- **Status:** Accepted
- **Date:** 2026-06-05
- **Context owners:** Architecture / Tech Lead

## Context

The product began as a single 852-line `index.html` MVP: vanilla JS, all state
in `localStorage`, client-only validation, and stubbed calls to a `/api/travel`
backend that did not exist. The goal is a multi-tenant SaaS that can serve many
users, be maintained by a team, and scale ~x100 without re-platforming.

## Decision

- **React 18 + TypeScript (strict) + Vite** for the frontend. Mainstream,
  hireable, fast builds, first-class testing.
- **Supabase** (Postgres + Auth + Row Level Security) as the backend. We get
  authentication, a data API (PostgREST), and database-enforced authorization
  without operating a bespoke server.
- **Zod** as the single source of truth for the domain model (types +
  validation + normalization).
- **Zustand** for editor state and **TanStack Query** for server cache/sync.
- **Vercel + GitHub Actions** for hosting and CI.

## Consequences

**Positive**

- No stateful app server to run, scale, or secure; authorization lives next to
  the data as RLS, which is hard to bypass.
- Static frontend on a CDN scales trivially and cheaply.
- Strong typing and a shared schema eliminate a whole class of drift bugs.

**Negative / risks**

- Bespoke server-side logic must be expressed as SQL functions or edge
  functions rather than arbitrary backend code.
- Vendor coupling to Supabase. Mitigated by keeping domain logic
  framework-agnostic and all SQL in version-controlled migrations, so the data
  layer is portable to plain Postgres.

## Alternatives considered

- **Keep vanilla JS, modularized** — lowest churn, but poor fit for team scale
  and testing.
- **Custom Node/Fastify + Postgres** — maximum control, but we would own auth,
  authorization, deployment, and scaling for little benefit at this stage.
- **Client-only PWA** — cheapest, but cannot deliver multi-tenant accounts or
  server-side sharing.
