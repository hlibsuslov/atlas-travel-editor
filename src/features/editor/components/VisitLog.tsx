import { useId, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { CURRENT_YEAR, MAX_YEAR, MIN_YEAR } from '@/domain/constants';
import { localizedCountryName } from '@/domain/countries';
import { isValidYear } from '@/domain/timeline';
import { tidyTimeline } from '@/domain/tidy';
import { useEditorStore } from '@/features/editor/store';
import { findCountry, formatVisit } from '../lib/visits';

/**
 * Every visit to one country in chronological order, each with the cities seen
 * that year, plus a composer that logs another visit (date and cities) as a
 * single undo step. Shared by the map's country panel and the Countries list,
 * so repeat visits are entered the same way everywhere.
 */
export function VisitLog({ name }: { name: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const id = useId();
  const countries = useEditorStore((s) => s.data.travel.countries);
  const [country, index] = findCountry(countries, name);

  const visits = useMemo(() => {
    if (!country) return [];
    return tidyTimeline(country.timeline.visited).map((entry) => {
      const year = Number.parseInt(entry.slice(0, 4), 10);
      const cities = country.cities
        .filter((c) => c.timeline.visited.includes(year))
        .map((c) => c.name);
      return { entry, cities, sourceIndex: country.timeline.visited.indexOf(entry) };
    });
  }, [country]);

  const undatedCities = useMemo(
    () => country?.cities.filter((c) => c.timeline.visited.length === 0).map((c) => c.name) ?? [],
    [country],
  );

  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState('');
  const [cities, setCities] = useState('');
  const [error, setError] = useState<string | null>(null);

  const months = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2000, i, 1))));
  }, [locale]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const y = Number.parseInt(year, 10);
    if (!isValidYear(y)) {
      setError(t('validation.cityYearRange', { min: MIN_YEAR, max: MAX_YEAR }));
      return;
    }
    const date = month ? `${y}-${month.padStart(2, '0')}` : String(y);
    const cityList = cities
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    useEditorStore.getState().logVisit(name, date, cityList);
    setCities('');
    setMonth('');
    setError(null);
    toast.success(t('panel.visitLogged', { country: localizedCountryName(name, locale) }));
  };

  const removeVisit = (sourceIndex: number) => {
    if (index < 0 || sourceIndex < 0) return;
    useEditorStore.getState().removeCountryTimeline(index, 'visited', sourceIndex);
  };

  return (
    <div className="visit-log">
      <section aria-labelledby={`${id}-visits`}>
        <h3 id={`${id}-visits`} className="panel-section-title">
          {t('panel.visits')}
        </h3>
        {visits.length === 0 ? (
          <p className="panel-empty">{t('panel.noVisits')}</p>
        ) : (
          <ol className="visit-list">
            {visits.map((v) => (
              <li key={v.entry} className="visit-row">
                <span className="visit-date">{formatVisit(v.entry, locale)}</span>
                <span className="visit-cities">{v.cities.join(', ') || '—'}</span>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  aria-label={t('panel.removeVisit', { date: formatVisit(v.entry, locale) })}
                  onClick={() => removeVisit(v.sourceIndex)}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )}
        {undatedCities.length > 0 && (
          <p className="panel-note">
            {t('panel.undatedCities')}: {undatedCities.join(', ')}
          </p>
        )}
      </section>

      <form className="visit-form" onSubmit={submit} aria-labelledby={`${id}-log`} noValidate>
        <h3 id={`${id}-log`} className="panel-section-title">
          {t('panel.logVisit')}
        </h3>
        <div className="visit-form-row">
          <label className="field-compact">
            <span>{t('timeline.year')}</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={year}
              aria-invalid={!!error}
              onChange={(e) => {
                setYear(e.target.value);
                if (error) setError(null);
              }}
            />
          </label>
          <label className="field-compact">
            <span>{t('panel.month')}</span>
            <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">—</option>
              {months.map((m, i) => (
                <option key={m} value={String(i + 1)}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field-compact">
          <span>{t('panel.cities')}</span>
          <input
            className="input"
            list={`${id}-cities`}
            value={cities}
            placeholder={t('panel.citiesPlaceholder')}
            onChange={(e) => setCities(e.target.value)}
          />
          <datalist id={`${id}-cities`}>
            {country?.cities.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
        </label>
        {error && <p className="field-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">
          <Plus size={16} aria-hidden="true" /> {t('panel.addVisit')}
        </button>
      </form>
    </div>
  );
}
