import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { ChevronRight, X } from 'lucide-react';
import type { Country } from '@/domain/schema';
import { isValidTimelineString } from '@/domain/timeline';
import { TIMELINE_HINT } from '@/domain/constants';
import { primaryStatus } from '@/domain/stats';
import { useEditorStore } from '@/features/editor/store';
import { FlagDisc } from '@/components/ui/FlagDisc';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusToggle } from './StatusToggle';
import { TagList } from './TagList';
import { CityTimeline } from './CityTimeline';
import { CountrySelect } from './CountrySelect';

interface CountryCardProps {
  country: Country;
  index: number;
  invalid: boolean;
  defaultOpen?: boolean;
}

const useCountryActions = () =>
  useEditorStore(
    useShallow((s) => ({
      setCountryName: s.setCountryName,
      removeCountry: s.removeCountry,
      setStatus: s.setStatus,
      setCapitalVisit: s.setCapitalVisit,
      addCountryTimeline: s.addCountryTimeline,
      removeCountryTimeline: s.removeCountryTimeline,
      addCity: s.addCity,
      removeCity: s.removeCity,
      renameCity: s.renameCity,
      addCityYear: s.addCityYear,
      removeCityYear: s.removeCityYear,
    })),
  );

function CountryCardImpl({ country, index, invalid, defaultOpen }: CountryCardProps) {
  const { t } = useTranslation();
  const store = useCountryActions();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const status = primaryStatus(country);
  const cityCount = country.cities.length;

  const timelineValidator = (value: string): string | null =>
    isValidTimelineString(value)
      ? null
      : t('validation.invalidTimeline', { formats: TIMELINE_HINT });

  return (
    <div className={`country-card${open ? ' open' : ''}${invalid ? ' invalid' : ''}`}>
      <div className="country-top" onClick={() => setOpen((o) => !o)}>
        <FlagDisc name={country.name} status={status} />
        <div className="country-id" onClick={(e) => e.stopPropagation()}>
          <CountrySelect
            value={country.name}
            onChange={(name) => store.setCountryName(index, name)}
            ariaLabel={t('country.namePlaceholder')}
          />
          <div className="country-meta">
            <span>{t(`map.legend.${status}`)}</span>
            <span>·</span>
            <span>{t('country.cities', { count: cityCount })}</span>
          </div>
        </div>
        <div className="country-top-right">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            aria-label={t('actions.delete')}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmOpen(true);
            }}
          >
            <X size={14} />
          </button>
          <span className="caret">
            <ChevronRight size={16} />
          </span>
        </div>
      </div>

      {open && (
        <div className="country-body">
          <div className="status-row">
            <StatusToggle
              label={t('country.visited')}
              on={country.status.visited}
              status="visited"
              onClick={() => store.setStatus(index, 'visited', !country.status.visited)}
            />
            <StatusToggle
              label={t('country.lived')}
              on={country.status.lived}
              status="lived"
              onClick={() => store.setStatus(index, 'lived', !country.status.lived)}
            />
            <StatusToggle
              label={t('country.birthplace')}
              on={country.status.birthplace}
              status="birthplace"
              onClick={() => store.setStatus(index, 'birthplace', !country.status.birthplace)}
            />
            <StatusToggle
              label={t('country.capital')}
              on={country.capitalVisit.visited}
              status="capital"
              onClick={() => store.setCapitalVisit(index, !country.capitalVisit.visited)}
            />
          </div>

          <div className="grid-2">
            <TagList
              title={t('country.timelineVisited')}
              items={country.timeline.visited}
              placeholder={TIMELINE_HINT}
              validate={timelineValidator}
              onAdd={(v) => store.addCountryTimeline(index, 'visited', v)}
              onRemove={(i) => store.removeCountryTimeline(index, 'visited', i)}
            />
            <TagList
              title={t('country.timelineLived')}
              items={country.timeline.lived}
              placeholder={TIMELINE_HINT}
              validate={timelineValidator}
              onAdd={(v) => store.addCountryTimeline(index, 'lived', v)}
              onRemove={(i) => store.removeCountryTimeline(index, 'lived', i)}
            />
          </div>

          <CityTimeline
            cities={country.cities}
            onAddCity={(name) => store.addCity(index, name)}
            onRemoveCity={(ci) => store.removeCity(index, ci)}
            onRenameCity={(ci, name) => store.renameCity(index, ci, name)}
            onAddYear={(ci, year) => store.addCityYear(index, ci, year)}
            onRemoveYear={(ci, yi) => store.removeCityYear(index, ci, yi)}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={t('actions.delete')}
        message={t('country.removeConfirm', {
          name: country.name || t('country.thisCountry'),
        })}
        onConfirm={() => {
          setConfirmOpen(false);
          store.removeCountry(index);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export const CountryCard = memo(CountryCardImpl);
