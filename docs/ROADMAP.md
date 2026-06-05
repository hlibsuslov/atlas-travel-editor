# Roadmap — the work backlog (the "stream")

This is the living backlog the planner agent maintains and executor agents drain
(see [ORCHESTRATION.md](./ORCHESTRATION.md)). Items are grouped into epics and
sized **S / M / L**. Each carries acceptance criteria so any agent can pick it up
and know when it's done. The non-negotiable Definition of Done for every item:

> `npm run ci` passes (typecheck · lint · format · test · build), new behavior is
> covered by tests, and user-facing strings go through i18n (all 8 locales or a
> documented English fallback).

Status legend: ☐ todo · ◐ in progress · ☑ done.

---

## Epic A — Interactivity & UX polish

- ☑ **A1 (M)** Map: click a country to cycle status; pan + zoom. _(done)_
- ☑ **A2 (S)** Editor: live country filter/search. _(done)_
- ☐ **A3 (M)** Drag-and-drop reordering of countries (keyboard-accessible).
  _Accept:_ reorder persists to the document; dnd works with keyboard; tested.
- ◐ **A4 (S)** Map: zoom in/out/reset buttons + double-click to zoom to a country.
  _Zoom in/out/reset buttons shipped in `WorldMap.tsx` (`.atlas-zoom`)._ Remaining:
  double-click a country to zoom-to-fit — split out as **A10**.
- ☐ **A5 (M)** Map ↔ editor cross-highlight: hovering a country in the editor
  highlights it on the map and vice-versa.
- ☐ **A6 (S)** Undo/redo for editor mutations (zundo middleware on the store).
  _Note:_ `useEditorStore` (`src/features/editor/store.ts`) currently has no history
  middleware; add `zundo` and wire temporal store + UI controls/shortcuts.
- ☑ **A7 (S)** Replace native `confirm()` with an accessible confirm dialog. _(done —
  `src/components/ui/ConfirmDialog.tsx` + tests; Escape/backdrop/focus handled.)_
- ☐ **A8 (M)** Empty states and skeleton loaders for map/friends/editor.
- ☐ **A9 (S)** Keyboard shortcuts (save, add country, toggle theme) + a help sheet.
- ☐ **A10 (S)** Map: double-click a country to zoom-to-fit its bounds (split from A4).
  _Accept:_ centers + scales to the geography's bounding box; reset returns to world;
  works with the existing `ZoomableGroup` controlled `position` state; tested.
- ☐ **A11 (S)** Focus trap + restore-focus for `ConfirmDialog` and `ImportModal`.
  _Accept:_ Tab/Shift+Tab stay within the dialog; focus returns to the trigger on
  close; covered by tests (extends the a11y work in G1).

## Epic B — Map intelligence

- ◐ **B1 (L)** Add ISO-3166 country codes to the domain model (optional field)
  and match the map by code, not name. _Foundation shipped:_ `src/domain/countries.ts`
  holds the ISO-3166 alpha-2 list and the picker stores canonical English names that
  match the atlas exactly (`codeForEnglishName`). Remaining: persist an optional `code`
  field on `Country` in the schema and match the atlas by code rather than name so
  free-text/renamed entries still resolve — split out as **B6**.
- ☐ **B2 (M)** Localized country names on the map (per active i18n locale).
  _Note:_ the picker localizes via `Intl.DisplayNames`, but `WorldMap.tsx` tooltips
  still render the raw English geography name — localize the hover tip + legend.
- ☐ **B3 (M)** Choropleth intensity by number of visit-years; year time-slider to
  animate the map over time. _`computeStats` already returns `yearTrips` per year —
  build the slider/choropleth on top of it._
- ☑ **B4 (S)** Stats panel: % of world visited, continents covered, streaks. _(done —
  `src/domain/stats.ts` `computeStats` + `computeCoverage`; surfaced on dashboard/map.)_
- ☐ **B5 (M)** City markers (lat/long) layered on the map with clustering.
- ☐ **B6 (M)** Match the atlas by ISO code, not name (split from B1). _Accept:_ add
  optional `code` to the `Country` schema (migration-free), prefer code over the
  canonical-name path in `buildStatusMap`/`statusForGeography`, keep name fallback
  for legacy docs, and add tests for renamed/aliased countries.

## Epic C — Social / friends

- ☐ **C1 (L)** Username/profile system (`profiles` table + RLS) so friends are
  found by handle, not raw share code.
- ☐ **C2 (M)** Friends feed: recent changes from people you follow.
- ☐ **C3 (M)** Compare maps: overlay two users to see shared/!shared countries.
- ☐ **C4 (S)** Friend request/accept flow (mutual follow) instead of open follow.
- ☐ **C5 (S)** Public profile page at `/u/:handle` with map + stats.

## Epic D — Data & persistence

- ☐ **D1 (M)** Optimistic-concurrency save via `save_travel(data, version)` RPC;
  surface conflicts and offer merge/overwrite.
- ☐ **D2 (S)** Autosave (debounced) toggle, building on D1.
- ☐ **D3 (M)** Edit history / audit log (uses the existing `version` column).
- ☐ **D4 (S)** Export to GeoJSON and PNG snapshot of the map.
- ☐ **D5 (M)** Conflict-free offline edits queue that syncs on reconnect.

