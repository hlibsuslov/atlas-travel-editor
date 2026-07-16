# Deployment audit — 2026-07-16

This is a dated evidence snapshot, not a live status page.

## Scope

- GitHub repository metadata and deployment records.
- Canonical Vercel alias over public HTTP.
- Current `vercel.json`, Vite/PWA build, and GitHub workflows.
- Clean local frontend/server installs and gates.

No authenticated Vercel dashboard session was available, so dashboard-only
settings and private build logs were not independently inspected.

## Findings

### Vercel production

- Canonical URL returned HTTP 200.
- GitHub recorded a successful Production deployment for `main` commit
  `ace2d0bdfcfe5edca7b5773fa6c8add4776e0377`.
- `/map` returned the SPA shell with HTTP 200.
- Root and nested routes served the configured CSP, HSTS,
  `X-Content-Type-Options`, `X-Frame-Options`, Referrer Policy, and
  Permissions Policy.
- Hashed assets returned `Cache-Control: public, max-age=31536000, immutable`.
- The PWA manifest, registration script, and service worker were reachable.
- Production was public. Generated preview deployment URLs redirected to Vercel
  SSO, consistent with preview protection.

GitHub deployment history showed that the latest dependency preview on
2026-07-10 succeeded. Some earlier dependency previews failed; their exact Vercel
build errors require authenticated logs and do not affect the canonical
production alias.

### Local reproducibility

- `npm ci` completed for root and server packages.
- Frontend: 38 test files and 282 tests passed; production PWA build completed.
- Server: domain drift check, typecheck, and 21 API tests passed.
- The clean production dependency audit reported five high-severity entries in
  the inherited `react-simple-maps/d3` chain.

### GitHub Actions

The last `main` frontend CI run had failed only at Prettier: nine source files
were not formatted. Earlier steps passed. The local `npm run ci` command did not
include the format check even though project docs called it the full gate.

The Pages deployment failed with HTTP 404 because GitHub Pages was not enabled in
repository settings. This was unrelated to Vercel.

## Corrections made by this audit

- Added Prettier to the local `npm run ci` gate and formatted the baseline.
- Added a deployment smoke script and scheduled production workflow.
- Added public, non-secret `build-info.json` provenance.
- Made Pages manual/optional instead of a failing parallel production channel.
- Aligned root tooling and builds on Node 22 and refreshed Actions majors.
- Added the server package to Dependabot.
- Documented the frontend/server deployment split, verification, and rollback.

## Acceptance after publication

After the audit commit reaches `main`:

1. Vercel Production status must be successful.
2. `build-info.json` must show that commit and `environment: production`.
3. `npm run smoke:deploy -- https://atlas-travel-editor.vercel.app` must pass.
4. GitHub CI and CodeQL must be green.
5. No automatic Pages failure should be created.
