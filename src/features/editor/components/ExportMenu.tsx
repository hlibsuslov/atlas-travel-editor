import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  ChevronDown,
  Cloud,
  Copy,
  Download,
  HardDrive,
  Mail,
  Send,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { TravelData } from '@/domain/schema';
import { downloadText } from '@/lib/download';
import { useStorage } from '@/features/storage/StorageProvider';
import type { StoreId } from '@/lib/storage/types';

/**
 * Save / export menu. Local actions (download, copy) work today; cloud
 * destinations are scaffolded behind a single `connect()` path so wiring a real
 * provider later is one function — the registry below is the extension point for
 * "a hundred convenient places to save".
 */
interface CloudTarget {
  id: string;
  label: string;
}

// Extensible registry of cloud destinations (scaffold — see connect()).
const CLOUD_TARGETS: CloudTarget[] = [
  { id: 'google-drive', label: 'Google Drive' },
  { id: 'dropbox', label: 'Dropbox' },
  { id: 'onedrive', label: 'OneDrive' },
  { id: 'icloud', label: 'iCloud Drive' },
  { id: 'box', label: 'Box' },
  { id: 'github-gist', label: 'GitHub Gist' },
  { id: 'notion', label: 'Notion' },
  { id: 'webdav', label: 'WebDAV' },
  { id: 's3', label: 'Amazon S3' },
  { id: 'telegram', label: 'Telegram' },
];

export function ExportMenu({ data }: { data: TravelData }) {
  const { t } = useTranslation();
  const { stores, activeId, setActive } = useStorage();
  const [open, setOpen] = useState(false);
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

  const json = () => JSON.stringify(data, null, 2);

  const download = () => {
    downloadText('travel-data.json', json());
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

  const connect = (target: CloudTarget) => {
    // Scaffold: a real integration would open the provider's OAuth/picker here.
    toast(t('export.soon', { target: target.label }));
    setOpen(false);
  };

  // Switch the active storage backend (where the editor loads/saves). Ready
  // stores activate immediately; not-yet-implemented ones show a "coming soon".
  const chooseStore = (id: StoreId, label: string, ready: boolean) => {
    if (!ready) {
      toast(t('export.soon', { target: label }));
      return;
    }
    if (id !== activeId) {
      setActive(id);
      toast.success(t('storage.switched', 'Now saving to {{target}}', { target: label }));
    }
    setOpen(false);
  };

  const iconFor = (id: string) => {
    if (id === 'google-drive' || id === 'icloud' || id === 'dropbox' || id === 'onedrive')
      return <HardDrive size={15} />;
    if (id === 'telegram') return <Send size={15} />;
    if (id === 'github-gist') return <Share2 size={15} />;
    return <Cloud size={15} />;
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
        <div className="export-popover" role="menu">
          <div className="export-group-label">
            {t('storage.destination', 'Storage destination')}
          </div>
          {stores.map((store) => (
            <button
              key={store.id}
              type="button"
              className="export-item"
              role="menuitemradio"
              aria-checked={store.id === activeId}
              disabled={store.id === activeId}
              onClick={() => chooseStore(store.id, store.label, store.ready)}
            >
              <HardDrive size={15} /> {store.label}
              {store.id === activeId && <Check size={15} />}
              {!store.ready && <span className="export-soon">{t('export.soonBadge')}</span>}
            </button>
          ))}

          <div className="export-group-label">{t('export.local')}</div>
          <button type="button" className="export-item" role="menuitem" onClick={download}>
            <Download size={15} /> {t('export.download')}
          </button>
          <button type="button" className="export-item" role="menuitem" onClick={copy}>
            <Copy size={15} /> {t('export.copy')}
          </button>
          <button
            type="button"
            className="export-item"
            role="menuitem"
            onClick={() => connect({ id: 'email', label: 'Email' })}
          >
            <Mail size={15} /> {t('export.email')}
          </button>

          <div className="export-group-label">{t('export.connect')}</div>
          {CLOUD_TARGETS.map((target) => (
            <button
              key={target.id}
              type="button"
              className="export-item"
              role="menuitem"
              onClick={() => connect(target)}
            >
              {iconFor(target.id)} {target.label}
              <span className="export-soon">{t('export.soonBadge')}</span>
            </button>
          ))}
          <div className="export-foot">{t('export.more')}</div>
        </div>
      )}
    </div>
  );
}
