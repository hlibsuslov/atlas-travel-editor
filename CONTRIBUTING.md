# Contributing

Thanks for contributing! This guide keeps changes consistent and the main branch
releasable at all times.

## Getting started

```bash
nvm use            # Node 20 (see .nvmrc)
npm install
npm run dev        # http://localhost:5173
```

That's everything. Atlas is **local-first**: it boots straight into the editor with
no backend and stores your data in the browser (IndexedDB). You do **not** need an
account, a server, or a `.env` file to develop.

A `.env` is only useful if you want to point the app at an optional, self-hosted
[Atlas Server](docs/SELF_HOSTING.md) (sharing/social) or enable Sentry — copy
[`.env.example`](.env.example) and set what you need. Every variable is optional.

New here? Look for the [**`good first issue`**](https://github.com/hlibsuslov/atlas-travel-editor/labels/good%20first%20issue)
label — those are scoped, low-context tasks that are a good on-ramp. If none are
open, comment on any issue you'd like to pick up and we'll help you scope it.

## Workflow

1. Branch from `main` (e.g. `feat/share-qr`, `fix/timeline-range`).
2. Make the change with tests.
3. Run the full gate before pushing:
   ```bash
   npm run ci      # typecheck · lint · test · build
   ```
   If you touched the optional server, also run its gate:
   ```bash
   npm --prefix server run ci   # check:domain · typecheck · node:test
   ```
4. Open a PR using the template. CI (and CodeQL) must be green to merge.

## Conventions

- **Domain first.** The data model lives in `src/domain` as Zod schemas — the
  single source of truth. The schema **evolves through the Zod + `normalize.ts`
  ladder, not SQL**: bump the schema, teach `normalize.ts` how to bring older
  documents forward, and types/validation follow. Don't hand-roll parallel types
  or ad-hoc validation.
- **Storage seam.** Every backend implements one `DocumentStore` contract and is
  registered behind `src/lib/storage`, which enforces normalize-on-load and
  validate-on-save for all providers. Add a new backend there rather than reaching
  around the seam.
- **Feature slices.** Code is organized by feature (`src/features/<name>`), each
  owning its UI, state, and data access.
- **Type safety.** TypeScript is strict (incl. `noUncheckedIndexedAccess`). No
  `any`; prefer `unknown` + narrowing. Imports of types use `import type`.
- **Tests.** Pure/domain logic gets unit tests; components get Testing Library
  tests. The full client gate is `npm run ci`.
- **Commits.** Conventional Commits style is encouraged
  (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).

## Server changes

The optional Atlas Server lives in `server/` (Node + Hono + the built-in
`node:sqlite`). It vendors a copy of the client's Zod domain so the two stay in
lockstep; a guard enforces this:

```bash
npm --prefix server run check:domain   # fails if the vendored domain drifts
npm --prefix server run ci             # check:domain · typecheck · node:test
```

If you change the domain in `src/domain`, re-sync the server's copy and make sure
`check:domain` passes.

Update [`docs/SECURITY.md`](docs/SECURITY.md) if a change affects authentication or
the public sharing path, and add an ADR under [`docs/adr`](docs/adr) for significant
architectural decisions.
