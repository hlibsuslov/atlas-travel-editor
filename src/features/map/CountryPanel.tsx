import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowUpRight, X } from 'lucide-react';
import { codeForEnglishName, localizedCountryName } from '@/domain/countries';
import { continentForName } from '@/domain/continents';
import { useEditorStore } from '@/features/editor/store';
import { VisitLog } from '@/features/editor/components/VisitLog';
import { findCountry } from '@/features/editor/lib/visits';
import { Flag } from '@/components/ui/Flag';
import { canonical, STATUS_COLORS, type MapStatus } from './countryMatch';
import type { StatusChoice } from './WorldMap';

const PRIMARY: readonly Exclude<StatusChoice, 'capital'>[] = [
  'none',
  'visited',
  'lived',
  'birthplace',
];

interface CountryPanelProps {
  /** Canonical English country name of the selected country. */
  name: string;
  onClose: () => void;
  onSetStatus: (name: string, choice: StatusChoice) => void;
}

/**
 * The selected country, docked beside the full-screen map like a ticket stub:
 * ISO code headline, status, every visit as a dated leg, and a composer for the
 * next visit.
 */
export function CountryPanel({ name, onClose, onSetStatus }: CountryPanelProps) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const countries = useEditorStore((s) => s.data.travel.countries);
  const birthplace = useEditorStore((s) => s.data.person.birthplace.country);
  const [country] = findCountry(countries, name);

  const status: MapStatus =
    canonical(name) === canonical(birthplace)
      ? 'birthplace'
      : !country
        ? 'none'
        : country.status.lived
          ? 'lived'
          : country.status.visited
            ? 'visited'
            : country.capitalVisit.visited
              ? 'capital'
              : 'none';
  const primary: Exclude<StatusChoice, 'capital'> = status === 'capital' ? 'none' : status;
  const visitCount = country ? new Set(country.timeline.visited).size : 0;

  // Move focus into the panel when a different country is selected, so keyboard
  // and screen-reader users land on what they just opened.
  useEffect(() => {
    headingRef.current?.focus();
  }, [name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const code = codeForEnglishName(name) ?? '';
  const continent = continentForName(name);

  return (
    <aside className="country-panel" role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="country-panel-head">
        <Flag name={name} status={status} size={40} />
        <div className="country-panel-id">
          {code && (
            <span className="country-panel-code" aria-hidden="true">
              {code}
            </span>
          )}
          <h2 id={titleId} ref={headingRef} tabIndex={-1} className="country-panel-name">
            {localizedCountryName(name, i18n.language)}
          </h2>
          <span className="country-panel-sub">
            {t(`continent.${continent.toLowerCase()}`, { defaultValue: continent })}
            {visitCount > 0 && <> · {t('panel.visitsCount', { count: visitCount })}</>}
          </span>
        </div>
        <button type="button" className="icon-btn" aria-label={t('panel.close')} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="country-panel-body">
        <section aria-labelledby={`${titleId}-status`}>
          <h3 id={`${titleId}-status`} className="panel-section-title">
            {t('panel.status')}
          </h3>
          <div className="segmented" role="radiogroup" aria-labelledby={`${titleId}-status`}>
            {PRIMARY.map((choice) => (
              <button
                key={choice}
                type="button"
                role="radio"
                aria-checked={primary === choice}
                className="segmented-item"
                onClick={() => onSetStatus(name, choice)}
              >
                <i
                  className="status-swatch"
                  style={{ background: STATUS_COLORS[choice] }}
                  aria-hidden="true"
                />
                {choice === 'none' ? t('panel.statusNone') : t(`map.legend.${choice}`)}
              </button>
            ))}
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={!!country?.capitalVisit.visited}
              onChange={(e) => {
                const store = useEditorStore.getState();
                store.setCapitalVisit(store.ensureCountry(name), e.target.checked);
              }}
            />
            {t('panel.capital')}
          </label>
          {country && country.timeline.lived.length > 0 && (
            <p className="panel-note">
              {t('map.legend.lived')}:{' '}
              {country.timeline.lived.map((l) => l.replace('-', '–')).join(', ')}
            </p>
          )}
        </section>

        <VisitLog name={name} />

        <Link className="panel-link" to="/countries">
          {t('panel.openInCountries')} <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
