# Deployment runbook

Atlas has two independently deployable artifacts:

1. The static React/PWA frontend.
2. The optional stateful Atlas Server.

The canonical project deploys the frontend to Vercel. Vercel does **not** run the
SQLite server.

## Canonical production

- URL: [https://atlas-travel-editor.vercel.app](https://atlas-travel-editor.vercel.app)
- Source repository: `hlibsuslov/atlas-travel-editor`
- Production branch: `main`
- Vercel project/framework: `atlas-travel-editor` / Vite
- Build: `npm run build`
- Output: `dist/`
- Node: 22
- Required environment variables: none

An authenticated Vercel dashboard remains the source of truth for account-level
settings such as team ownership, deployment protection, custom domains, and
environment variables.

## What happens on a Git push

```text
branch or PR push
  -> GitHub Actions CI + CodeQL
  -> Vercel Git integration
       main      -> Production deployment -> canonical alias
       non-main  -> Preview deployment (currently authentication-protected)
```

GitHub Actions does not upload the Vercel build. Vercel's Git integration checks
out the commit and runs the build independently. A green Vercel status proves the
hosting build completed; it does not replace repository CI.

## Configuration contract

`vercel.json` defines:

- the Vite framework, build command, and `dist/` output;
- a catch-all rewrite to `/index.html` for `BrowserRouter`;
- Content Security Policy, HSTS, clickjacking, MIME, referrer, and permissions
  headers;
- one-year immutable caching for content-hashed `/assets/*`;
- non-immutable caching for `/build-info.json`.

`vite.config.ts` defines:

- root-path output for Vercel;
- code splitting and source maps;
- generated PWA manifest and service worker;
- public build provenance.

The generated `/build-info.json` contains only:

```json
{
  "app": "atlas",
  "version": "1.0.0",
  "commit": "full-git-sha-or-null",
  "environment": "production",
  "builtAt": "ISO-8601 timestamp"
}
```

Do not add project ids, tokens, environment values, actor email, or other secrets
to this file.

## Environment variables on Vercel

Atlas needs none for local-first production.

Optional variables are documented in `.env.example`. Remember:

- `VITE_APP_URL` should be the canonical browser origin when set.
- `VITE_SELFHOST_URL` must be an HTTPS Atlas Server for an HTTPS frontend.
- `VITE_LOCAL_ONLY=1` suppresses server behavior.
- `VITE_DEMO_AUTH` must not be enabled for normal production.
- `VITE_SENTRY_DSN` is public client configuration, not a secret.

Every `VITE_` value is compiled into browser JavaScript. Never store a private
server credential there.

Environment changes require a new deployment because Vite embeds them at build
time. A redeployment of the same Git SHA can therefore produce different asset
hashes; `build-info.json` and dashboard environment history explain provenance.

## Pre-deploy checklist

```bash
npm ci
npm run ci
npm --prefix server ci
npm --prefix server run ci
git diff --check
```

For frontend-only documentation changes, the server gate still provides cheap
evidence that shared-domain files did not drift.

Confirm:

- no `.env`, token, database, or `.vercel/` state is staged;
- current docs describe the same environment/route contract as code;
- schema changes have normalization and vendored-server updates;
- production remains useful with every optional variable unset.

## Preview acceptance

After pushing a branch:

1. Confirm the Vercel GitHub status completed successfully.
2. Open the preview and inspect the console/network panel.
3. Run:

   ```bash
   npm run smoke:deploy -- https://preview-url.example
   ```

4. Exercise the manual browser checklist in [TESTING.md](TESTING.md) for risky UI
   changes.

Vercel Authentication currently protects preview URLs, so the unauthenticated
smoke receives an SSO redirect. Use an authenticated browser, a temporary
protection exception, or the canonical public deployment for black-box checks.

## Production verification

```bash
npm run smoke:deploy -- https://atlas-travel-editor.vercel.app
curl -fsSL https://atlas-travel-editor.vercel.app/build-info.json
```

The smoke covers root HTML, SPA fallbacks, PWA files, hashed assets, caching, and
security headers. The scheduled GitHub workflow runs it daily.

Also confirm:

- the build-info commit is the intended `main` SHA;
- `/`, `/map`, `/stats`, and `/friends` render;
- a hard refresh on a nested route succeeds;
- the service worker does not keep an obsolete shell after one refresh;
- no Vercel Serverless Function is expected or present for Atlas Server routes.

## Rollback

Frontend rollback is a Vercel operation:

1. Identify the last known-good Production deployment.
2. Promote/reassign the canonical alias to it in Vercel, or revert the bad Git
   commit on `main`.
3. Run the production smoke.
4. Verify `build-info.json` points to the intended commit.
5. Record the incident/fix in the changelog or an issue.

Do not “roll back” by deleting IndexedDB or asking users to clear their data.
Static frontend rollback and user data are independent.

The Atlas Server needs its own image/database rollback process; see
[SERVER_OPERATIONS.md](SERVER_OPERATIONS.md).

## GitHub Pages

Pages is an optional mirror, not production. Its workflow is manual because Pages
is not enabled for this repository by default. Before dispatching:

1. Enable GitHub Pages with **GitHub Actions** as the source.
2. Run “Deploy to GitHub Pages”.
3. Verify assets under `/atlas-travel-editor/` and hard-refresh a nested route.

The Pages build sets `GITHUB_PAGES=true` and creates `404.html` as a SPA
fallback. Pages cannot apply `vercel.json` security headers, so it is not
security-equivalent to Vercel.

## Deploying the Atlas Server

Deploy the server on a host with persistent storage:

- use the `server/Dockerfile` or Compose service;
- persist `/data`;
- bind privately and put an HTTPS reverse proxy in front;
- set exact CORS origins;
- bootstrap accounts, then close signup if appropriate;
- back up before upgrades.

See [SELF_HOSTING.md](SELF_HOSTING.md) for topology and
[SERVER_OPERATIONS.md](SERVER_OPERATIONS.md) for operations.

## Troubleshooting

### Vercel build fails

Reproduce with `npm ci && npm run build` under Node 22. Then inspect the Vercel
build log for lockfile, Node, environment-validation, or case-sensitive path
errors.

### Nested route returns 404

Verify the deployment read `vercel.json` from the repository root and that the
catch-all rewrite is active.

### HTML loads but JavaScript fails

Check that the referenced hashed asset exists, returns JavaScript rather than the
SPA HTML, and has not been blocked by CSP. A stale service worker may need one
normal refresh after a new deployment.

### Social features are absent

This is correct for local-first mode. Connect an Atlas Server or set a valid
`VITE_SELFHOST_URL` at build time.

### Browser blocks the Atlas Server

An HTTPS page cannot call an HTTP API. Add TLS to the server and set
`ATLAS_CORS_ORIGINS` to the exact frontend origin.
