# Roadmap

Living backlog for work that is not fully shipped. Current capability truth lives
in [PROJECT_STATUS.md](PROJECT_STATUS.md); this file combines completed foundations
with their remaining acceptance work.

Last reconciled with code: **2026-07-16**.

Legend: ☑ shipped · ◐ partial/foundation · ☐ planned. Sizes: S / M / L.

Every completed item must keep `npm run ci` and
`npm --prefix server run ci` green, add risk-proportionate tests, translate
user-facing strings, and update the relevant reference docs.

## A — Editor and interaction

- ☑ **A1 (M) Interactive map editing** — click cycle, status brushes, precise
  menu, erase, pan/zoom, reset, and double-click zoom-to-fit.
- ☑ **A2 (S) Country filtering** — local editor search.
- ☑ **A3 (M) Accessible reordering** — pointer and keyboard country ordering with
  persisted array order.
- ☑ **A4 (S) Document undo/redo** — bounded history, toolbar controls, and
  Ctrl/Cmd-Z behavior outside text inputs.
- ☑ **A5 (M) Empty/loading states** — editor/map empty states and friend-map
  skeleton.
- ☐ **A6 (M) Map/editor cross-highlight** — hover/focus a country in one surface
  and identify it in the other.
- ☐ **A7 (S) Shortcut help** — save/add/theme shortcuts plus a discoverable help
  sheet without overriding native text editing.
- ☐ **A8 (M) Multi-select/bulk edits** — apply status/timeline operations to
  several countries with one undo step.

## B — Geography and map intelligence

- ◐ **B1 (L) Persist ISO 3166 codes** — country catalog and localized picker
  exist; add an optional code to the schema, normalization, import, and map match.
- ☐ **B2 (M) Localized map names** — tooltips/accessible geography labels should
  follow the active locale while persistence retains stable identity.
- ☐ **B3 (M) Time map** — choropleth or time slider using existing year stats.
- ☐ **B4 (M) City coordinates** — optional coordinates and clustered markers.
- ☐ **B5 (M) Sovereignty policy UI** — make map boundary/counting choices
  transparent without rewriting user data.

## C — Social experience

- ☑ **C1 (L) Profiles and handles** — editable profile, handle availability,
  public `/u/:handle`.
- ☑ **C2 (M) Directed follows and feed** — follow by handle/slug, discovery,
  follower count, feed, and mutual friends.
- ☐ **C3 (M) Compare maps** — explicit two-map overlap/difference view.
- ☐ **C4 (S) Friend requests** — optional accept/reject workflow rather than
  deriving friendship only from mutual follows.
- ☐ **C5 (M) Privacy controls UX** — expose private/unlisted/public explicitly;
  the current primary toggle maps only public/private.
- ☐ **C6 (S) Block/report controls** — required before broad public multi-tenant
  operation.

## D — Data and synchronization

- ◐ **D1 (M) Conflict resolution** — version checks and remote payload are
  shipped; add keep-mine, take-theirs, and deterministic merge UI.
- ☑ **D2 (S) Global autosave** — debounce, route-independent mount, validation
  gate, and page-hide flush.
- ☐ **D3 (M) Edit audit/history** — server-side version history and restore.
- ◐ **D4 (S) Rich export** — JSON and PNG are shipped; GeoJSON remains.
- ☐ **D5 (L) Offline operation queue** — ordered remote mutation replay with
  authentication and conflict semantics.
- ☐ **D6 (M) Future-envelope safety** — reject unsupported newer schema versions
  before version 3 to prevent unknown-field loss.
- ☐ **D7 (M) Multi-document support** — only if product direction changes; the
  current contract intentionally has one document per provider/user.

## E — Storage providers

- ☑ **E1 (M) IndexedDB provider** — default, versioned, tested.
- ☑ **E2 (M) Local-file provider** — File System Access API plus fallback.
- ☑ **E3 (L) Atlas Server provider** — auth, sharing, token concurrency.
- ☐ **E4 (L) WebDAV provider** — credentials, ETag concurrency, CORS guidance.
- ☐ **E5 (L) GitHub provider** — least-privilege auth, blob-SHA concurrency.
- ☐ **E6 (L) Google Drive provider** — user-owned OAuth client and revision
  checks.
