# Development guide

## Prerequisites

- Node.js 22 and npm.
- Git.
- Docker only when exercising the optional Atlas Server container flow.

The root frontend and `server/` are separate npm packages with separate lock
files.

## First run

```bash
git clone https://github.com/hlibsuslov/atlas-travel-editor.git
cd atlas-travel-editor
nvm use
npm ci
npm run dev
```

Open `http://localhost:5173`. No environment file or backend is needed.

To work on the server too:

```bash
npm --prefix server ci
npm --prefix server run dev
```

The API listens on `http://localhost:8787`. Connect it from the in-app storage
picker. Use `docker compose up --build` when you want the containerized web and
server stack.

## Runtime modes

| Mode | How selected | Identity | Primary persistence |
| --- | --- | --- | --- |
| Local-first | No Atlas Server URL | Synthetic local user, no login wall | IndexedDB or local file |
| Demo | `VITE_DEMO_AUTH=1`, no server | Synthetic session after demo login | Local store |
| Atlas Server | URL selected in UI or `VITE_SELFHOST_URL` | Real server account | Server document plus local cache |

The server URL selected in the UI takes precedence over the build-time default.
Changing the active server/store reloads the relevant app state.

## Environment

Copy `.env.example` only when needed. Every browser-exposed value is embedded at
build time and must start with `VITE_`.

Never put private keys, server bearer secrets, or admin credentials in a
`VITE_` variable: those values are readable by every browser.

## Architectural flow

```text
route/component
  -> feature hook
  -> Zustand working document
  -> global DataSync/autosave
  -> wrapped DocumentStore
       normalize on load
       validate on save
  -> IndexedDB | local file | Atlas Server
```

TanStack Query owns async load/save state. Zustand owns the editable document and
history. Avoid making the same data independently authoritative in both.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Frontend dev server |
| `npm run build` | Typecheck and production bundle |
| `npm run preview` | Serve `dist/` locally |
| `npm run typecheck` | Strict project-reference typecheck |
| `npm run lint` | Type-aware ESLint |
| `npm run format:check` | Verify Prettier formatting |
| `npm run check:docs` | Current-doc policy and local-link guards |
| `npm run check:locales` | Locale parity against English |
| `npm run test` | Frontend unit/component tests |
| `npm run test:coverage` | Tests with V8 coverage output |
| `npm run ci` | Complete local frontend gate |
| `npm --prefix server run ci` | Domain drift, server typecheck, API tests |
| `npm run smoke:deploy -- URL` | Black-box deployed-site verification |

## Where changes belong

- Pure travel rules: `src/domain/`.
- Persistence contract/adapters: `src/lib/storage/`.
- Remote API client: `src/lib/atlas/`.
- Cross-route save behavior: `src/lib/persistence/`.
- Feature-specific UI/state access: `src/features/<feature>/`.
- Reusable UI primitives: `src/components/`.
- HTTP input/response orchestration: `server/src/app.ts`.
- SQLite queries and DTO source rows: `server/src/store.ts`.
- Authentication primitives: `server/src/auth.ts`.

## Adding user-facing text

English (`src/i18n/locales/en.json`) defines the key set. Add the same key to
`de`, `es`, `fr`, `it`, `pt`, `ru`, and `uk`. Use interpolation
instead of string concatenation, and use `Intl` for locale-sensitive values.

`npm run check:locales` catches missing keys, not poor or incorrect
translations; review meaning manually.

## Domain/client-server sync

The server vendors the shared domain files because it is a separate package and
runtime. After changing a shared file, use the exact list in
`server/scripts/check-domain-drift.mjs`, then run:

```bash
npm --prefix server run check:domain
```

Do not “fix” drift by weakening the check.

## Debugging persistence

Browser storage keys:

- IndexedDB database `travel-editor`, object store `documents`.
- Active provider in localStorage key `travel-editor:storage-provider`.
- Fast per-user/provider cache under `travel-editor:v1:*`.
- Atlas Server URL and session token under `atlas:url` and `atlas:token`.

Use a separate browser profile when testing account separation. Never paste real
tokens into bug reports.

When a save fails:

1. Check schema validation and the first invalid path.
2. Check the active provider and connection state.
3. Inspect the network response for auth, CORS, mixed-content, or `409`.
4. Preserve local edits; do not clear storage as a first response.
5. Export JSON before destructive recovery.

## Documentation policy

Current-facing docs describe shipped behavior only. Put proposed work in the
roadmap. Keep superseded ADRs/history clearly labelled and do not silently rewrite
past decisions.

Update documentation in the same change whenever you alter a public command,
environment variable, route, schema, capability, security boundary, or deployment
procedure.
