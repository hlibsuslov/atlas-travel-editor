import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  ariaLabel?: string;
}

/**
 * Accessible, searchable single-select styled in the app's design (no native
 * dropdown). Keyboard: ↑/↓ to move, Enter to choose, Esc to close.
 */
export function Combobox({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results',
  ariaLabel,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (val: string) => `${baseId}-option-${val}`;

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? value;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const activeOption = filtered[active];
  const activeDescendantId = open && activeOption ? optionId(activeOption.value) : undefined;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Focus the search field and reset state when opening.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      inputRef.current?.focus();
    }
  }, [open]);

  const choose = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[active];
      if (opt) choose(opt.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="combobox" ref={rootRef}>
      <button
        type="button"
        className={`combobox-trigger${selected || value ? '' : ' is-placeholder'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="combobox-value">{displayLabel || placeholder}</span>
        <ChevronsUpDown size={15} aria-hidden="true" className="combobox-caret" />
      </button>

      {open && (
        <div className="combobox-popover" role="dialog">
          <div className="combobox-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder={searchPlaceholder}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              aria-label={searchPlaceholder}
              role="combobox"
              aria-expanded={open}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={activeDescendantId}
            />
          </div>
          <ul className="combobox-list" role="listbox" id={listboxId} aria-label={ariaLabel}>
            {filtered.length === 0 ? (
              <li className="combobox-empty">{emptyText}</li>
            ) : (
              filtered.map((o, i) => (
                <li
                  key={o.value}
                  id={optionId(o.value)}
                  role="option"
                  aria-selected={o.value === value}
                  className={`combobox-option${i === active ? ' is-active' : ''}${
                    o.value === value ? ' is-selected' : ''
                  }`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(o.value);
                  }}
                >
                  <span>{o.label}</span>
                  {o.value === value && <Check size={15} aria-hidden="true" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
