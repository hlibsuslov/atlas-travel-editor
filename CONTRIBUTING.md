# Contributing

Thanks for contributing! This guide keeps changes consistent and the main branch
releasable at all times.

## Getting started

```bash
nvm use            # Node 20 (see .nvmrc)
npm install
cp .env.example .env
npm run dev
```

## Workflow

1. Branch from `main` (e.g. `feat/share-qr`, `fix/timeline-range`).
2. Make the change with tests.
3. Run the full gate before pushing:
   ```bash
   npm run ci      # typecheck · lint · format:check · test · build
   ```
4. Open a PR using the template. CI (and CodeQL) must be green to merge.

## Conventions

- **Domain first.** The data model lives in `src/domain` as Zod schemas — the
  single source of truth. Change the schema there; types, validation, and the DB
  shape follow. Don't hand-roll parallel types or ad-hoc validation.
- **Feature slices.** Code is organized by feature (`src/features/<name>`), each
  owning its UI, state, and data access.
- **Type safety.** TypeScript is strict (incl. `noUncheckedIndexedAccess`). No
  `any`; prefer `unknown` + narrowing. Imports of types use `import type`.
- **Tests.** Pure/domain logic gets unit tests; components get Testing Library
  tests; the data layer is tested against a mocked Supabase client.
- **Commits.** Conventional Commits style is encouraged
  (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).

## Database changes

Add a new file under `supabase/migrations` (never edit an applied migration).
After changing the schema, regenerate types:

```bash
supabase gen types typescript --linked > src/lib/database.types.ts
```

Update `docs/SECURITY.md` if a change affects RLS or the sharing path, and add an
ADR under `docs/adr` for significant architectural decisions.
