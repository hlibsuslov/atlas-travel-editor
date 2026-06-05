import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface FilterInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

/** Country filter text input with an accessible clear (×) button. */
export function FilterInput({ value, onChange, placeholder, ariaLabel }: FilterInputProps) {
  const { t } = useTranslation();

  const clear = () => onChange('');

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && value) {
      e.preventDefault();
      clear();
    }
  };

  return (
    <div className="filter-input">
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {value && (
        <button
          type="button"
          className="filter-clear"
          aria-label={t('actions.clear', { defaultValue: 'Clear' })}
          onClick={clear}
        >
          ×
        </button>
      )}
    </div>
  );
}
