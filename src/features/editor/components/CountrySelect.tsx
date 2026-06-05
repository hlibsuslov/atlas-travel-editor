import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
import { countryOptions, localizedCountryName } from '@/domain/countries';

interface CountrySelectProps {
  value: string;
  onChange: (englishName: string) => void;
  ariaLabel?: string;
}

/**
 * Country picker: searchable, localized labels, stores the canonical English
 * name (so map matching stays exact). Falls back to showing whatever custom
 * value the document already holds if it isn't in the ISO list.
 */
export function CountrySelect({ value, onChange, ariaLabel }: CountrySelectProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en';

  const options = useMemo<ComboboxOption[]>(
    () => countryOptions(locale).map((c) => ({ value: c.value, label: c.label })),
    [locale],
  );

  // If the stored value isn't a known country (legacy/custom), surface it too.
  const withCustom = useMemo<ComboboxOption[]>(() => {
    if (value && !options.some((o) => o.value === value)) {
      return [{ value, label: localizedCountryName(value, locale) }, ...options];
    }
    return options;
  }, [options, value, locale]);

  return (
    <Combobox
      value={value}
      options={withCustom}
      onChange={onChange}
      placeholder={t('country.selectPlaceholder')}
      searchPlaceholder={t('country.searchPlaceholder')}
      emptyText={t('country.noMatches')}
      ariaLabel={ariaLabel ?? t('country.namePlaceholder')}
    />
  );
}
