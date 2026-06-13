import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Plus, X } from 'lucide-react';
import type { City } from '@/domain/schema';
import { CURRENT_YEAR } from '@/domain/constants';

interface CityBlockProps {
  cities: readonly City[];
  onAddCity: (name: string) => void;
  onRemoveCity: (index: number) => void;
  onRenameCity: (index: number, name: string) => void;
  onAddYear: (index: number, year: number) => void;
  onRemoveYear: (index: number, yearIndex: number) => void;
}

/** Editable city list with per-city visit years (Atlas style). */
export function CityTimeline({
  cities,
  onAddCity,
  onRemoveCity,
  onRenameCity,
  onAddYear,
  onRemoveYear,
}: CityBlockProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  const addCity = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAddCity(trimmed);
    setName('');
  };

  return (
    <div className="city-block">
      <h4>{t('city.title')}</h4>
      <div className="city-list">
        {cities.length === 0 && <span className="empty-note">{t('city.noCities')}</span>}
        {cities.map((city, ci) => (
          <div className="city-card" key={ci}>
            <div className="city-head">
              <MapPin size={14} />
              <input
                className="city-name-in"
                value={city.name}
                aria-label={t('city.namePlaceholder')}
                onChange={(e) => onRenameCity(ci, e.target.value)}
              />
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                aria-label={t('actions.delete')}
                onClick={() => onRemoveCity(ci)}
              >
                <X size={13} />
              </button>
            </div>
            <div className="year-line">
              {city.timeline.visited.map((y, yi) => (
                <span className="year-chip" key={`${y}-${yi}`}>
                  {y}
                  <button
                    type="button"
                    aria-label={t('actions.delete')}
                    onClick={() => onRemoveYear(ci, yi)}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => onAddYear(ci, CURRENT_YEAR)}
              >
                <Plus size={12} /> {CURRENT_YEAR}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="add-row">
        <input
          className="input"
          value={name}
          placeholder={t('city.namePlaceholder')}
          aria-label={t('city.namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCity();
            }
          }}
        />
        <button type="button" className="btn btn-sm" disabled={!name.trim()} onClick={addCity}>
          {t('actions.addCity')}
        </button>
      </div>
    </div>
  );
}
