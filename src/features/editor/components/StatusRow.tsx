import { useTranslation } from 'react-i18next';
import type { Country } from '@/domain/schema';
import { StatusToggle } from './StatusToggle';

interface StatusRowProps {
  country: Country;
  onToggleVisited: () => void;
  onToggleLived: () => void;
  onToggleCapital: () => void;
}

/** The visited / lived / capital status toggles for a country card. */
export function StatusRow({
  country,
  onToggleVisited,
  onToggleLived,
  onToggleCapital,
}: StatusRowProps) {
  const { t } = useTranslation();
  return (
    <div className="status-row">
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
  );
}
