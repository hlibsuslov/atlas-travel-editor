/**
 * Atlas logomark — the compass rose in a double ring.
 *
 * This is the single source of truth for the brand glyph. Geometry is ported
 * 1:1 from the approved brand kit (docs/brand/atlas-brand-assets.html): an
 * outer ring, a lighter inner ring, and a faint-filled needle "kite" centred
 * inside. Everything is one self-contained SVG so the same vector drives the
 * top bar, login art, favicon, app icons, avatar and the social card.
 *
 * The kit derives proportions from the outer diameter:
 *   outer border  = size * 0.038   inner ring   = size * 0.022
 *   inner inset   = size * 0.15    needle glyph = size * 0.52
 * Those ratios are reproduced below against a fixed 64-unit viewBox so callers
 * only pass a pixel `size`.
 */

const VB = 64; // viewBox is always 0 0 64 64; `size` scales the rendered px.
const C = VB / 2; // centre

// Outer ring: stroke centreline sits half a stroke-width inside the edge.
const OUTER_SW = VB * 0.038; // ≈ 2.43
const OUTER_R = C - OUTER_SW / 2 - 0.4; // small extra margin to avoid AA clip

// Inner ring: positioned at the kit's 15% inset, with its own thin stroke.
const INNER_SW = VB * 0.022; // ≈ 1.41
const INNER_R = C - VB * 0.15 - INNER_SW / 2; // ≈ 21.7

// Needle: the kit draws a 24-unit "kite" path scaled to 52% of the diameter
// and centred. We keep the path in its native 24-unit space and place it with
// a transform so the 1.6 stroke-width scales exactly like the kit's glyph.
const NEEDLE_PATH = 'M16.2 7.8l-2.4 5.6-5.6 2.4 2.4-5.6 5.6-2.4Z';
const NEEDLE_SCALE = (VB * 0.52) / 24; // glyph px ÷ path viewBox
const NEEDLE_OFFSET = (VB - 24 * NEEDLE_SCALE) / 2; // centre the scaled glyph

export interface BrandMarkProps {
  /** Rendered diameter in px. Default 40 (top-bar size). */
  size?: number;
  /** Outer ring + needle colour. Default `currentColor` so it inherits text colour. */
  color?: string;
  /** Inner ring colour. Default the design-system hairline. */
  ring?: string;
  /**
   * Accessible label. When provided the mark is exposed as an image with this
   * name; when omitted it is decorative (`aria-hidden`) — use it next to a
   * visible wordmark.
   */
  title?: string;
  className?: string;
}

export function BrandMark({
  size = 40,
  color = 'currentColor',
  ring = 'var(--line-strong)',
  title,
  className,
}: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VB} ${VB}`}
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {title ? <title>{title}</title> : null}
      <circle cx={C} cy={C} r={OUTER_R} stroke={color} strokeWidth={OUTER_SW} />
      <circle cx={C} cy={C} r={INNER_R} stroke={ring} strokeWidth={INNER_SW} />
      <g
        transform={`translate(${NEEDLE_OFFSET} ${NEEDLE_OFFSET}) scale(${NEEDLE_SCALE})`}
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d={NEEDLE_PATH} fill={color} fillOpacity={0.14} />
      </g>
    </svg>
  );
}
