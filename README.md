# Travel Editor

A multi-tenant SaaS for editing, validating, and sharing a personal travel map.
Each signed-in user owns one travel document (birthplace, visited/lived
countries, cities and year timelines) stored in Supabase, editable through a
typed React UI with a live, validated JSON preview, and shareable via a public
read-only link.

## Features

- **Editor** — typed, validated UI over the travel document with a live JSON preview.
- **Interactive world map** — countries coloured by status (birthplace / lived /
  visited / capital-only), built on react-simple-maps; load your own data or view
  a friend's.
- **Friends** — follow people by their public share code and browse their maps.
- **Internationalization** — 8 languages (en, ru, uk, es, de, fr, it, pt) via
  i18next with browser-language detection; adding a locale is one JSON file.
- **Light / dark / system theme** — shared CSS tokens, no per-component styling.
- **Offline-first PWA** — installable, works offline via a service worker.
- **Toasts** for non-blocking feedback; **Sentry** hook for error monitoring.

> This is the production rebuild of the original single-file `index.html` MVP.
> See [`docs/adr/0001-stack-and-architecture.md`](docs/adr/0001-stack-and-architecture.md)
> for why the architecture looks the way it does.

## Stack

| Concern        | Choice                                                          |
| -------------- | -------------------------------------------------------------- |
| Frontend       | React 18 + TypeScript (strict) + Vite                          |
| State          | Zustand (editor) + TanStack Query (server cache)              |
| Validation     | Zod — one schema shared by UI, API client, and tests          |
| Backend / Auth | Supabase (Postgres + Auth + Row Level Security)               |
| Hosting / CI   | Vercel + GitHub Actions (typecheck · lint · test · build)     |

## Quick start

```bash
npm install
cp .env.example .env        # fill in your Supabase project values
npm run dev                 # http://localhost:5173
```

### Required environment

See [`.env.example`](.env.example). Only `VITE_`-prefixed values reach the
browser. The Supabase **anon** key is public by design — access is enforced by
Row Level Security, never by hiding the key. The `service_role` key must never
appear in this app.

| Variable                 | Required | Purpose                          |
| ------------------------ | -------- | -------------------------------- |
| `VITE_SUPABASE_URL`      | yes      | Supabase project URL             |
| `VITE_SUPABASE_ANON_KEY` | yes      | Public, RLS-scoped anon key      |
| `VITE_APP_URL`           | no       | Base URL used to build share links |
| `VITE_SENTRY_DSN`        | no       | Enables Sentry monitoring if set   |

## Scripts

| Script                  | Description                                       |
| ----------------------- | ------------------------------------------------ |
| `npm run dev`           | Vite dev server                                  |
| `npm run build`         | Typecheck + production build to `dist/`          |
| `npm run preview`       | Serve the production build locally               |
| `npm run typecheck`     | `tsc` project references, no emit                |
| `npm run lint`          | ESLint (type-aware)                              |
| `npm run format`        | Prettier write                                   |
| `npm run test`          | Vitest unit + component tests                    |
| `npm run test:coverage` | Tests with V8 coverage                           |
| `npm run ci`            | The full gate: typecheck → lint → test → build   |

## Database setup

The schema lives in [`supabase/migrations`](supabase/migrations). Apply it with
the Supabase CLI:

```bash
supabase db push          # against a linked project
# or, for local dev:
supabase start && supabase db reset
```

Then enable an auth provider (email magic-link works out of the box; Google
OAuth is wired in `AuthProvider`). After changing the schema, regenerate types:

```bash
supabase gen types typescript --linked > src/lib/database.types.ts
```

## Deployment

Hosted on Vercel as a static SPA (`vercel.json` configures SPA rewrites,
long-term asset caching, and security headers including a strict CSP). Set the
three environment variables in the Vercel project, point Supabase Auth's
redirect URLs at the deployed origin, and push to `main`.

## Project layout

```
src/
  domain/      Zod schemas, validators, normalization — the source of truth
  i18n/        i18next config + locale JSON (en, ru, uk, es, de, fr, it, pt)
  lib/         env validation, Supabase client, query client, observability, utils
  features/
    auth/      AuthProvider, login
    editor/    store (Zustand), data hooks, API layer, components
    map/       world map, country-name matching, legend
    friends/   follow by share code, browse friends' maps
    settings/  theme + language switchers
    sharing/   public read-only share page (with map)
  components/  cross-feature UI (AppShell nav, ErrorBoundary)
supabase/migrations/   SQL: tables, RLS, triggers, sharing function, friends
docs/                  architecture, security, ADRs
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY.md)
- [ADRs](docs/adr)

## License

[MIT](LICENSE)
