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
- **Friends:** modeled as a private **directed follow graph**. A signed-in user
  follows someone **by handle** (or by pasting their `/share/<slug>` link), and the
  edge is private to the follower. This is served by the optional Atlas Server;
  with no server connected, all social UI is hidden. (Originally this was a private
  list of followed share slugs (`friend_links`); follow-by-handle replaced it — see
  [`docs/PRODUCT_PLAN.md`](../PRODUCT_PLAN.md).)
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
- Friends are now identified by **handle** (a username/profile system), served by
  the Atlas Server; mutual follows form the "friends" set. An explicit
  friend-request handshake and a `friends`-only visibility tier remain future work.
