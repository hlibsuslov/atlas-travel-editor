import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Plus, X } from 'lucide-react';
import type { City } from '@/domain/schema';
import { isValidYear } from '@/domain/timeline';
import { CURRENT_YEAR, MAX_YEAR, MIN_YEAR } from '@/domain/constants';

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
          <CityRow
            key={ci}
            city={city}
            onRename={(value) => onRenameCity(ci, value)}
            onRemove={() => onRemoveCity(ci)}
            onAddYear={(year) => onAddYear(ci, year)}
            onRemoveYear={(yi) => onRemoveYear(ci, yi)}
            onEditYear={(yi, year) => {
              // Edit-in-place: drop the old year and re-add the corrected one.
              // The store dedupes/sorts, so order stays canonical.
              onRemoveYear(ci, yi);
              onAddYear(ci, year);
            }}
          />
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

interface CityRowProps {
  city: City;
  onRename: (name: string) => void;
  onRemove: () => void;
  onAddYear: (year: number) => void;
  onRemoveYear: (yearIndex: number) => void;
  onEditYear: (yearIndex: number, year: number) => void;
}

/**
 * A single city row. Owns the local UI state that must not leak into the store
 * on every keystroke:
 *  - the rename field is a controlled LOCAL input that commits to the store only
 *    on blur/Enter (so one rename is a single undo step, and an interim empty
 *    value never invalidates the document); Esc reverts.
 *  - the year entry is a validated numeric input with an inline range error.
 *  - existing year chips are inline-editable in place.
 */
function CityRow({ city, onRename, onRemove, onAddYear, onRemoveYear, onEditYear }: CityRowProps) {
  const { t } = useTranslation();

  // --- Commit-on-blur rename -------------------------------------------------
  const [draftName, setDraftName] = useState(city.name);
  // Keep the local draft in sync when the store value changes from elsewhere
  // (undo/redo, import) — but not while the user is mid-edit on this field.
  useEffect(() => {
    setDraftName(city.name);
  }, [city.name]);

  // Set while reverting via Esc so the blur that follows doesn't commit the
  // discarded draft (React state updates aren't flushed before the sync blur).
  const revertingRef = useRef(false);

  const commitName = () => {
    if (revertingRef.current) {
      revertingRef.current = false;
      return;
    }
    // An empty / whitespace-only name is invalid (the schema requires a non-empty
    // city name) and would block saving the whole document. Revert to the last
    // good name instead of committing the broken interim value.
    if (!draftName.trim()) {
      setDraftName(city.name);
      return;
    }
    if (draftName !== city.name) onRename(draftName);
  };

  // --- New-year entry --------------------------------------------------------
  const [yearInput, setYearInput] = useState('');
  const [yearError, setYearError] = useState(false);

  const addYear = () => {
    const n = Number.parseInt(yearInput.trim(), 10);
    if (!isValidYear(n)) {
      setYearError(true);
      return;
    }
    onAddYear(n);
    setYearInput('');
    setYearError(false);
  };

  // --- Inline chip edit ------------------------------------------------------
  const [editing, setEditing] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState(false);

  const startEdit = (yi: number, year: number) => {
    setEditing(yi);
    setEditValue(String(year));
    setEditError(false);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
    setEditError(false);
  };

  const commitEdit = (yi: number) => {
    const n = Number.parseInt(editValue.trim(), 10);
    if (!isValidYear(n)) {
      setEditError(true);
      return;
    }
    onEditYear(yi, n);
    cancelEdit();
  };

  const rangeError = t('validation.cityYearRange', { min: MIN_YEAR, max: MAX_YEAR });

  return (
    <div className="city-card">
      <div className="city-head">
        <MapPin size={14} />
        <input
          className="city-name-in"
          value={draftName}
          aria-label={t('city.namePlaceholder')}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              revertingRef.current = true;
              setDraftName(city.name);
              e.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          aria-label={t('actions.delete')}
          onClick={onRemove}
        >
          <X size={13} />
        </button>
      </div>
      <div className="year-line">
        {city.timeline.visited.map((y, yi) =>
          editing === yi ? (
            <input
              key={`edit-${yi}`}
              className="input mono chip-edit"
              type="number"
              inputMode="numeric"
              min={MIN_YEAR}
              max={MAX_YEAR}
              autoFocus
              value={editValue}
              aria-label={t('editor.editYear', 'Edit year')}
              aria-invalid={editError}
              onChange={(e) => {
                setEditValue(e.target.value);
                if (editError) setEditError(false);
              }}
              onBlur={() => commitEdit(yi)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitEdit(yi);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
            />
          ) : (
            <span className="year-chip" key={`${y}-${yi}`}>
              <button
                type="button"
                className="chip-label"
                aria-label={t('editor.editYear', 'Edit year')}
                onClick={() => startEdit(yi, y)}
              >
                {y}
              </button>
              <button
                type="button"
                aria-label={t('actions.delete')}
                onClick={() => onRemoveYear(yi)}
              >
                ×
              </button>
            </span>
          ),
        )}
      </div>
      <div className="add-row timeline-add">
        <input
          className="input mono"
          type="number"
          inputMode="numeric"
          min={MIN_YEAR}
          max={MAX_YEAR}
          value={yearInput}
          placeholder={t('timeline.year')}
          aria-label={t('timeline.year')}
          aria-invalid={yearError}
          onChange={(e) => {
            setYearInput(e.target.value);
            if (yearError) setYearError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addYear();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => onAddYear(CURRENT_YEAR)}
          title={String(CURRENT_YEAR)}
        >
          <Plus size={12} /> {CURRENT_YEAR}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          aria-label={t('actions.addYear')}
          onClick={addYear}
        >
          <Plus size={13} />
        </button>
      </div>
      {yearError && <p className="empty-note field-error">{rangeError}</p>}
    </div>
  );
}
