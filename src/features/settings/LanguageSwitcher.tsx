import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
import { LOCALES } from '@/i18n';

/** Custom, design-matched language picker (searchable, native names). */
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = LOCALES.find((l) => i18n.resolvedLanguage === l.code)?.code ?? 'en';

  const options = useMemo<ComboboxOption[]>(
    () => LOCALES.map((l) => ({ value: l.code, label: l.label })),
    [],
  );

  return (
    <div className="lang-switch" title={t('common.language')}>
      <span className="lang-switch-icon" aria-hidden="true">
        <Languages size={15} />
      </span>
      <Combobox
        value={current}
        options={options}
        onChange={(code) => void i18n.changeLanguage(code)}
        ariaLabel={t('common.language')}
        searchPlaceholder={t('common.language')}
      />
    </div>
  );
}
