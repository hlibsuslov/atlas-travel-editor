import { useTranslation } from 'react-i18next';
import type { Country } from '@/domain/schema';
import { StatusToggle } from './StatusToggle';

interface StatusRowProps {
  country: Country;
  onToggleVisited: () => void;
  onToggleLived: () => void;
  onToggleCapital: () => void;
}

/**
 * The visited / lived / capital status toggles for a country card, grouped as one
 * labelled control so they read as a single setting rather than three loose pills.
 * The group carries an accessible name; each toggle exposes its own pressed state.
 */
export function StatusRow({
  country,
  onToggleVisited,
  onToggleLived,
  onToggleCapital,
}: StatusRowProps) {
  const { t } = useTranslation();
  return (
    <div className="status-control">
      <span className="status-control-label">{t('country.statusLabel', 'Status')}</span>
      <div className="status-row" role="group" aria-label={t('country.statusLabel', 'Status')}>
        <StatusToggle
          label={t('country.visited')}
          on={country.status.visited}
          status="visited"
          onClick={onToggleVisited}
        />
        <StatusToggle
          label={t('country.lived')}
          on={country.status.lived}
          status="lived"
          onClick={onToggleLived}
        />
        <StatusToggle
          label={t('country.capital')}
          on={country.capitalVisit.visited}
          status="capital"
          onClick={onToggleCapital}
        />
      </div>
    </div>
  );
}
