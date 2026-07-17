# Repository guide for coding agents

This file is the operational map for automated contributors. It supplements the
human-facing [README](README.md) and [contribution guide](CONTRIBUTING.md).

## Product truths

- Atlas is a local-first travel map and diary. A clean build must remain useful
  without an account, backend, or environment file.
- IndexedDB is the default store. The Atlas Server is optional and is selected
  explicitly by the user.
- The Vercel project deploys the static frontend only. The stateful Atlas Server
  is a separate Docker deployment.
- User travel data is one `TravelData` document. Do not split that contract into
  feature-specific persistence models.
- GitHub, WebDAV, Google Drive, and Dropbox adapters are placeholders with
  `ready: false`; do not present them as usable.

## Read before changing

Choose the smallest relevant set:

- [Architecture](docs/ARCHITECTURE.md) for boundaries and data flow.
- [Data model](docs/DATA_MODEL.md) for schema and migration rules.
- [Development](docs/DEVELOPMENT.md) for setup and common change recipes.
- [Testing](docs/TESTING.md) for the verification matrix.
- [Deployment](docs/DEPLOYMENT.md) for Vercel, Pages, and Docker.
- [Security](docs/SECURITY.md) for auth, sharing, and trust boundaries.
- [Project status](docs/PROJECT_STATUS.md) before claiming that a feature exists.
- [ADRs](docs/adr/README.md) before revisiting an architectural decision.

Historical documents are context, not current implementation truth:
`docs/STRATEGY.md` and superseded ADRs preserve earlier decisions.

## Repository map

```text
src/domain/                 canonical Zod schema, normalization, geography, stats
src/lib/storage/            DocumentStore contract, registry, adapters, envelope
src/lib/atlas/              typed client for the optional Atlas Server
src/lib/persistence/        global autosave and save-status orchestration
src/features/               vertical UI slices
server/src/domain/          vendored subset of the client domain
server/src/                 Hono API, auth, SQLite schema, data access
scripts/                    repository and deployment guards
docs/                       maintained project knowledge and runbooks
.github/workflows/          CI, security analysis, optional Pages, prod smoke
```

## Supported toolchain

- Node.js 22 is the repository default (`.nvmrc`).
- The frontend package is at the repository root.
- The server is an independent package under `server/` and uses Node's built-in
  SQLite API.

```bash
nvm use
npm ci
npm --prefix server ci
npm run dev
```

Do not commit `.env`, tokens, databases, generated `dist/`, coverage output, or
local editor state.

## Non-negotiable invariants

### Domain

1. `src/domain/schema.ts` is the source of truth for valid data.
2. Untrusted or legacy input goes through `normalizeTravelData`.
3. Every persistence write goes through strict validation in the storage registry.
4. Domain changes are additive when possible. Update normalization and tests with
   every schema change.
5. Sync the vendored server domain and run its drift guard after touching shared
   domain files.

### Storage

1. Features do not import a concrete store directly.
2. New providers implement `DocumentStore` and are registered centrally.
3. A provider is not marked ready until load, save, connection, error, and
   concurrency behavior are implemented and tested.
4. Version tokens are opaque outside the adapter.
5. A failed remote save must never silently discard local edits.

### Server and security

1. Every private query is scoped by the authenticated user id.
2. Public endpoints return explicit, column-minimized DTOs.
3. Missing, private, and revoked public documents remain indistinguishable.
4. Passwords and bearer tokens are never logged or returned after issuance.
5. New server configuration belongs in `server/README.md`,
   `docs/SELF_HOSTING.md`, and the environment contract.

### UI and i18n

1. User-facing text goes through i18next.
2. English is the canonical locale; all seven other locale files must retain key
   parity.
3. Keyboard and screen-reader behavior need tests for interactive components.
4. Respect reduced motion and existing design tokens.

## Common change recipes

### Change `TravelData`

1. Update `src/domain/schema.ts`.
2. Add the backward-normalization behavior in `src/domain/normalize.ts`.
3. Update domain fixtures and tests.
4. Sync the files listed by `server/scripts/check-domain-drift.mjs`.
5. Update [DATA_MODEL.md](docs/DATA_MODEL.md) and add an ADR if compatibility
   semantics change.

### Add or change an API endpoint

1. Define input validation in `server/src/app.ts`.
2. Keep SQL in `server/src/store.ts`.
3. Add API tests, including unauthenticated and leakage cases.
4. Update `server/README.md` and relevant security documentation.
5. Update the typed client under `src/lib/atlas/`.

### Add a storage provider

1. Implement the adapter under `src/lib/storage/stores/`.
2. Declare honest capabilities.
3. Register it with `ready: false`.
4. Test normalization, validation, connection, failure, and conflict behavior.
5. Set `ready: true` only when the picker flow is usable end to end.

### Change deployment behavior

1. Keep `vercel.json`, `vite.config.ts`, and
   [DEPLOYMENT.md](docs/DEPLOYMENT.md) aligned.
2. Build locally and run the deployment smoke against a preview.
3. Verify `/build-info.json`, SPA routes, PWA files, asset caching, and headers.
4. Remember that frontend deployment does not deploy the Atlas Server.

## Definition of done

```bash
npm run ci
npm --prefix server run ci
npm run smoke:deploy -- https://preview-or-production.example.com
```

Also inspect `git diff --check` and the complete diff. Update documentation when
behavior, configuration, architecture, public API, security posture, or deployment
operations change. Do not mark deferred behavior as shipped.
