import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { Stay } from '@/domain/schema';
import { useEditorStore } from '@/features/editor/store';

/**
 * The travel diary: places / hotels the person stayed, optionally with dates and a
 * cost. `travel.stays` is additive + optional (schema v2), so this whole surface is
 * extra — legacy documents simply have an empty diary. Each row commits on blur
 * (one undo step per edit, never per keystroke), mirroring the city editor.
 */
export function StaysEditor() {
  const { t } = useTranslation();
  const stays = useEditorStore((s) => s.data.travel.stays);
  const addStay = useEditorStore((s) => s.addStay);
  const removeStay = useEditorStore((s) => s.removeStay);
  const setStay = useEditorStore((s) => s.setStay);
  const [name, setName] = useState('');

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addStay({ name: trimmed });
    setName('');
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>{t('diary.title', 'Diary')}</h2>
          <div className="sub">{t('diary.sub', 'Places & stays, with cost')}</div>
        </div>
      </div>
      <div className="panel-body">
        {(!stays || stays.length === 0) && (
          <p className="empty-note">
            {t('diary.empty', 'No stays yet — log a hotel or place you stayed.')}
          </p>
        )}
        {stays?.map((stay, i) => (
          <StayRow
            key={i}
            stay={stay}
            onChange={(next) => setStay(i, next)}
            onRemove={() => removeStay(i)}
          />
        ))}
        <div className="add-row">
          <input
            className="input"
            value={name}
            placeholder={t('diary.namePlaceholder', 'Hotel / place name')}
            aria-label={t('diary.namePlaceholder', 'Hotel / place name')}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <button type="button" className="btn btn-sm" disabled={!name.trim()} onClick={add}>
            {t('diary.add', 'Add stay')}
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldRow: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 };

function StayRow({
  stay,
  onChange,
  onRemove,
}: {
  stay: Stay;
  onChange: (s: Stay) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(stay.name);
  const [city, setCity] = useState(stay.city ?? '');
  const [from, setFrom] = useState(stay.from ?? '');
  const [to, setTo] = useState(stay.to ?? '');
  const [amount, setAmount] = useState(stay.cost ? (stay.cost.amount / 100).toString() : '');
  const [currency, setCurrency] = useState(stay.cost?.currency ?? '');
  const [note, setNote] = useState(stay.note ?? '');

  // Re-sync local drafts when the stay changes from elsewhere (undo/redo, import).
  useEffect(() => {
    setName(stay.name);
    setCity(stay.city ?? '');
    setFrom(stay.from ?? '');
    setTo(stay.to ?? '');
    setAmount(stay.cost ? (stay.cost.amount / 100).toString() : '');
    setCurrency(stay.cost?.currency ?? '');
    setNote(stay.note ?? '');
  }, [stay]);

  /** Build a clean Stay from the drafts and commit it (omitting empty fields). */
  const commit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setName(stay.name); // a stay must keep a name
      return;
    }
    const next: Stay = { name: trimmedName };
    if (city.trim()) next.city = city.trim();
    if (from.trim()) next.from = from.trim();
    if (to.trim()) next.to = to.trim();
    if (note.trim()) next.note = note.trim();
    const amt = Number.parseFloat(amount);
    const cur = currency.trim().toUpperCase();
    if (Number.isFinite(amt) && amt >= 0 && /^[A-Z]{3}$/.test(cur)) {
      next.cost = { amount: Math.round(amt * 100), currency: cur };
    }
    onChange(next);
  };

  return (
    <div className="city-card">
      <div className="city-head">
        <input
          className="city-name-in"
          value={name}
          aria-label={t('diary.namePlaceholder', 'Hotel / place name')}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
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
      <div style={fieldRow}>
        <input
          className="input"
          style={{ flex: '1 1 120px' }}
          value={city}
          placeholder={t('diary.city', 'City')}
          aria-label={t('diary.city', 'City')}
          onChange={(e) => setCity(e.target.value)}
          onBlur={commit}
        />
        <input
          className="input mono"
          style={{ flex: '0 1 110px' }}
          value={from}
          placeholder={t('diary.from', 'From (YYYY-MM)')}
          aria-label={t('diary.from', 'From (YYYY-MM)')}
          onChange={(e) => setFrom(e.target.value)}
          onBlur={commit}
        />
        <input
          className="input mono"
          style={{ flex: '0 1 110px' }}
          value={to}
          placeholder={t('diary.to', 'To (YYYY-MM)')}
          aria-label={t('diary.to', 'To (YYYY-MM)')}
          onChange={(e) => setTo(e.target.value)}
          onBlur={commit}
        />
        <input
          className="input mono"
          style={{ flex: '0 1 90px' }}
          type="number"
          inputMode="decimal"
          min={0}
          value={amount}
          placeholder={t('diary.cost', 'Cost')}
          aria-label={t('diary.cost', 'Cost')}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={commit}
        />
        <input
          className="input mono"
          style={{ flex: '0 1 64px', textTransform: 'uppercase' }}
          maxLength={3}
          value={currency}
          placeholder={t('diary.currency', 'EUR')}
          aria-label={t('diary.currency', 'Currency')}
          onChange={(e) => setCurrency(e.target.value)}
          onBlur={commit}
        />
      </div>
      <input
        className="input"
        style={{ marginTop: 6 }}
        value={note}
        placeholder={t('diary.note', 'Note (optional)')}
        aria-label={t('diary.note', 'Note (optional)')}
        onChange={(e) => setNote(e.target.value)}
        onBlur={commit}
      />
    </div>
  );
}
