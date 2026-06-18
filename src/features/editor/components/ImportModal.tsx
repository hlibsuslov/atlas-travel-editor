import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, FileJson, ListPlus, UploadCloud, X } from 'lucide-react';
import { type Country, type TravelData } from '@/domain/schema';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { useImportPreview } from '@/features/editor/hooks/useImportPreview';
import { parseCountryList } from '@/features/editor/lib/parseCountryList';
import { useEditorStore } from '@/features/editor/store';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: TravelData) => void;
}

type ImportMode = 'json' | 'list';
type JsonMode = 'replace' | 'merge';

export function ImportModal({ open, onClose, onImport }: ImportModalProps) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState('');
  const [mode, setMode] = useState<ImportMode>('json');
  const [jsonMode, setJsonMode] = useState<JsonMode>('replace');
  const [dragging, setDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useFocusTrap(open, cardRef);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const preview = useImportPreview(raw);
  const list = useMemo(() => parseCountryList(raw), [raw]);

  if (!open) return null;

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setRaw(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const close = () => {
    setRaw('');
    onClose();
  };

  /** Append/merge countries into the document as one undo step (store-core action). */
  const mergeCountries = (countries: Country[]) =>
    useEditorStore.getState().mergeCountries(countries);

  const load = () => {
    if (preview.state !== 'ok' && preview.state !== 'warn') return;
    // Replace swaps the whole document; merge folds the imported countries in.
    if (jsonMode === 'merge') mergeCountries(preview.data.travel.countries);
    else onImport(preview.data);
    close();
  };

  const addList = () => {
    if (list.resolved.length === 0) return;
    mergeCountries(list.resolved);
    close();
  };

  const canLoad = preview.state === 'ok' || preview.state === 'warn';
  const cityCount = list.resolved.reduce((sum, c) => sum + c.cities.length, 0);

  return (
    <div
      className="modal show"
      role="dialog"
      aria-modal="true"
      aria-labelledby="importTitle"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-card import-card" ref={cardRef}>
        <div className="panel-head">
          <h2 id="importTitle">{t('import.title')}</h2>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>

        <div className="panel-body import-body">
          <div className="btn-group" role="tablist" aria-label={t('import.title')}>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'json'}
              className={`btn btn-sm ${mode === 'json' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('json')}
            >
              <FileJson size={13} /> {t('import.tabJson', 'JSON')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'list'}
              className={`btn btn-sm ${mode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMode('list')}
            >
              <ListPlus size={13} /> {t('import.tabList', 'Paste list')}
            </button>
          </div>

          {mode === 'json' ? (
            <>
              <button
                type="button"
                className={`import-drop${dragging ? ' is-dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <UploadCloud size={26} />
                <div>
                  <strong>{t('import.dropTitle')}</strong>
                  <div className="helper">{t('import.dropHint')}</div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readFile(f);
                  }}
                />
              </button>

              <div className="import-or kicker">{t('auth.or')}</div>

              <textarea
                className="input mono"
                placeholder={t('import.placeholder')}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                aria-label={t('import.title')}
              />

              <div className="import-preview" aria-live="polite">
                {preview.state === 'parse' && (
                  <span className="pill pill-bad">
                    <span className="dot" /> {t('import.failed', { message: preview.message })}
                  </span>
                )}
                {preview.state === 'warn' && (
                  <>
                    <span className="pill pill-warn">
                      <FileJson size={12} />{' '}
                      {t('import.summary', {
                        countries: preview.countries,
                        cities: preview.cities,
                      })}
                    </span>
                    {preview.firstError && <span className="helper">{preview.firstError}</span>}
                  </>
                )}
                {preview.state === 'ok' && (
                  <span className="pill pill-ok">
                    <CheckCircle2 size={12} />{' '}
                    {t('import.summary', {
                      countries: preview.countries,
                      cities: preview.cities,
                    })}
                  </span>
                )}
              </div>

              <div className="import-preview">
                <span className="helper">{t('import.applyAs', 'Apply as')}</span>
                <div
                  className="btn-group"
                  role="group"
                  aria-label={t('import.applyAs', 'Apply as')}
                >
                  <button
                    type="button"
                    aria-pressed={jsonMode === 'replace'}
                    className={`btn btn-sm ${jsonMode === 'replace' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setJsonMode('replace')}
                  >
                    {t('import.replace', 'Replace')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={jsonMode === 'merge'}
                    className={`btn btn-sm ${jsonMode === 'merge' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setJsonMode('merge')}
                  >
                    {t('import.merge', 'Merge')}
                  </button>
                </div>
              </div>

              <div className="import-actions">
                <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
                  {t('common.close')}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={!canLoad}
                  onClick={load}
                >
                  {t('actions.load')}
                </button>
              </div>
            </>
          ) : (
            <>
              <textarea
                className="input mono"
                placeholder={t(
                  'import.listPlaceholder',
                  'One country per line, e.g.\nSpain: Madrid 2019, Barcelona 2021\nFrance\nJapan: Tokyo 2023',
                )}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                aria-label={t('import.tabList', 'Paste list')}
              />

              <div className="import-preview" aria-live="polite">
                {(list.resolved.length > 0 || list.unmatched.length > 0) && (
                  <span className={`pill ${list.unmatched.length > 0 ? 'pill-warn' : 'pill-ok'}`}>
                    <ListPlus size={12} />{' '}
                    {t('import.listSummary', {
                      resolved: list.resolved.length,
                      unmatched: list.unmatched.length,
                      defaultValue: '{{resolved}} resolved · {{unmatched}} unmatched',
                    })}
                  </span>
                )}
                {cityCount > 0 && (
                  <span className="helper">
                    {t('import.listCities', {
                      cities: cityCount,
                      defaultValue: '{{cities}} cities',
                    })}
                  </span>
                )}
              </div>

              {list.unmatched.length > 0 && (
                <div className="helper">
                  <strong>{t('import.unmatchedTitle', "Couldn't match:")}</strong>{' '}
                  {list.unmatched.join(', ')}
                </div>
              )}

              <div className="import-actions">
                <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
                  {t('common.close')}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={list.resolved.length === 0}
                  onClick={addList}
                >
                  {t('actions.add')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
