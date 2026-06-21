import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { Stay } from '@/domain/schema';
import { useEditorStore } from '@/features/editor/store';
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
import { CountrySelect } from '@/features/editor/components/CountrySelect';
import { Flag } from '@/components/ui/Flag';
import { RE_YEAR, RE_YEAR_MONTH, RE_YEAR_MONTH_DAY, RE_YEAR_RANGE } from '@/domain/constants';
import { isValidTimelineString } from '@/domain/timeline';
import '../editor.css';

/**
 * The travel diary: places / hotels the person stayed, optionally tied to a
 * country (so spend ties to the countries list), with dates and a cost.
 * `travel.stays` is additive + optional (schema v2), so this whole surface is
 * extra — legacy documents simply have an empty diary. Each row commits on blur
 * (one undo step per edit, never per keystroke), mirroring the city editor.
 */

/**
 * A short, static ISO-4217 list: the global majors plus everything our sample
 * data / docs already reference. Offline-first means no live currency feed, so a
 * curated list is honest and fast; manual 3-letter entry still works as a
 * fallback for anything not listed. Codes only — names are localized by Intl.
 */
const COMMON_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CHF',
  'CAD',
  'AUD',
  'NZD',
  'CNY',
  'HKD',
  'SGD',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'HUF',
  'RON',
  'BGN',
  'TRY',
  'UAH',
  'RUB',
  'INR',
  'IDR',
  'THB',
  'VND',
  'PHP',
  'MYR',
  'KRW',
  'AED',
  'SAR',
  'ILS',
  'ZAR',
  'EGP',
  'MAD',
  'BRL',
  'MXN',
  'ARS',
  'CLP',
  'COP',
] as const;

/** How a stay row is ordered in the diary list. */
type SortKey = 'date' | 'cost' | 'name';

/**
 * Parse a stored timeline string (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`) to a UTC
 * day count for ordering and night math. Partial dates normalise to the 1st of
 * the month/year; a `YYYY-YYYY` range is two years (not a single day) so it
 * returns null. Returns null for junk, so it can never yield NaN downstream.
 * Mirrors the budget aggregation in domain/stats.ts (kept local to avoid
 * widening that module's public surface for one UI helper).
 */
function timelineToEpochDay(value: string): number | null {
  if (!isValidTimelineString(value)) return null;
  const s = value.trim();
  if (RE_YEAR_RANGE.test(s)) return null;

  let y: number;
  let m = 1;
  let d = 1;
  if (RE_YEAR.test(s)) {
    y = Number(s);
  } else if (RE_YEAR_MONTH.test(s)) {
    y = Number(s.slice(0, 4));
    m = Number(s.slice(5, 7));
  } else if (RE_YEAR_MONTH_DAY.test(s)) {
    const [yy, mm, dd] = s.split('-').map(Number) as [number, number, number];
    y = yy;
    m = mm;
    d = dd;
  } else {
    return null;
  }
  const ms = Date.UTC(y, m - 1, d);
  return Number.isNaN(ms) ? null : Math.floor(ms / 86_400_000);
}

/** Whole nights between a stay's dates (inclusive-exclusive), or null when undated/junk. */
function nightsForStay(stay: Stay): number | null {
  if (!stay.from || !stay.to) return null;
  const from = timelineToEpochDay(stay.from);
  const to = timelineToEpochDay(stay.to);
  if (from === null || to === null) return null;
  const diff = to - from;
  return diff > 0 ? diff : null;
}

/** A stay's earliest sortable day, or null when it has no parseable start/end. */
function stayEpochDay(stay: Stay): number | null {
  const fromDay = stay.from ? timelineToEpochDay(stay.from) : null;
  if (fromDay !== null) return fromDay;
  return stay.to ? timelineToEpochDay(stay.to) : null;
}

/**
 * Format an integer minor-unit amount + ISO code with Intl. We let Intl supply
 * the currency's own fraction digits (e.g. JPY → 0, USD → 2), dividing minor
 * units by the matching power of ten. Falls back to a plain code + number for an
 * unknown code so a custom currency never crashes the row.
 */
