# Architecture Decision Records

ADRs record consequential decisions and their trade-offs. They are append-only:
superseded records remain available with an explicit banner.

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-stack-and-architecture.md) | Superseded | Original hosted stack and architecture |
| [0002](0002-domain-model-single-source-of-truth.md) | Accepted | Zod domain model as source of truth |
| [0003](0003-sharing-via-security-definer.md) | Superseded | Historical public-sharing implementation |
| [0004](0004-i18n-map-and-social.md) | Accepted | i18n, map, theming, and social choices |
| [0005](0005-relational-normalization.md) | Superseded | Historical relational travel model |
| [0006](0006-local-first-storage-and-atlas-server.md) | Accepted | Local-first storage seam and optional server |
| [0007](0007-static-frontend-deployment.md) | Accepted | Static Vercel frontend and separate stateful server |

## Adding an ADR

Use the next number and include:

- status and date;
- context/problem;
- decision;
- positive and negative consequences;
- alternatives considered;
- supersession links when replacing an earlier decision.

ADRs explain why. Current operational instructions belong in the maintained
reference docs.
