import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, Server } from 'lucide-react';
import { atlasHealth, atlasLogout, getAtlasUrl, setAtlasUrl } from '@/lib/atlas/client';
import { setActiveStore } from '@/lib/storage/registry';

/**
 * Connect / disconnect a self-hostable Atlas Server. Connecting validates the URL
 * via `/healthz`, persists the choice, makes the SelfHostStore active, and reloads
 * so the whole app re-reads a consistent (now server-backed) mode — after which the
 * login wall appears for the user to sign in. The web app stays fully usable with
 * no server connected; this is purely opt-in.
 */
export function AtlasConnect() {
  const { t } = useTranslation();
  const current = getAtlasUrl();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const connect = async () => {
    const clean = url.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(clean)) {
      setError(t('atlas.invalidUrl', 'Enter a valid http(s) URL.'));
      return;
    }
    setBusy(true);
    setError('');
    setAtlasUrl(clean);
    const health = await atlasHealth();
    if (!health?.ok) {
      setAtlasUrl(current); // restore the previous setting
      setBusy(false);
      setError(t('atlas.unreachable', "Couldn't reach that server."));
      return;
    }
    setActiveStore('selfhost');
    window.location.reload();
  };

  const disconnect = async () => {
    setBusy(true);
    await atlasLogout();
    setAtlasUrl(null);
    setActiveStore('indexeddb');
    window.location.reload();
  };

  if (current) {
    return (
      <div className="atlas-connect">
        <span className="helper">
          <Server size={13} /> {t('atlas.connectedTo', 'Connected to')} {current}
        </span>
        <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={disconnect}>
          <LogOut size={13} /> {t('atlas.disconnect', 'Disconnect')}
        </button>
      </div>
    );
  }

  return (
    <div className="atlas-connect">
      <input
        className="input"
        placeholder="https://atlas.example.com"
        value={url}
        aria-label={t('atlas.serverUrl', 'Atlas Server URL')}
        onChange={(e) => {
          setUrl(e.target.value);
          if (error) setError('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && url.trim()) {
            e.preventDefault();
            void connect();
          }
        }}
      />
      <button type="button" className="btn btn-sm" disabled={busy || !url.trim()} onClick={connect}>
        <Server size={13} /> {t('atlas.connect', 'Connect server')}
      </button>
      {error && <p className="empty-note field-error">{error}</p>}
    </div>
  );
}
