import { useTranslation } from 'react-i18next';
import { MapPinned } from 'lucide-react';
import { CountrySelect } from './CountrySelect';

interface EditorEmptyStateProps {
  /** Add (or focus) a country by its canonical English name. */
  onAddCountry: (name: string) => void;
  /** Replace the document with the richer illustrative sample. */
  onLoadSample: () => void;
  /** Open the import flow. */
  onImport: () => void;
}

/**
 * Friendly empty state shown in the editor when the document genuinely has no
 * countries (and no active filter). Mirrors MapEmptyState's panel pattern and
 * offers the three natural first moves: add your first country, load the sample,
 * or import existing data. All copy goes through i18n with inline defaults.
 */
export function EditorEmptyState({ onAddCountry, onLoadSample, onImport }: EditorEmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="editor-empty" role="status" aria-live="polite">
      <MapPinned size={32} aria-hidden="true" />
      <h3 className="editor-empty-title">
        {t('editor.emptyTitle', { defaultValue: 'No countries yet' })}
      </h3>
      <p className="empty-note">
        {t('editor.emptyBody', {
          defaultValue:
            'Add the first country you have visited, load a sample to explore, or import your existing travel data.',
        })}
      </p>
      <div className="editor-empty-add">
        <span className="field-label">
          {t('editor.emptyAddFirst', { defaultValue: 'Add your first country' })}
        </span>
        <CountrySelect
          value=""
          onChange={onAddCountry}
          ariaLabel={t('editor.emptyAddFirst', { defaultValue: 'Add your first country' })}
        />
      </div>
      <div className="editor-empty-actions">
        <button className="btn btn-sm" type="button" onClick={onLoadSample}>
          {t('editor.emptyLoadSample', { defaultValue: 'Load sample' })}
        </button>
        <button className="btn btn-sm btn-ghost" type="button" onClick={onImport}>
          {t('editor.emptyImport', { defaultValue: 'Import data' })}
        </button>
      </div>
    </div>
  );
}
