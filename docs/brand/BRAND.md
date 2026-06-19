# Atlas — brand & assets

Atlas is the personal travel-cartography app: every country you were born in,
have lived in, or visited, drawn as one map. The identity is quiet and
editorial — paper and ink, a serif display face, and a single compass mark.

Everything below is **drawn from the product's live design system** (the CSS
custom properties in [`src/index.css`](../../src/index.css)) so the brand and
the running app never drift apart. The full interactive identity sheet — logo
lockups, mark, favicon, avatar, social card and palette, with the brand fonts
embedded — lives next to this file:

- [`atlas-brand-assets.html`](./atlas-brand-assets.html) — open in a browser.

## Logomark — the compass

The mark is a compass rose in a double ring with a faint-filled needle "kite".
It is the single most important asset and has exactly **one** implementation:

- [`src/components/brand/BrandMark.tsx`](../../src/components/brand/BrandMark.tsx)

That component is the source of truth for the glyph geometry. The static assets
in [`public/`](../../public) (favicon, maskable icon, app icons) reproduce the
same path and proportions so the mark is identical everywhere.

```tsx
import { BrandMark } from '@/components/brand/BrandMark';

<BrandMark size={40} />                                   {/* ink on light */}
<BrandMark size={40} color="#f3efe6" ring="rgba(243,239,230,.4)" />  {/* reversed */}
```

| Prop    | Default          | Notes                                            |
| ------- | ---------------- | ------------------------------------------------ |
| `size`  | `40`             | rendered diameter in px                          |
| `color` | `currentColor`   | outer ring + needle — inherits text colour       |
| `ring`  | `var(--line-strong)` | inner hairline ring                          |
| `title` | —                | sets an accessible name; omit when paired with the visible wordmark |

**Usage**

- Default to ink-on-light. Reverse to paper (`#f3efe6`) on ink or accent grounds.
- Keep clearspace equal to the inner-ring gap on all sides; never let the needle
  touch the outer circle.
- Don't recolour the needle, add a drop shadow, or stretch the circle.
- At 16 px and below, render the needle alone (the rings simplify away) — this is
  what the favicon/app-icon tile does.

The wordmark is **Atlas** set in Newsreader (display serif) with the tagline
**Personal travel cartography** in JetBrains Mono, all-caps, tracked. The app
reads both from i18n (`app.name`, `app.tagline`).

## Palette

Tokens are defined once in [`src/index.css`](../../src/index.css) `:root`.

| Token             | Hex       | Role                              |
| ----------------- | --------- | --------------------------------- |
| `--paper`         | `#f3efe6` | page ground                       |
| `--panel`         | `#fbfaf6` | cards / surfaces                  |
| `--panel-2`       | `#f0ebe0` | sunken surfaces                   |
| `--ink`           | `#211f1a` | primary text, reverse grounds     |
| `--ink-soft`      | `#6e695b` | secondary text                    |
| `--ink-faint`     | `#9a9485` | tertiary / mono labels            |
| `--line`          | `#e4ddcd` | hairlines                         |
| `--line-strong`   | `#d3cab6` | stronger borders, inner ring      |
| `--accent`        | `#2f6df0` | primary action, links, avatar     |
| `--c-birthplace`  | `#e8943a` | status — birthplace               |
| `--c-lived`       | `#2f6df0` | status — lived                    |
| `--c-visited`     | `#1f9d6b` | status — visited                  |
| `--c-capital`     | `#9fc2f2` | status — capital                  |
| `--c-danger`      | `#b4452f` | destructive / errors              |

## Typography

Loaded from Google Fonts in [`index.html`](../../index.html):

- **Hanken Grotesk** — UI / body (`--font-ui`)
- **Newsreader** — display serif, used italic for emphasis (`--font-display`)
- **JetBrains Mono** — labels, coordinates, code, tabular numbers (`--font-mono`)

## Icons & social card (in `public/`)

| File                   | Size       | Purpose                                            |
| ---------------------- | ---------- | -------------------------------------------------- |
| `favicon.svg`          | vector     | browser tab + PWA `any` (rounded ink tile)         |
| `maskable-icon.svg`    | vector     | PWA `maskable` (full-bleed ink, safe-zone compass) |
| `maskable-512.png`     | 512×512    | raster `any maskable` fallback for launchers       |
| `apple-touch-icon.png` | 180×180    | iOS home-screen icon                               |
| `og-image.png`         | 1200×630   | Open Graph / Twitter social card                   |

The PWA manifest wiring lives in [`vite.config.ts`](../../vite.config.ts); the
`<link>` / `og:` / `twitter:` tags are in [`index.html`](../../index.html).

### Regenerating the raster assets

The PNGs are screenshots of HTML built from the same geometry and brand fonts as
`atlas-brand-assets.html`, rendered at exact pixel sizes:

- `og-image.png` — the 1200×630 OG card (ink ground, coordinate grid, compass +
  wordmark, serif headline, mono footer coordinates).
- `apple-touch-icon.png` / `maskable-512.png` — the compass tile.

To re-export, open `atlas-brand-assets.html`, screenshot the relevant frame at
its native resolution (the OG section exports at full 1200×630), and drop the
result back into `public/`. The SVG icons are hand-authored and edited directly.
