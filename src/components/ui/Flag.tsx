import { useState } from 'react';
import { STATUS_COLORS, type MapStatus } from '@/features/map/countryMatch';
import { codeForEnglishName } from '@/domain/countries';
import { flagUrl, hasFlag } from '@/lib/flags';
import './Flag.css';

export interface FlagProps {
  /** English country name (e.g. "France"). Resolved to an ISO code internally. */
  name?: string;
  /** ISO 3166-1 alpha-2 code, if already known. Takes precedence over `name`. */
  code?: string;
  /** Disc diameter in px. Defaults to the 30px `.country-flag` card contract. */
  size?: number;
  /** Travel status — draws a thin ring in the matching --c-* colour. */
  status?: MapStatus;
  /** Optional native tooltip; falls back to the country name / code. */
  title?: string;
}

/** 2-letter label for the fallback disc when no flag artwork is available. */
function fallbackLabel(code: string | undefined, name: string | undefined): string {
  if (code) return code.toUpperCase();
  return (name || '··').slice(0, 2).toUpperCase();
}

/**
 * Real Wikipedia / circle-flags artwork clipped into a perfect circle, with an
 * optional thin status-coloured ring. Resolves `name` to an ISO code via the
 * canonical country list when `code` is not given. If the asset is missing or
 * the name is unknown it degrades to a tinted disc showing the 2-letter code,
 * so a flag never renders broken.
 */
export function Flag({ name, code, size = 30, status, title }: FlagProps) {
  const iso = code ?? (name ? codeForEnglishName(name) : undefined);
  // Track a load failure so a valid-looking code with no asset still falls back.
  const [errored, setErrored] = useState(false);

  const ring = status ? STATUS_COLORS[status] : 'transparent';
  const style = {
    '--flag-size': `${size}px`,
    '--flag-ring': ring,
  } as React.CSSProperties;

  const label = title ?? name ?? iso ?? undefined;
  const showImage = hasFlag(iso) && !errored;

  if (!showImage) {
    // Fallback: tinted code disc (the original FlagDisc look).
    return (
      <span
        className="flag flag--fallback"
        style={{ ...style, background: status ? STATUS_COLORS[status] : undefined }}
        role="img"
        aria-label={label}
        title={label}
      >
        {fallbackLabel(iso, name)}
      </span>
    );
  }

  return (
    <span className="flag" style={style} title={label}>
      <img
        className="flag__img"
        src={flagUrl(iso)}
        alt={label ?? ''}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setErrored(true)}
        draggable={false}
      />
    </span>
  );
}
