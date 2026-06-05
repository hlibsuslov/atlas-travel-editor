import { useTranslation } from 'react-i18next';
import { LOCALES } from '@/i18n';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = LOCALES.find((l) => i18n.resolvedLanguage === l.code)?.code ?? 'en';

  return (
    <label className="lang-switch" title={t('common.language')}>
      <span className="sr-only">{t('common.language')}</span>
      <select
        className="lang-select"
        value={current}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        aria-label={t('common.language')}
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
