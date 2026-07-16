# Atlas documentation

Maintained project knowledge for Atlas, the open-source local-first travel map and
optional self-hosted social server.

## Start here

| Question | Document |
| --- | --- |
| What is Atlas and how do I run it? | [Repository README](../README.md) |
| What works today? | [PROJECT_STATUS.md](PROJECT_STATUS.md) |
| How does it fit together? | [ARCHITECTURE.md](ARCHITECTURE.md) |
| What exactly is stored? | [DATA_MODEL.md](DATA_MODEL.md) |
| How do I contribute code? | [DEVELOPMENT.md](DEVELOPMENT.md) |
| How is it tested? | [TESTING.md](TESTING.md) |
| How does Vercel deployment work? | [DEPLOYMENT.md](DEPLOYMENT.md) |
| How do I self-host? | [SELF_HOSTING.md](SELF_HOSTING.md) |
| How do I operate/backup the server? | [SERVER_OPERATIONS.md](SERVER_OPERATIONS.md) |
| What is the security model? | [SECURITY.md](SECURITY.md) |
| What does a project term mean? | [GLOSSARY.md](GLOSSARY.md) |

## Product direction

- [PRODUCT_PLAN.md](PRODUCT_PLAN.md) — product and engineering north star.
- [ROADMAP.md](ROADMAP.md) — living backlog and acceptance criteria.
- [CHANGELOG.md](../CHANGELOG.md) — released and unreleased user-visible changes.

Status claims belong in `PROJECT_STATUS.md`; proposed work belongs in the
roadmap. This separation prevents plans from being mistaken for shipped behavior.

## Decisions and reference

- [ADRs](adr/README.md) — why consequential architecture choices were made.
- [Atlas Server API](../server/README.md) — configuration and endpoint inventory.
- [Brand system](brand/BRAND.md) — identity, palette, typography, and assets.
- [Deployment audit (2026-07-16)](DEPLOYMENT_AUDIT_2026-07-16.md) — dated evidence
  from the Vercel/GitHub review.

## Historical context

- [STRATEGY.md](STRATEGY.md) is superseded by the product plan.
- Superseded ADRs retain the original architecture for traceability.
- [ORCHESTRATION.md](ORCHESTRATION.md) describes an optional agent planning model,
  not an application runtime component.

Historical documents are not sources of current configuration or feature status.

## Documentation maintenance

When behavior changes, update the nearest reference page in the same pull request.
Run:

```bash
npm run check:docs
npm run format:check
```

The docs check rejects broken repository-local links and language that implies the
retired backend is still required. Code and executable tests win when a document
has drifted.
