import { memo, useState } from 'react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { CalendarPlus, ChevronRight, Star, X } from 'lucide-react';
import type { Country } from '@/domain/schema';
import { CURRENT_YEAR } from '@/domain/constants';
import { primaryStatus } from '@/domain/stats';
import { canonical } from '@/features/map/countryMatch';
import { useEditorStore } from '@/features/editor/store';
import { FlagDisc } from '@/components/ui/FlagDisc';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusRow } from './StatusRow';
import { TimelineField } from './TimelineField';
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
      actualizeCountry: s.actualizeCountry,
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
  // Birthplace is owned by the Person field, not markable per-country — a country
  // is "birthplace" only when its name matches the person's birthplace.
  const birthplaceCountry = useEditorStore((s) => s.data.person.birthplace.country);
  const isBirthplace = !!country.name && canonical(country.name) === canonical(birthplaceCountry);

  const [open, setOpen] = useState(defaultOpen ?? false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const status = isBirthplace ? 'birthplace' : primaryStatus(country);
  const cityCount = country.cities.length;

  // Quick-actualize: log a visit for the current year straight from the
  // collapsed header. The store dedupes, so repeated taps are harmless.
  const onActualize = (e: MouseEvent) => {
    e.stopPropagation();
    store.actualizeCountry(country.name, CURRENT_YEAR);
    toast.success(
      t('editor.actualized', 'Recorded {{country}} {{year}}', {
        country: country.name,
        year: CURRENT_YEAR,
      }),
    );
  };

  return (
    <div
      id={`country-card-${index}`}
      className={`country-card${open ? ' open' : ''}${invalid ? ' invalid' : ''}`}
    >
      <div
        className="country-top"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={country.name || t('country.thisCountry')}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          // Don't hijack typing/activation inside the nested name picker or buttons.
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
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
          {isBirthplace && (
            <span className="chip birthplace-chip" title={t('country.birthplace')}>
              <Star size={11} /> {t('country.birthplace')}
            </span>
          )}
          {!open && country.name && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              aria-label={t('editor.actualizeYear', 'Record a visit this year ({{year}})', {
                year: CURRENT_YEAR,
              })}
              title={t('editor.actualizeYear', 'Record a visit this year ({{year}})', {
                year: CURRENT_YEAR,
              })}
              onClick={onActualize}
            >
              <CalendarPlus size={13} /> {CURRENT_YEAR}
            </button>
          )}
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
          <StatusRow
            country={country}
            onToggleVisited={() => store.setStatus(index, 'visited', !country.status.visited)}
            onToggleLived={() => store.setStatus(index, 'lived', !country.status.lived)}
            onToggleCapital={() => store.setCapitalVisit(index, !country.capitalVisit.visited)}
          />

          <div className="grid-2">
            <TimelineField
              title={t('country.timelineVisited')}
              mode="year"
              items={country.timeline.visited}
              onAdd={(v) => store.addCountryTimeline(index, 'visited', v)}
              onRemove={(i) => store.removeCountryTimeline(index, 'visited', i)}
            />
            <TimelineField
              title={t('country.timelineLived')}
              mode="range"
              items={country.timeline.lived}
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
        message={t('country.removeConfirm', { name: country.name || t('country.thisCountry') })}
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