function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    return fmt.format(amount / 10 ** digits);
  } catch {
    // Unknown / non-ISO code: show major units (2dp) next to the raw code.
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

/** Localized currency display name for the dropdown label, or the bare code. */
function currencyLabel(code: string, locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'currency' }).of(code);
    return name && name !== code ? `${code} — ${name}` : code;
  } catch {
    return code;
  }
}

export function StaysEditor() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en';
  const stays = useEditorStore((s) => s.data.travel.stays);
  const addStay = useEditorStore((s) => s.addStay);
  const removeStay = useEditorStore((s) => s.removeStay);
  const setStay = useEditorStore((s) => s.setStay);
  const [name, setName] = useState('');
  const [sort, setSort] = useState<SortKey>('date');

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addStay({ name: trimmed });
    setName('');
  };

  /**
   * Stays carry their original document index so editing/removing still targets
   * the right entry no matter how the list is sorted for display. Default order
   * is by date descending (most recent stays first), then by name.
   */
  const ordered = useMemo(() => {
    const withIndex = (stays ?? []).map((stay, index) => ({ stay, index }));
    const byName = (a: Stay, b: Stay) => a.name.localeCompare(b.name, locale);
    return withIndex.sort((a, b) => {
      if (sort === 'name') return byName(a.stay, b.stay);
      if (sort === 'cost') {
        const av = a.stay.cost?.amount ?? -1;
        const bv = b.stay.cost?.amount ?? -1;
        return bv - av || byName(a.stay, b.stay);
      }
      // date desc: dated stays first (newest → oldest), undated sink to the end.
      const ad = stayEpochDay(a.stay);
      const bd = stayEpochDay(b.stay);
      if (ad === null && bd === null) return byName(a.stay, b.stay);
      if (ad === null) return 1;
      if (bd === null) return -1;
      return bd - ad || byName(a.stay, b.stay);
    });
  }, [stays, sort, locale]);

  /** Running spend grouped by currency (never summed across — no FX offline). */
  const totalsByCurrency = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const stay of stays ?? []) {
      if (!stay.cost) continue;
      totals[stay.cost.currency] = (totals[stay.cost.currency] ?? 0) + stay.cost.amount;
    }
    // Largest first so the headline currency leads.
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [stays]);

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'date', label: t('diary.sortDate', 'Date') },
    { key: 'cost', label: t('diary.sortCost', 'Cost') },
    { key: 'name', label: t('diary.sortName', 'Name') },
  ];

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>{t('diary.title', 'Diary')}</h2>
          <div className="sub">{t('diary.sub', 'Places & stays, with cost')}</div>
        </div>
      </div>
      <div className="panel-body">
        {totalsByCurrency.length > 0 && (
          <div className="stay-totals">
            <span className="stay-totals-label">{t('diary.total', 'Total')}</span>
            <div className="stay-totals-list">
              {totalsByCurrency.map(([currency, amount]) => (
                <span key={currency} className="stay-total-chip">
                  {formatMoney(amount, currency, locale)}
                </span>
              ))}
            </div>
          </div>
        )}

        {(stays?.length ?? 0) > 1 && (
          <div className="stay-sort" role="group" aria-label={t('diary.sortBy', 'Sort by')}>
            <span className="stay-sort-label">{t('diary.sortBy', 'Sort by')}</span>
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`btn btn-sm${sort === opt.key ? '' : ' btn-ghost'}`}
                aria-pressed={sort === opt.key}
                onClick={() => setSort(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {(!stays || stays.length === 0) && (
          <p className="empty-note">
            {t('diary.empty', 'No stays yet — log a hotel or place you stayed.')}
          </p>
        )}

        <div className="city-list">
          {ordered.map(({ stay, index }) => (
            <StayRow
              key={index}
              stay={stay}
              locale={locale}
              onChange={(next) => setStay(index, next)}
              onRemove={() => removeStay(index)}
            />
          ))}
        </div>

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

/**
 * Convert a stored timeline string to the value an HTML5 month input expects
 * (`YYYY-MM`). A bare year becomes its January; a full date keeps its month; a
 * range (or junk) yields '' so the native control stays empty rather than
 * showing an invalid value.
 */
function toMonthInput(value: string): string {
  const s = value.trim();
  if (RE_YEAR_MONTH.test(s)) return s;
  if (RE_YEAR.test(s)) return `${s}-01`;
  if (RE_YEAR_MONTH_DAY.test(s)) return s.slice(0, 7);
  return '';
}

function StayRow({
  stay,
  locale,
  onChange,
  onRemove,
}: {
  stay: Stay;
  locale: string;
  onChange: (s: Stay) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(stay.name);
  const [country, setCountry] = useState(stay.country ?? '');
  const [city, setCity] = useState(stay.city ?? '');
  const [from, setFrom] = useState(stay.from ?? '');
  const [to, setTo] = useState(stay.to ?? '');
  const [amount, setAmount] = useState(stay.cost ? (stay.cost.amount / 100).toString() : '');
  const [currency, setCurrency] = useState(stay.cost?.currency ?? '');
  const [note, setNote] = useState(stay.note ?? '');

  // Re-sync local drafts when the stay changes from elsewhere (undo/redo, import).
  // Money is split across two coupled drafts (amount + currency): a partial entry
  // (amount typed before a currency, or vice versa) doesn't yet form a valid cost
  // and so isn't committed — we must NOT let the resync from that interim commit
  // wipe the half the user already typed. So we only overwrite the money drafts
  // when the incoming committed cost genuinely differs from what they project to.
  useEffect(() => {
    setName(stay.name);
    setCountry(stay.country ?? '');
    setCity(stay.city ?? '');
    setFrom(stay.from ?? '');
    setTo(stay.to ?? '');
    setNote(stay.note ?? '');
    setAmount((draft) => {
      const projected = stay.cost ? (stay.cost.amount / 100).toString() : '';
      const draftMinor = Math.round(Number.parseFloat(draft) * 100);
      const stillTyping = !stay.cost && draft !== '' && Number.isFinite(draftMinor);
      const matches = stay.cost && draftMinor === stay.cost.amount;
      return stillTyping || matches ? draft : projected;
    });
    setCurrency((draft) => {
      const incoming = stay.cost?.currency ?? '';
      // Keep an in-progress code when no cost is committed yet; otherwise sync.
      if (!stay.cost && draft) return draft;
      return draft === incoming ? draft : incoming;
    });
  }, [stay]);

  /**
   * Currency options: the static majors, deduped against whatever code the stay
   * already holds (so a custom/legacy code still appears selected in the list).
   */
  const currencyOptions = useMemo<ComboboxOption[]>(() => {
    const codes = new Set<string>(COMMON_CURRENCIES);
    if (currency && /^[A-Z]{3}$/.test(currency)) codes.add(currency);
    return [...codes].map((code) => ({ value: code, label: currencyLabel(code, locale) }));
  }, [currency, locale]);

  /** Build a clean Stay from the drafts and commit it (omitting empty fields). */
  const commit = (overrides?: Partial<Record<'country' | 'currency', string>>) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setName(stay.name); // a stay must keep a name
      return;
    }
    const nextCountry = (overrides?.country ?? country).trim();
    const nextCurrency = (overrides?.currency ?? currency).trim().toUpperCase();

    const next: Stay = { name: trimmedName };
    if (nextCountry) next.country = nextCountry;
    if (city.trim()) next.city = city.trim();
    if (from.trim()) next.from = from.trim();
    if (to.trim()) next.to = to.trim();
    if (note.trim()) next.note = note.trim();
    const amt = Number.parseFloat(amount);
    if (Number.isFinite(amt) && amt >= 0 && /^[A-Z]{3}$/.test(nextCurrency)) {
      next.cost = { amount: Math.round(amt * 100), currency: nextCurrency };
    }
    onChange(next);
  };

  // The computed summary uses the committed `stay`, so it reflects saved state.
  const nights = nightsForStay(stay);
  const costText = stay.cost ? formatMoney(stay.cost.amount, stay.cost.currency, locale) : null;

  return (
    <div className="city-card stay-card">
      <div className="city-head">
        {country && <Flag name={country} size={22} />}
        <input
          className="city-name-in"
          value={name}
          aria-label={t('diary.namePlaceholder', 'Hotel / place name')}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => commit()}
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

      <div className="stay-fields">
        <label className="stay-field stay-field--country">
          <span className="stay-field-label">{t('diary.country', 'Country')}</span>
          <CountrySelect
            value={country}
            ariaLabel={t('diary.country', 'Country')}
            onChange={(next) => {
              setCountry(next);
              // Combobox has no blur event we can rely on; commit on selection.
              commit({ country: next });
            }}
          />
        </label>

        <label className="stay-field stay-field--city">
          <span className="stay-field-label">{t('diary.city', 'City')}</span>
          <input
            className="input"
            value={city}
            placeholder={t('diary.city', 'City')}
            aria-label={t('diary.city', 'City')}
            onChange={(e) => setCity(e.target.value)}
            onBlur={() => commit()}
          />
        </label>

        <label className="stay-field stay-field--date">
          <span className="stay-field-label">{t('diary.from', 'From')}</span>
          <input
            className="input"
            type="month"
            value={toMonthInput(from)}
            aria-label={t('diary.from', 'From')}
            onChange={(e) => setFrom(e.target.value)}
            onBlur={() => commit()}
          />
        </label>

        <label className="stay-field stay-field--date">
          <span className="stay-field-label">{t('diary.to', 'To')}</span>
          <input
            className="input"
            type="month"
            value={toMonthInput(to)}
            aria-label={t('diary.to', 'To')}
            onChange={(e) => setTo(e.target.value)}
            onBlur={() => commit()}
          />
        </label>

        <label className="stay-field stay-field--amount">
          <span className="stay-field-label">{t('diary.cost', 'Cost')}</span>
          <input
            className="input mono"
            type="number"
            inputMode="decimal"
            min={0}
            value={amount}
            placeholder={t('diary.cost', 'Cost')}
            aria-label={t('diary.cost', 'Cost')}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => commit()}
          />
        </label>

        <label className="stay-field stay-field--currency">
          <span className="stay-field-label">{t('diary.currency', 'Currency')}</span>
          <div className="stay-currency">
            <Combobox
              value={currency}
              options={currencyOptions}
              placeholder={t('diary.currencyPlaceholder', 'Currency')}
              searchPlaceholder={t('diary.currencySearch', 'Search a code…')}
              emptyText={t('diary.currencyEmpty', 'No match — type it on the right')}
              ariaLabel={t('diary.currency', 'Currency')}
              onChange={(next) => {
                const code = next.trim().toUpperCase().slice(0, 3);
                setCurrency(code);
                commit({ currency: code });
              }}
            />
            {/* Fallback: a manual 3-letter code for any currency not in the list. */}
            <input
              className="input mono stay-currency-manual"
              maxLength={3}
              value={currency}
              placeholder={t('diary.currencyManualPlaceholder', 'ISO')}
              aria-label={t('diary.currencyManual', 'Currency code')}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              onBlur={() => commit()}
            />
          </div>
        </label>
      </div>

      <input
        className="input stay-note"
        value={note}
        placeholder={t('diary.note', 'Note (optional)')}
        aria-label={t('diary.note', 'Note (optional)')}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => commit()}
      />

      {(nights !== null || costText) && (
        <div className="stay-summary">
          {nights !== null && (
            <span className="stay-summary-item">
              {t('diary.nights', '{{count}} nights', { count: nights })}
            </span>
          )}
          {costText && <span className="stay-summary-item stay-summary-cost">{costText}</span>}
        </div>
      )}
    </div>
  );
}
