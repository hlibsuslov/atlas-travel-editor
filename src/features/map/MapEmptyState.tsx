import { useTranslation } from 'react-i18next';
import { MapPinned } from 'lucide-react';

interface MapEmptyStateProps {
  /**
   * Optional callback wired to an "import data" affordance. When provided, an
   * action button is rendered; otherwise the component is purely informational.
   */
  onImport?: () => void;
}

/**
 * Atlas-styled empty state shown on the map when no countries are marked yet.
 *
 * Presentational and store-independent: it reads nothing from the editor store
 * and accepts an optional `onImport` callback. All copy goes through i18n with
 * inline `defaultValue`s so no locale JSON files need editing.
 */
export function MapEmptyState({ onImport }: MapEmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="panel" role="status" aria-live="polite">
      <div className="panel-body" style={{ textAlign: 'center' }}>
        <MapPinned size={32} aria-hidden="true" />
        <h2 className="page-title" style={{ marginTop: 8 }}>
          {t('map.empty.heading', { defaultValue: 'Your map is empty' })}
        </h2>
        <p className="empty-note">
          {t('map.empty.hint', {
            defaultValue: 'Click a country to mark it, or import your existing travel data.',
          })}
        </p>
        {onImport && (
          <button className="btn btn-sm" type="button" onClick={onImport}>
            {t('map.empty.import', { defaultValue: 'Import data' })}
          </button>
        )}
      </div>
    </div>
  );
}