- ☐ **E7 (L) Dropbox provider** — user-owned OAuth client and rev checks.

No placeholder provider becomes selectable until its complete connection,
load/save, failure, conflict, disconnect, and documentation flow is tested.

## F — Internationalization and accessibility

- ☑ **F1 (S) Eight locale bundles** — en/de/es/fr/it/pt/ru/uk.
- ☑ **F2 (S) Locale completeness guard** — CI key parity against English.
- ☐ **F3 (M) ICU-quality plurals** — especially Slavic counters.
- ☐ **F4 (M) More locales** — Polish, Chinese, Japanese, Turkish, Arabic; Arabic
  includes RTL layout acceptance.
- ◐ **F5 (S) Locale-aware values** — money uses `Intl`; audit every displayed
  date/number.
- ◐ **F6 (M) Modal accessibility** — focus trap/restore and keyboard semantics
  exist; run a full axe/manual screen-reader audit.
- ◐ **F7 (S) Reduced motion/contrast** — reduced-motion hooks/styles exist; keep
  a measured AA contrast matrix for both themes.
- ☑ **F8 (S) Map screen-reader labels** — interactive regions and legend have
  tested accessible names.

## G — Quality and security

- ☐ **G1 (M) Playwright E2E** — local-first edit/reload/import plus two-user
  server sharing flow in CI.
- ◐ **G2 (S) Coverage policy** — coverage artifacts exist; add meaningful
  thresholds for domain/storage/server rather than a global vanity number.
- ☐ **G3 (S) Bundle budgets** — initial JS/CSS and lazy map chunk limits.
- ◐ **G4 (S) Sentry release integration** — runtime hook exists; add source-map
  upload, release id, and privacy review.
- ☐ **G5 (S) Lighthouse budgets** — performance, accessibility, best-practice,
  and PWA checks.
- ☐ **G6 (M) Component workbench** — Storybook or a lighter equivalent if the
  reusable UI surface justifies it.
- ☑ **G7 (S) Honest local CI gate** — format, docs, locales, tests, and build match
  GitHub CI.
- ☑ **G8 (S) Build/deployment smoke** — mount, routes, PWA, assets, headers, and
  provenance.
- ☐ **G9 (M) Map dependency advisory** — remove or safely upgrade the inherited
  `d3-color` advisory chain without regressing zoom/map behavior.
- ☐ **G10 (M) Server abuse controls** — rate limiting, request-body limits,
  structured audit logs, and deployment guidance.
- ☐ **G11 (L) Account lifecycle** — email verification, password reset, session
  listing/revocation, and optional MFA before public multi-tenant claims.

## H — Deployment and operations

- ☑ **H1 (S) Canonical Vercel contract** — static frontend, `main` Production,
  branch previews, SPA rewrites, headers, immutable assets.
- ☑ **H2 (S) Build provenance** — public non-secret `build-info.json`.
- ☑ **H3 (S) Production monitoring** — scheduled black-box GitHub smoke.
- ☑ **H4 (S) Pages deconfliction** — optional manual mirror, no automatic false
  production failure.
- ◐ **H5 (M) Server runbook** — backup/restore/upgrade documented; automate and
  regularly test encrypted off-host backups.
- ☐ **H6 (M) Release process** — tags, changelog promotion, artifacts, rollback
  evidence, and release notes.
- ☐ **H7 (S) Custom domain** — only if product branding requires it; preserve the
  canonical URL and redirects.

## Prioritization

Use **user value × risk reduction × confidence ÷ effort**. Compatibility,
data-loss, privacy, and broken-production work outranks cosmetic expansion.

When a partial item is completed, update its acceptance evidence here and move
the user-visible outcome into `PROJECT_STATUS.md`/the changelog.
