import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

interface TagListProps {
  title: string;
  items: readonly string[];
  placeholder: string;
  /** Validate a candidate entry; return an error message or null if valid. */
  validate: (value: string) => string | null;
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
}

/** A labelled list of removable chips with a validated add-input (Atlas style). */
export function TagList({ title, items, placeholder, validate, onAdd, onRemove }: TagListProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const err = validate(trimmed);
    if (err) {
      setError(err);
      return;
    }
    onAdd(trimmed);
    setValue('');
    setError(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
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
      <div className="add-row">
        <input
          className="input mono"
          value={value}
          placeholder={placeholder}
          aria-label={title}
          aria-invalid={!!error}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
        />
        <button type="button" className="btn btn-sm" aria-label={t('actions.add')} onClick={commit}>
          <Plus size={13} />
        </button>
      </div>
      {error && (
        <p className="empty-note" style={{ color: '#b4452f' }}>
          {error}
        </p>
      )}
    </div>
  );
}
