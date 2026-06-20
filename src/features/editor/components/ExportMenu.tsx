import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Copy, Download, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import type { TravelData } from '@/domain/schema';
import { downloadText } from '@/lib/download';
import { wrapEnvelope } from '@/lib/storage/envelope';
import { useStorage } from '@/features/storage/StorageProvider';
import { AtlasConnect } from '@/features/storage/AtlasConnect';
import { getStoreById } from '@/lib/storage/registry';
import type { StoreId } from '@/lib/storage/types';

/**
 * Save / export menu. Local actions (download, copy) work today; the registry-
 * driven "Storage destination" list lets the user switch the backend the editor
 * loads/saves to. Picking a store that needs a connection grant (e.g. the local
 * file's `showSaveFilePicker`) runs its `connect()` here — inside the user
 * gesture — so the grant actually sticks.
 */

/** Was a click on a real picker the user cancelled? Treat as a no-op, not an error. */
function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export function ExportMenu({ data }: { data: TravelData }) {
  const { t } = useTranslation();
  const { stores, activeId, setActive } = useStorage();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<StoreId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Export the self-describing portable envelope ({app,schemaVersion,updatedAt,data})
  // so the file is forward-compatible and round-trips through import and the
  // file/IndexedDB stores without translation.
  const json = () => JSON.stringify(wrapEnvelope(data), null, 2);
  const exportFilename = () => `travel-data-${new Date().toISOString().slice(0, 10)}.json`;

  const download = () => {
    downloadText(exportFilename(), json());
    setOpen(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json());
      toast.success(t('toast.copied'));
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  // Switch the active storage backend (where the editor loads/saves). Ready stores
  // activate immediately; not-yet-implemented ones show a "coming soon" toast.
  // Stores that expose connect() (e.g. the local file picker) MUST run it inside
  // this click handler so the user gesture grants the FileSystemFileHandle; if the
  // user cancels the picker we revert to the previous active store.
  const chooseStore = async (id: StoreId, label: string, ready: boolean) => {
    if (!ready) {
      toast(t('export.soon', { target: label }));
      return;
    }
    if (id === activeId) {
      setOpen(false);
      return;
    }

    const previousId = activeId;
    setBusyId(id);
    setActive(id);
    try {
      const store = getStoreById(id);
      if (store?.connect) await store.connect();
      toast.success(t('storage.switched', 'Now saving to {{target}}', { target: label }));
      setOpen(false);
    } catch (err) {
      // User cancelled the picker — silently revert, no error.
      setActive(previousId);
      if (!isAbortError(err)) {
        toast.error(t('storage.connectFailed', 'Could not connect to {{target}}', { target: label }));
      }
    } finally {
      setBusyId(null);
    }
  };

  // Re-grant the local file handle (e.g. after a reload dropped the permission).
  const reconnect = async () => {
    const store = getStoreById('localfile');
    if (!store?.connect) return;
    setBusyId('localfile');
    try {
      await store.connect();
      toast.success(t('storage.connected', 'Connected'));
      setOpen(false);
    } catch (err) {
      if (!isAbortError(err)) {
        toast.error(
          t('storage.connectFailed', 'Could not connect to {{target}}', {
            target: t('export.local'),
          }),
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const localfileActive = activeId === 'localfile';

  return (
    <div className="export-menu" ref={rootRef}>
      <button
        type="button"
        className="btn btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Download size={14} /> {t('export.title')} <ChevronDown size={13} />
      </button>

      {open && (
        <div className="export-popover" role="menu">
          <div className="export-group-label">
            {t('storage.destination', 'Storage destination')}
          </div>
          {/* The self-hosted Atlas Server is connected via the form below, not as a
              one-click destination, since it needs a URL + account. */}
          {stores
            .filter((store) => store.id !== 'selfhost')
            .map((store) => (
              <button
                key={store.id}
                type="button"
                className="export-item"
                role="menuitemradio"
                aria-checked={store.id === activeId}
                disabled={store.id === activeId || busyId !== null}
                onClick={() => void chooseStore(store.id, store.label, store.ready)}
              >
                <HardDrive size={15} /> {store.label}
                {store.id === activeId && <Check size={15} />}
                {!store.ready && <span className="export-soon">{t('export.soonBadge')}</span>}
              </button>
            ))}
          {localfileActive && (
            <button
              type="button"
              className="export-item export-item--sub"
              role="menuitem"
              disabled={busyId !== null}
              onClick={() => void reconnect()}
            >
              {t('storage.reconnect', 'Reconnect file')}
            </button>
          )}
          <AtlasConnect />

          <div className="export-group-label">{t('export.local')}</div>
          <button type="button" className="export-item" role="menuitem" onClick={download}>
            <Download size={15} /> {t('export.download')}
          </button>
          <button type="button" className="export-item" role="menuitem" onClick={copy}>
            <Copy size={15} /> {t('export.copy')}
          </button>
        </div>
      )}
    </div>
  );
}