## Epic E — Internationalization

- ☐ **E1 (M)** ICU pluralization for all counters (cities/countries/errors) across
  locales. _Accept:_ correct plural forms in ru/uk/pl etc.
- ☐ **E2 (S)** Add locales: pl, zh, ja, tr, ar (with RTL support for ar).
- ☐ **E3 (S)** Locale-aware number/date formatting via `Intl`.
- ☐ **E4 (S)** A `lint:i18n` script that fails CI on missing/extra keys per locale.
  _Note:_ all 8 locale JSONs exist under `src/i18n/locales/` but nothing verifies key
  parity; add a `scripts/lint-i18n.mjs` that diffs every locale against `en.json` and
  wire it into the `ci` npm script + the GitHub workflow.

## Epic F — Quality, infra, observability

- ☐ **F1 (M)** Playwright E2E: login (demo) → edit → map → share smoke flow, run
  in CI against a preview build. _Note:_ no Playwright dep/config yet; add
  `@playwright/test`, a `test:e2e` script, and a CI job that builds + previews first.
- ◐ **F2 (S)** Coverage gate in CI (e.g. 80% on `src/domain` and stores).
  _CI already runs `test:coverage` and uploads the report (`.github/workflows/ci.yml`),
  but there is no enforced threshold — add `coverage.thresholds` to the Vitest config
  so the run fails below target._
- ☐ **F3 (S)** Bundle-size budget check in CI.
- ◐ **F4 (S)** Sentry source-map upload on release; release tagging. _Runtime wired
  (`@sentry/react` + `src/lib/observability.ts`); remaining: build-time source-map
  upload + release tagging in the deploy/CI pipeline._
- ☐ **F5 (S)** Lighthouse CI for performance/a11y/PWA budgets.
- ☐ **F6 (S)** Storybook for the component library.
- ☐ **F7 (S)** Add `format:check` to the local `ci` npm script. _Note:_ the GitHub
  workflow runs the format check, but `npm run ci` (the documented Definition of Done)
  does not, so a contributor can pass `ci` locally and still fail CI on formatting.
- ☐ **F8 (S)** Remove the stale `Travel Editor/` legacy directory (the pre-migration
  `.jsx` prototype) so it does not get linted/searched or confuse contributors.
  _Confirmed still present_ (`Travel Editor/Travel Editor.html`, `app/*.jsx`,
  `tweaks-panel.jsx`) after the React migration. (The root `index.html` is now the
  live Vite entry — the 721-line standalone prototype that used to live there has been
  removed, so this dir is the last copy of the dead code and is safe to delete.)
- ☐ **F11 (S)** Verify the slimmed-down root `index.html` is complete after dropping the
  721-line inline prototype. _Note:_ the entry now defers everything to `/src/main.tsx`
  and `public/favicon.svg` (confirmed present). _Accept:_ confirm `npm run build` emits a
  working `dist/index.html`, no SPA fallback / meta (OG/Twitter card, canonical URL) was
  lost in the deletion, and add a smoke check that the app mounts into `#root`.
- ☐ **F12 (S)** Add an ESLint ignore + tsconfig exclude (or outright delete via F8) for
  `Travel Editor/` so the orphaned `.jsx` prototype can never be picked up by lint,
  typecheck, the Vite build glob, or content search now that nothing imports it.
  _Accept:_ `eslint .` and `tsc --noEmit` skip the dir; CI green; documented in CLAUDE.md.
- ☐ **F9 (S)** Real PWA icons for installability. _Note:_ `vite.config.ts` ships only a
  single `favicon.svg` with `purpose: 'any maskable'`, which fails the Lighthouse/PWA
  installability audit (F5) on most platforms. _Accept:_ add 192×192 and 512×512 PNG icons
  plus a dedicated maskable icon, reference them in the `VitePWA` manifest, and verify the
  generated `manifest.webmanifest` passes the installability checks.
- ☐ **F10 (S)** Validate ALL `VITE_` runtime flags in `src/lib/env.ts`. _Note:_ the Zod
  schema only checks `VITE_SUPABASE_*` and `VITE_APP_URL`; `VITE_SENTRY_DSN` and the
  `VITE_DEMO_AUTH`/`VITE_DEMO_LOGIN`/`VITE_DEMO_PASSWORD` flags are read ad-hoc elsewhere
  (`observability.ts`, `auth/demo.ts`) and bypass the fail-loud startup check. _Accept:_
  add them to `envSchema` (optional, with sane defaults), export typed values from `env`,
  and have the demo/observability modules consume `env` instead of raw `import.meta.env`.

## Epic G — Accessibility

- ☐ **G1 (M)** Full keyboard nav + focus trap in modals; audit with axe.
- ☐ **G2 (S)** Respect `prefers-reduced-motion`; ensure AA contrast in both themes.
- ☐ **G3 (S)** Screen-reader labels for the map regions and legend.

---

## How items are prioritized

The planner orders by **(user value × confidence) ÷ size**, keeping epics
balanced so the product improves on multiple axes each cycle. Newly discovered
work (from the completeness critic, bug reports, or failing checks) is inserted
here, which is what makes the stream continuous.
