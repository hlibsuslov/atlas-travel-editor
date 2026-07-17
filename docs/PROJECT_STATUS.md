# Project status

This page answers “what works today?” It is intentionally more concrete than the
product plan and less speculative than the roadmap.

Last code audit: **2026-07-16**, against `main` at
`ace2d0bdfcfe5edca7b5773fa6c8add4776e0377`.

## Production surfaces

| Surface | Status | Notes |
| --- | --- | --- |
| Canonical web app | Live | [atlas-travel-editor.vercel.app](https://atlas-travel-editor.vercel.app) |
| Vercel previews | Active | Created from Git branches/PRs; currently protected by Vercel authentication |
| Atlas Server | Shipped, not centrally hosted | Users deploy it separately with Docker |
| GitHub Pages | Optional/manual | Workflow exists, but repository Pages must be enabled first |

The canonical Vercel deployment is the **static local-first frontend**. It does
not imply that an Atlas Server is available.

## Shipped

### Local-first application

- Account-free startup with IndexedDB as the default persistence backend.
- Installable PWA with generated service worker and offline application shell.
- Import/export of the portable JSON document.
- Local-file storage through the File System Access API on supporting browsers,
  with download/import fallback elsewhere.
- Debounced global autosave, page-hide flush, save status, and a bounded 50-step
  undo/redo history.

### Travel model and editing

- Countries with visited, lived, birthplace, and capital-visit states.
- Country timelines in `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, and `YYYY-YYYY`
  forms.
- Cities with visited years.
- Stays/diary entries with place, country, city, dates, notes, and integer
  minor-unit costs by currency.
- Validated JSON preview, list import/merge, sample data, country filtering, and
  pointer/keyboard reordering.

### Map and statistics

- Interactive world map with click cycling, status brushes, precise selection,
  pan/zoom, zoom-to-fit, coverage reporting, and unmatched-name diagnostics.
- PNG map export with multiple aspect ratios.
- World/continent progress, milestones, yearly activity, streaks, city counts,
  and budget summaries.
- Eight bundled locales: English, German, Spanish, French, Italian, Portuguese,
  Russian, and Ukrainian.

### Optional Atlas Server

- Email/password accounts backed by scrypt password hashes.
- Opaque bearer sessions stored as SHA-256 hashes with a 30-day expiry.
- One SQLite-backed document per user with optimistic version checks.
- Private, unlisted, and public visibility; revocable share slugs.
- Public maps by slug and public profile/map reads by handle.
- Directed follows, mutual friends, follower count, discovery, and activity feed.
- Signup gating and configurable CORS.

### Engineering

- Strict TypeScript, ESLint, Prettier, Vitest, Testing Library, and Node API tests.
- Client/server domain drift guard and locale completeness guard.
- CI, CodeQL, Dependabot, Docker images, Vercel configuration, and deployment
  smoke checks.

## Storage readiness

| Provider | Selectable | Auth | Sharing | Concurrency | Reality |
| --- | --- | --- | --- | --- | --- |
| IndexedDB | yes | no | no | token | Default and fully supported |
| Local file | yes | no | no | none | Direct handle on Chromium-family browsers; fallback elsewhere |
| Atlas Server | yes | yes | yes | token | Fully implemented; requires a separately deployed server |
| GitHub | no | varies | no | planned | Placeholder adapter only |
| WebDAV | no | varies | no | planned | Placeholder adapter only |
| Google Drive | no | yes | no | planned | Placeholder adapter only |
| Dropbox | no | yes | no | planned | Placeholder adapter only |

## Known limitations

- A stale Atlas Server write is detected and carries the remote document, but
  there is no interactive keep-mine/take-theirs/merge dialog yet.
- A future envelope version is not yet rejected explicitly. The current reader is
  backward-compatible with bare/v1 data and schema v2; future schema work must add
  a deliberate migration or rejection path before shipping.
- Server bearer tokens are stored in browser `localStorage`; the CSP and
  no-third-party-script posture reduce exposure, but an XSS would still be
  sensitive.
- The Atlas Server has no email verification, password reset, session-management
  UI, rate limiting, or built-in TLS. It is appropriate for controlled
  self-hosting, not an unreviewed public multi-tenant service.
- SQLite backup/restore is an operator responsibility.
- The app does not provide multi-document accounts or real-time collaboration.
- Map matching still primarily relies on canonical English names; persisted ISO
  country codes remain roadmap work.
- Production dependency audit currently reports the inherited
  `react-simple-maps -> d3-zoom -> d3-color` advisory chain. Map colors are
  application-controlled, but replacing/upgrading that chain remains maintenance
  work.

## Sources of truth

- Behavior and types: `src/` and `server/src/`.
- Data contract: [DATA_MODEL.md](DATA_MODEL.md) and `src/domain/schema.ts`.
- Deployment: [DEPLOYMENT.md](DEPLOYMENT.md).
- Security claims: [SECURITY.md](SECURITY.md).
- Priorities: [ROADMAP.md](ROADMAP.md).

If a status claim conflicts with executable code or a test, code plus tests win
and this page should be corrected in the same change.
