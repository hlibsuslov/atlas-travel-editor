# ADR 0002: Domain model as a single source of truth

- **Status:** Accepted
- **Date:** 2026-06-05
- **Context owners:** Principal Engineer

## Context

The MVP duplicated knowledge of the data shape across hand-rolled validators
(`validateState`, `isValidTimelineString`), normalizers (`normalizeAll`,
`normalizeCountry`), and the implicit shape produced by the UI. These drifted
easily and could not be reused on a server.

## Decision

Define the model once with **Zod** in `src/domain/schema.ts` and derive
everything from it:

- TypeScript types via `z.infer` (no parallel interfaces).
- Strict validation (`validateTravelData`) returning flat, path-prefixed errors,
  reused by the UI and by the write path before persistence.
- Lenient normalization (`normalize.ts`) for untrusted input that never throws.

Domain code imports nothing from React or a persistence provider. The optional
Atlas Server vendors the validation subset and checks drift in CI.

## Consequences

**Positive**

- One place to change the model; types, validation, and tests follow.
- The same validation runs client-side and on Atlas Server writes for end-to-end
  enforcement.
- The pure, dependency-free domain is exhaustively unit-tested.

**Negative**

- A small runtime cost for Zod parsing (negligible at this data size).
- Contributors must update the schema rather than ad-hoc shape changes — a
  deliberate guardrail.

## Notes

Strict validation and lenient normalization are intentionally separate: imports
and legacy data should degrade gracefully (normalize), while persistence must be
correct (validate).
