import { useTranslation } from 'react-i18next';
import { STATUS_COLORS } from './countryMatch';

const ITEMS = ['birthplace', 'lived', 'visited', 'capital'] as const;

/** Map legend with optional per-status counts. */
export function Legend({ counts }: { counts?: Record<string, number> }) {
  const { t } = useTranslation();
  return (
    <div
      className="legend"
      role="list"
      aria-label={t('map.legend.aria', { defaultValue: 'Map legend' })}
    >
      {ITEMS.map((k) => {
        const label = t(`map.legend.${k}`);
        const count = counts ? (counts[k] ?? 0) : undefined;
        // Screen-reader accessible name: localized status label plus the count
        // when provided, so assistive tech announces e.g. "Visited, 12" rather
        // than relying on the decorative swatch.
        const accessibleName =
          count === undefined
            ? label
            : t('map.legend.itemAria', {
                defaultValue: '{{label}}, {{count}}',
                label,
                count,
              });
        return (
          <span className="legend-item" key={k} role="listitem" aria-label={accessibleName}>
            <span
              className="legend-sw"
              style={{ background: STATUS_COLORS[k] }}
              aria-hidden="true"
            />
            {label}
            {count !== undefined && <span className="mono">{count}</span>}
          </span>
        );
      })}
    </div>
  );
}
