import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { isValidYear } from '@/domain/timeline';
import { CURRENT_YEAR, MAX_YEAR, MIN_YEAR } from '@/domain/constants';

interface TimelineFieldProps {
  title: string;
  mode: 'year' | 'range';
  items: readonly string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
}

const clampYear = (n: number) => Math.max(MIN_YEAR, Math.min(MAX_YEAR, n));

/**
 * Convenient, validated entry for travel timelines. Instead of typing format
 * strings, the user adds a year (year mode) or a from–to period (range mode);
 * values are stored back as the canonical "YYYY" / "YYYY-YYYY" strings the
 * schema expects. Research note: chip-based entry with a numeric stepper and a
 * one-tap "this year" is faster and less error-prone than free text.
 */
export function TimelineField({ title, mode, items, onAdd, onRemove }: TimelineFieldProps) {
  const { t } = useTranslation();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fail = () => setError(t('validation.cityYearRange', { min: MIN_YEAR, max: MAX_YEAR }));

  const commit = () => {
    const a = Number.parseInt(from.trim(), 10);
    if (!isValidYear(a)) return fail();

    if (mode === 'range') {
      const raw = to.trim();
      if (raw) {
        const b = Number.parseInt(raw, 10);
        if (!isValidYear(b) || b < a) return fail();
        onAdd(`${a}-${b}`);
      } else {
        onAdd(String(a));
      }
    } else {
      onAdd(String(a));
    }
    setFrom('');
    setTo('');
    setError(null);
  };

  return (
    <div className="tag-list">
      <h4>{title}</h4>
      <div className="tags">
        {items.length === 0 && <span className="empty-note">—</span>}
        {items.map((item, i) => (
          <span className="tag" key={`${item}-${i}`}>
            {item}
            <button type="button" aria-label={t('actions.delete')} onClick={() => onRemove(i)}>
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="add-row timeline-add">
        <input
          className="input mono"
          type="number"
          inputMode="numeric"
          min={MIN_YEAR}
          max={MAX_YEAR}
          value={from}
          placeholder={mode === 'range' ? t('timeline.from') : t('timeline.year')}
          aria-label={mode === 'range' ? t('timeline.from') : t('timeline.year')}
          aria-invalid={!!error}
          onChange={(e) => {
            setFrom(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
        />
        {mode === 'range' && (
          <>
            <span className="timeline-dash" aria-hidden="true">
              –
            </span>
            <input
              className="input mono"
              type="number"
              inputMode="numeric"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={to}
              placeholder={t('timeline.to')}
              aria-label={t('timeline.to')}
              aria-invalid={!!error}
              onChange={(e) => {
                setTo(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit();
                }
              }}
            />
          </>
        )}
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => onAdd(String(clampYear(CURRENT_YEAR)))}
          title={String(CURRENT_YEAR)}
        >
          {CURRENT_YEAR}
        </button>
        <button type="button" className="btn btn-sm" aria-label={t('actions.add')} onClick={commit}>
          <Plus size={13} />
        </button>
      </div>
      {error && <p className="empty-note field-error">{error}</p>}
    </div>
  );
}
