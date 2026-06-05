# ADR 0004: Internationalization, world map, and social features

- **Status:** Accepted
- **Date:** 2026-06-05
- **Context owners:** Product / Principal Engineer

## Context

After the production rebuild, the product needed to grow into a richer,
consumer-facing app: many languages, a visual world map, a proper themeable UI,
and lightweight social features (viewing friends' maps).

## Decisions

- **i18n:** `i18next` + `react-i18next` with one JSON file per locale and
  browser-language detection. Eight locales ship initially; adding one is a
  single file plus a registry entry. `useSuspense: false` keeps rendering
  synchronous since resources are bundled.
- **UI system:** Tailwind CSS with **preflight disabled**, composed on top of
  the existing hand-written design tokens rather than replacing them. Light/dark
  themes are driven entirely by CSS variables overridden under `html.dark`, so
  both the legacy editor CSS and new Tailwind pages theme with zero per-component
  work.
- **World map:** `react-simple-maps` + the `world-atlas` TopoJSON. Free-text
  country names are matched to geographies through a pure, tested
  `canonical()` + alias layer; status is ranked (birthplace > lived > visited >
  capital). The map is code-split so the ~210 KB atlas never touches the editor's
  initial load.
- **Friends:** modeled as a private list of followed public share slugs
  (`friend_links`), reusing the existing public-sharing function. No new public
  data surface and no username/profile system required yet.
- **PWA & observability:** `vite-plugin-pwa` (offline + installable) and an
  optional Sentry hook that is a no-op unless `VITE_SENTRY_DSN` is set.

## Consequences

**Positive**

- New locales, themes, and map countries are cheap to add.
- Social features introduced **zero** new public data exposure.
- Initial bundle stays lean via route-level code splitting.

**Negative / future work**

- Country matching is name-based; a country-code field on the model would make it
  exact (and enable localized country names on the map).
- Plural forms use simple count interpolation rather than full ICU/i18next
  pluralization — acceptable for current strings, revisit for counters.
- Friends are identified by share code; a username/profile system would be a
  friendlier next step.
