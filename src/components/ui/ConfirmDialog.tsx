import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/lib/useFocusTrap';

interface ConfirmDialogProps {
  open: boolean;
  /** Dialog title; shown as the accessible name via aria-labelledby. */
  title: string;
  /** Body message describing what is being confirmed. */
  message: string;
  /** Optional custom label for the confirm button (defaults to confirm.confirm). */
  confirmLabel?: string;
  /** Optional custom label for the cancel button (defaults to confirm.cancel). */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Accessible confirmation modal styled with the Atlas `.modal`/`.modal-card`
 * classes. Replaces the native `confirm()` dialog with something that supports
 * keyboard navigation, focus management and screen readers.
 *
 * - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` for the title.
 * - Escape cancels.
 * - Clicking the backdrop cancels.
 * - Initial focus moves to the Cancel button when opened (the safe default).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Trap focus within the dialog and restore it to the trigger on close.
  useFocusTrap(open, cardRef);

  // Close on Escape for keyboard accessibility.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  // Move initial focus to the (safe) Cancel button when the dialog opens.
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal show"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal-card" ref={cardRef}>
        <div className="panel-header" style={{ border: 'none', padding: '0 0 12px 0' }}>
          <strong id={titleId}>{title}</strong>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <p>{message}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn-sm" ref={cancelRef} onClick={onCancel}>
              {cancelLabel ?? t('confirm.cancel')}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onConfirm}>
              {confirmLabel ?? t('confirm.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
