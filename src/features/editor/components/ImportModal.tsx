import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeTravelData } from '@/domain/normalize';
import type { TravelData } from '@/domain/schema';
import { useFocusTrap } from '@/lib/useFocusTrap';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: TravelData) => void;
}

export function ImportModal({ open, onClose, onImport }: ImportModalProps) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Trap focus within the dialog and restore it to the trigger on close.
  useFocusTrap(open, cardRef);

  // Close on Escape for keyboard accessibility.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tryParse = () => {
    try {
      const parsed: unknown = JSON.parse(raw);
      onImport(normalizeTravelData(parsed));
      setRaw('');
      setError(null);
      onClose();
    } catch (err) {
      setError(
        t('import.failed', { message: err instanceof Error ? err.message : 'invalid JSON' }),
      );
    }
  };

  return (
    <div
      className="modal show"
      role="dialog"
      aria-modal="true"
      aria-labelledby="importTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" ref={cardRef}>
        <div className="panel-header" style={{ border: 'none', padding: '0 0 12px 0' }}>
          <strong id="importTitle">{t('import.title')}</strong>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <textarea
            placeholder={t('import.placeholder')}
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              if (error) setError(null);
            }}
            autoFocus
          />
          {error && <p className="helper-error">{error}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={tryParse}>
              {t('actions.load')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
