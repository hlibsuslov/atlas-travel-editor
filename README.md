# Travel Editor

[![CI](https://github.com/OWNER/atlas-travel-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/atlas-travel-editor/actions/workflows/ci.yml)
[![CodeQL](https://github.com/OWNER/atlas-travel-editor/actions/workflows/codeql.yml/badge.svg)](https://github.com/OWNER/atlas-travel-editor/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

<!-- TODO: replace OWNER above with the GitHub org/user once the repo slug is final. -->

Edit, validate, and share a personal travel map. You record a birthplace,
visited/lived countries, cities and year timelines into one self-contained
`TravelData` JSON document, edited through a typed React UI with a live,
validated JSON preview, an interactive world map — and, when you connect a
backend, a public read-only share link.

It runs **with no backend at all** (your data on your device, exported as a JSON
file), or against **hosted Supabase** for multi-user accounts and sharing.

<!-- TODO: add a hero screenshot at docs/assets/hero.png (image lands later). -->
<!-- ![Travel Editor — editor and world map](docs/assets/hero.png) -->

## Try it in 60 seconds — no backend needed

No account, no Supabase, no network. Clone, point `.env` at local-first mode,
and you are editing your map.

```bash
git clone <your-fork-url> atlas-travel-editor
cd atlas-travel-editor
cp .env.example .env        # then enable a no-backend mode (below)
npm install
npm run dev                 # http://localhost:5173
```

Enable one of these in `.env` — either works:

```dotenv
# Pure local-first, no login screen:
VITE_LOCAL_ONLY=1

# …or demo auth — a minimal login screen, credentials 1 / 1:
VITE_DEMO_AUTH=1
```

Now edit your document, watch the live JSON preview, colour the map, and use
**Export** / **Import** to save your data to a JSON file or move it between
machines. `VITE_SUPABASE_*` are not required in this mode. Account-only
features (public sharing, friends, public profile) are simply hidden — they need
a server.

<!-- TODO: add a demo GIF at docs/assets/demo.gif (recording lands later). -->
<!-- ![Editing and exporting a travel map](docs/assets/demo.gif) -->

For accounts, multi-device sync, and sharing, set up Supabase — see
[Storage options](#storage-options) and [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

## Features

- **Editor** — typed, validated UI over the travel document with a live JSON preview.
- **Interactive world map** — countries coloured by status (birthplace / lived /
  visited / capital-only), built on react-simple-maps; load your own data or view
  a friend's.
- **Friends** — follow people by their public share code and browse their maps.
- **Internationalization** — 8 languages (en, ru, uk, es, de, fr, it, pt) via
  i18next with browser-language detection; adding a locale is one JSON file.
- **Light / dark / system theme** — shared CSS tokens, no per-component styling.
- **Local-first & offline** — installable PWA that works offline via a service
  worker, and can run with no backend at all (data on your device, exported as a
  JSON file). See [Storage options](#storage-options).
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
| Storage / Auth | Local-first (device / file) **or** Supabase (Postgres + Auth + RLS) |
| Hosting / CI   | Vercel + GitHub Actions (typecheck · lint · test · build)     |

## Storage options

The whole document is one self-contained `TravelData` JSON blob, so where it
lives is pluggable. Three modes share the same build; you pick one in `.env`:

| Mode | Account? | Data lives in | Sharing / friends | Status |
| ---- | -------- | ------------- | ----------------- | ------ |
| **Local-first** (`VITE_LOCAL_ONLY=1` or `VITE_DEMO_AUTH=1`) | no | your device + JSON files you export/import | no | available |
| **Hosted Supabase** (`VITE_SUPABASE_*`) | yes | a Supabase project | yes (public links, friends) | available |
| **Bring-your-own-cloud** (Drive / Dropbox / WebDAV / GitHub) | varies | your own cloud / repo | no | coming online incrementally |

- **Local-first** — no account, no network; back up and move data via JSON
  Export/Import. This is the "Try it in 60 seconds" path above.
- **Hosted Supabase** — the existing multi-user/sharing path: each user owns one
  document protected by Row Level Security and can mint a public read-only link.
- **Bring-your-own-cloud** — store the single JSON blob in a cloud you control.
  These providers are landing behind a common storage seam (see
  [`docs/STRATEGY.md`](docs/STRATEGY.md) §4); only enable a provider once it is
  listed as available here.

Full copy-paste setup for every mode — including fully self-hosted Supabase — is
in [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

### Required environment

See [`.env.example`](.env.example). Only `VITE_`-prefixed values reach the
browser. In **local-first** mode no Supabase variables are needed. For the
**hosted Supabase** mode, the **anon** key is public by design — access is
enforced by Row Level Security, never by hiding the key. The `service_role` key
must never appear in this app.

| Variable                 | Required                | Purpose                            |
| ------------------------ | ----------------------- | ---------------------------------- |
| `VITE_LOCAL_ONLY`        | local-first             | Run with no backend, no login      |
| `VITE_DEMO_AUTH`         | local-first (alt.)      | Demo login screen (1 / 1), no backend |
| `VITE_SUPABASE_URL`      | hosted Supabase         | Supabase project URL               |
| `VITE_SUPABASE_ANON_KEY` | hosted Supabase         | Public, RLS-scoped anon key        |
| `VITE_APP_URL`           | no                      | Base URL used to build share links |
| `VITE_SENTRY_DSN`        | no                      | Enables Sentry monitoring if set   |

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

## Hosted Supabase setup

> This is the **hosted Supabase** mode. To run with no backend instead, see
> [Try it in 60 seconds](#try-it-in-60-seconds--no-backend-needed); for the full
> walkthrough of all three modes (including fully self-hosted Supabase), see
> [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` from your
project's API settings, then run `npm install && npm run dev`.

### Database

The schema lives in [`supabase/migrations`](supabase/migrations). Apply it with
the Supabase CLI:

```bash
supabase db push          # against a linked project
# or, for local dev:
supabase start && supabase db reset
```

### Auth setup

The login screen supports **email + password** (sign in and sign up), passwordless
**magic link**, and **Google OAuth** — all wired in `AuthProvider`. For these to
work end-to-end:

1. In **Supabase → Authentication → Providers**, keep **Email** enabled (it is by
   default). The **Confirm email** toggle decides whether new sign-ups must click
   a link before they can sign in — the app handles both cases (it shows a
   "check your inbox" message when confirmation is required).
2. In **Supabase → Authentication → URL Configuration**, set the **Site URL** and
   add the deployed origin (and `http://localhost:5173` for dev) to **Redirect
   URLs**, so confirmation/magic links and OAuth return to the app.
3. Google OAuth additionally needs the Google provider enabled with its client
   credentials.

After changing the schema, regenerate types:

```bash
supabase gen types typescript --linked > src/lib/database.types.ts
```

## Deployment

Hosted on Vercel as a static SPA (`vercel.json` configures SPA rewrites,
long-term asset caching, and security headers including a strict CSP). Set the
required environment variables in the Vercel project, point Supabase Auth's
redirect URLs at the deployed origin, and push to `main`.

The CSP `connect-src` in `vercel.json` is hardcoded to the managed Supabase and
Sentry domains. If you deploy against a **self-hosted Supabase** or a
**bring-your-own-cloud** origin, you must widen `connect-src` to allow it — see
[`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md#widen-the-csp-for-a-non-default-origin).

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

## Contributing

PRs are welcome — start with [`CONTRIBUTING.md`](CONTRIBUTING.md), and be kind
per our [`Code of Conduct`](CODE_OF_CONDUCT.md). To report a vulnerability, see
the [`Security Policy`](.github/SECURITY.md).

## Documentation

- [Run modes & self-hosting](docs/SELF_HOSTING.md) — local-only, hosted Supabase, fully self-hosted
- [Architecture & strategy](docs/STRATEGY.md)
- [Architecture overview](docs/ARCHITECTURE.md)
- [Brand & assets](docs/brand/BRAND.md) — logo, palette, type, favicon, social card
- [Security model](docs/SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](.github/SECURITY.md)
- [ADRs](docs/adr)

## License

[MIT](LICENSE)
