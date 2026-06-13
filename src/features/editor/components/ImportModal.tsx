import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, FileJson, UploadCloud, X } from 'lucide-react';
import { type TravelData } from '@/domain/schema';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { useImportPreview } from '@/features/editor/hooks/useImportPreview';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: TravelData) => void;
}

export function ImportModal({ open, onClose, onImport }: ImportModalProps) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState('');
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

  const load = () => {
    if (preview.state === 'ok' || preview.state === 'warn') {
      onImport(preview.data);
      setRaw('');
      onClose();
    }
  };

  const canLoad = preview.state === 'ok' || preview.state === 'warn';

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
        </div>
      </div>
    </div>
  );
}
