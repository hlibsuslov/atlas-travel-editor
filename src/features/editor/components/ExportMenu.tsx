import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  ChevronDown,
  Cloud,
  Copy,
  Download,
  FolderOpen,
  HardDrive,
  RotateCw,
  Smartphone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { TravelData } from '@/domain/schema';
import { downloadText } from '@/lib/download';
import { wrapEnvelope } from '@/lib/storage/envelope';
import { useStorage } from '@/features/storage/StorageProvider';
import { AtlasConnect } from '@/features/storage/AtlasConnect';
import { getStoreById } from '@/lib/storage/registry';
import type { StoreId } from '@/lib/storage/types';

/**
 * Save / export menu, built on the shared `.atlas-pop*` popover system so it
 * matches every other floating menu in the app.
 *
 * The destination picker is honest about WHERE data lives: backends that never
 * leave the machine (IndexedDB, a local file) are grouped under "On this device";
 * backends that send the document to a server/cloud (the Atlas Server and the
 * coming-soon cloud providers) are grouped under "Sync to a server / cloud", each
 * with a one-line description. Picking a store that needs a connection grant
 * (e.g. the local file's `showSaveFilePicker`) runs its `connect()` here — inside
 * the user gesture — so the grant actually sticks.
 */

/** Was a click on a real picker the user cancelled? Treat as a no-op, not an error. */
function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/** Per-destination icon. Local stores get device/file icons; remote ones a cloud. */
const STORE_ICON: Partial<Record<StoreId, LucideIcon>> = {
  indexeddb: Smartphone,
  localfile: FolderOpen,
};

/** Honest one-line description of where a destination actually stores the data. */
const STORE_DESC: Record<StoreId, { key: string; fallback: string }> = {
  indexeddb: { key: 'storage.desc.indexeddb', fallback: 'Stays in this browser on this device. Private, offline.' },
  localfile: { key: 'storage.desc.localfile', fallback: 'Saved to a .json file you choose on your computer.' },
  selfhost: { key: 'storage.desc.selfhost', fallback: 'Synced to an Atlas Server you run. Enables sharing.' },
  gdrive: { key: 'storage.desc.gdrive', fallback: 'Synced to your Google Drive app folder.' },
  dropbox: { key: 'storage.desc.dropbox', fallback: 'Synced to your Dropbox app folder.' },
  webdav: { key: 'storage.desc.webdav', fallback: 'Synced to your WebDAV / Nextcloud server.' },
  github: { key: 'storage.desc.github', fallback: 'Committed to a GitHub repository you choose.' },
};

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

  // The self-hosted Atlas Server is connected via the form below, not as a
  // one-click destination, since it needs a URL + account.
  const pickable = stores.filter((s) => s.id !== 'selfhost');
  // Honest split: account-less = on this device; auth-requiring = leaves the device.
  const localStores = pickable.filter((s) => !s.capabilities.auth);
  const remoteStores = pickable.filter((s) => s.capabilities.auth);

  const destRow = (store: (typeof pickable)[number]) => {
    const Icon = STORE_ICON[store.id] ?? (store.capabilities.auth ? Cloud : HardDrive);
    const desc = STORE_DESC[store.id];
    const isActive = store.id === activeId;
    return (
      <button
        key={store.id}
        type="button"
        className={`atlas-pop-item export-dest${isActive ? ' is-active' : ''}`}
        role="menuitemradio"
        aria-checked={isActive}
        disabled={isActive || busyId !== null}
        onClick={() => void chooseStore(store.id, store.label, store.ready)}
      >
        <Icon className="export-dest-icon" size={17} aria-hidden="true" />
        <span className="export-dest-text">
          <span className="export-dest-name">{store.label}</span>
          {desc && <span className="export-dest-desc">{t(desc.key, desc.fallback)}</span>}
        </span>
        {isActive && <Check className="export-dest-check" size={16} aria-hidden="true" />}
        {!store.ready && <span className="export-soon-badge">{t('export.soonBadge')}</span>}
      </button>
    );
  };

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
        <div className="atlas-pop export-popover" role="menu">
          {/* --- On this device (local, never leaves the machine) ----------- */}
          <div className="atlas-pop-label">{t('storage.groupLocal', 'On this device')}</div>
          {localStores.map(destRow)}

          {/* --- Server / cloud (leaves the device when active) ------------- */}
          <hr className="atlas-pop-sep" />
          <div className="atlas-pop-label">{t('storage.groupRemote', 'Sync to a server / cloud')}</div>
          {/* The Atlas Server destination + its inline connect form. */}
          <div className="export-dest" style={{ padding: '8px 10px 2px' }}>
            <Cloud className="export-dest-icon" size={17} aria-hidden="true" />
            <span className="export-dest-text">
              <span className="export-dest-name">{t('storage.atlasServer', 'Atlas Server (self-hosted)')}</span>
              <span className="export-dest-desc">
                {t(STORE_DESC.selfhost.key, STORE_DESC.selfhost.fallback)}
              </span>
            </span>
          </div>
          <AtlasConnect />
          {remoteStores.map(destRow)}
          {localfileActive && (
            <button
              type="button"
              className="atlas-pop-item is-sub"
              role="menuitem"
              disabled={busyId !== null}
              onClick={() => void reconnect()}
            >
              <RotateCw size={14} aria-hidden="true" /> {t('storage.reconnect', 'Reconnect file')}
            </button>
          )}

          {/* --- One-off export (copy / download a snapshot) --------------- */}
          <hr className="atlas-pop-sep" />
          <div className="atlas-pop-label">{t('export.snapshot', 'Export a copy')}</div>
          <button type="button" className="atlas-pop-item" role="menuitem" onClick={download}>
            <Download size={15} aria-hidden="true" /> {t('export.download')}
          </button>
          <button type="button" className="atlas-pop-item" role="menuitem" onClick={copy}>
            <Copy size={15} aria-hidden="true" /> {t('export.copy')}
          </button>

          <p className="export-note">
            {t(
              'storage.honestyNote',
              'Atlas is local-first: your data lives on this device unless you connect a server or cloud above.',
            )}
          </p>
        </div>
      )}
    </div>
  );
}
