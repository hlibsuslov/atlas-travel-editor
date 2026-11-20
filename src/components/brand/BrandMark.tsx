/**
 * Atlas logomark: a globe on a navy tile, crossed by one flight arc that ends
 * at a destination dot. The arc and dot use the gate-yellow that marks "you are
 * here" across the app; the globe lines carry the record (meridian + equator).
 *
 * One self-contained SVG on a fixed 64-unit viewBox; callers pass a pixel
 * `size`. public/favicon.svg mirrors this geometry.
 */

export interface BrandMarkProps {
  /** Rendered size in px. Default 32 (top-bar size). */
  size?: number;
  /** Tile colour. Default the navy band token. */
  tile?: string;
  /**
   * Accessible label. When provided the mark is exposed as an image with this
   * name; when omitted it is decorative (`aria-hidden`), for use next to a
   * visible wordmark.
   */
  title?: string;
  className?: string;
}

export function BrandMark({ size = 32, tile = 'var(--band)', title, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {title ? <title>{title}</title> : null}
      <rect width="64" height="64" rx="16" fill={tile} />
      <g stroke="#ffffff" strokeLinecap="round">
        <circle cx="32" cy="33" r="17" strokeWidth="3" />
        <ellipse cx="32" cy="33" rx="7.5" ry="17" strokeWidth="2.2" strokeOpacity="0.55" />
        <path d="M15 33h34" strokeWidth="2.2" strokeOpacity="0.55" />
      </g>
      <path
        d="M13 47C15 29 31 17 46 16.5"
        stroke="var(--gate, #ffd23f)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <circle cx="13" cy="47" r="3" fill="#ffffff" />
      <circle
        cx="47.5"
        cy="16.5"
        r="5"
        fill="var(--gate, #ffd23f)"
        stroke={tile}
        strokeWidth="2.5"
      />
    </svg>
  );
}
