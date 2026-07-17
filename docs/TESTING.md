# Testing and quality gates

Atlas has two executable test surfaces: the browser application and the optional
server. Deployment has a third, black-box smoke surface.

## Required gates

```bash
npm run ci
npm --prefix server run ci
```

The frontend gate runs:

1. TypeScript project-reference typecheck.
2. ESLint.
3. Prettier check.
4. Documentation policy and local-link checks.
5. Locale key parity.
6. Vitest unit/component suite.
7. Production Vite/PWA build.

The server gate runs:

1. Vendored-domain drift check.
2. TypeScript typecheck.
3. Node test runner API suite against temporary SQLite databases.

## Test layers

| Layer | Location | What it should prove |
| --- | --- | --- |
| Domain | `src/domain/*.test.ts` | Validation, normalization, dates, geography, statistics |
| Editor store | `src/features/editor/store.test.ts` | Mutations, history, ordering, dirty baseline |
| Storage | `src/lib/storage/**/*.test.ts` | Load/save contract, versions, conflicts, envelopes |
| Feature APIs | `src/features/**/*.test.ts` | Request shaping and graceful no-server behavior |
| Components | `src/**/*.test.tsx` | User-visible behavior, keyboard and accessible roles |
| Server API | `server/src/app.test.ts` | Auth, ownership, validation, sharing, social, leakage |
| Deployment | `scripts/smoke-deployment.mjs` | HTTP, SPA fallback, PWA, assets, headers, provenance |

Prefer behavior assertions over implementation snapshots. Tests must not depend on
the developer's real browser storage, network services, Vercel credentials, or
wall-clock locale.

## Deployment smoke

```bash
npm run smoke:deploy -- https://atlas-travel-editor.vercel.app
```

The smoke test verifies:

- root HTML and React mount point;
- security headers;
- hashed JS/CSS existence and immutable caching;
- SPA fallback for editor, map, stats, friends, share, and unknown routes;
- PWA manifest, registration script, and service worker;
- `build-info.json` when deployed from a build that includes provenance;
- an expected commit/environment when `ATLAS_EXPECT_COMMIT` and
  `ATLAS_EXPECT_ENV` are supplied (the production workflow supplies both).

Protected Vercel previews redirect to Vercel authentication and therefore fail
this unauthenticated smoke by design. Temporarily disable protection for a test
preview or run the same checks with an authenticated browser.

The scheduled “Production smoke” GitHub workflow exercises the canonical Vercel
alias daily and can also be dispatched manually.

## Manual browser acceptance

Before a high-risk release, test in a clean browser profile:

1. Open the editor with no environment variables and no network.
2. Start blank, add/edit/reorder a country and city, then reload.
3. Undo/redo and verify save status returns to synced.
4. Add a stay with a currency cost and inspect statistics.
5. Export, clear the profile, import, and compare the document.
6. Change language and theme.
7. Edit the map using keyboard and pointer controls.
8. Install/reload the PWA and verify the app shell works offline.
9. If server behavior changed, register two temporary users, publish one map,
   follow in both directions, verify friends/feed, rotate the slug, and confirm
   the old link returns the generic not-found view.

Never use production personal data for acceptance tests.

## Coverage

`npm run test:coverage` writes text, HTML, and LCOV reports under `coverage/`.
CI uploads the report for seven days. There is currently no numeric threshold;
coverage is evidence, not a substitute for testing risky branches.

## Diagnosing CI versus local differences

- Use `npm ci`, not `npm install`, to reproduce the lockfile exactly.
- Use Node 22 (`.nvmrc`).
- Run `npm run format:check`; local `npm run ci` includes it.
- The root Vitest config intentionally excludes `server/`.
- Server tests need the built-in SQLite API and may print an experimental warning
  on Node 22; the Docker/runtime image uses Node 24.
- Vercel build-time variables can change emitted hashes. Compare
  `build-info.json` and behavior, not only asset filenames.

## Writing regression tests

A regression test should fail on the broken behavior, exercise the public seam
closest to the bug, and pass without timing sleeps. Add server leak assertions
whenever a public DTO changes. Add locale keys and docs when the regression
changes user-facing behavior.
