## What & why

<!-- What does this change and what problem does it solve? Link issues. -->

## How to test

<!-- Steps for a reviewer to verify locally. -->

## Checklist

- [ ] `npm run ci` passes locally (typecheck · lint · format · docs · locales · test · build)
- [ ] `npm --prefix server run ci` passes when shared domain/server code changed
- [ ] Tests added/updated for the change
- [ ] Domain model changes go through `src/domain` (schema is the source of truth)
- [ ] No secrets committed; `.env.example` updated if env contract changed
- [ ] Docs/ADR updated if architecture or security posture changed
- [ ] Deployment smoke run when hosting, routing, PWA, CSP, or build output changed
