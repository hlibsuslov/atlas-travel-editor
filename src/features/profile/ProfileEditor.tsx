import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy } from 'lucide-react';
import { getAtlasUrl } from '@/lib/atlas/client';
import { getMyProfile, saveMyProfile } from './api';

/** Palette of CSP-safe avatar accent colors (drawn from the design tokens). */
const COLORS = ['#2f6df0', '#1f9d6b', '#e8943a', '#9b59b6', '#e0506b', '#0e7c86'];

function initials(s: string): string {
  return (
    s
      .split(/[\s-]+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '—'
  );
}

/**
 * Editor for the user's public identity (name + avatar color + optional handle) —
 * the face friends see on shared maps. Lives on the Friends page since that's the
 * social hub; there is no separate settings route. A live preview card mirrors
 * exactly what others will see, and once a handle is claimed the public address is
 * surfaced with a copy button.
 */
export function ProfileEditor() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['my-profile'], queryFn: getMyProfile });

  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]!);
  const [handle, setHandle] = useState('');
  const [copied, setCopied] = useState(false);
  const connected = !!getAtlasUrl();

  // Hydrate the form once the saved profile arrives.
  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.display_name);
    if (profile.data.accent_color) setColor(profile.data.accent_color);
    setHandle(profile.data.public_handle ?? '');
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => saveMyProfile(name, color, handle.trim().toLowerCase() || null),
    onSuccess: (saved) => {
      queryClient.setQueryData(['my-profile'], saved);
      toast.success(t('profile.saved'));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  // The full public address is only meaningful once a handle is SAVED (the live
  // typed handle may not be claimed yet), so build it from the persisted profile.
  const savedHandle = profile.data?.public_handle ?? null;
  const publicUrl = useMemo(
    () => (savedHandle ? `${window.location.origin}/u/${savedHandle}` : null),
    [savedHandle],
  );

  const copyAddress = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t('profile.copyFailed', 'Could not copy the link.'));
    }
  };

  const previewName = name || t('profile.namePlaceholder');

  return (
    <div className="panel profile-editor">
      <div className="panel-head">
        <div>
          <h2>{t('profile.title')}</h2>
          <div className="sub">{t('profile.subtitle')}</div>
        </div>
      </div>
      <div className="panel-body">
        <div className="profile-grid">
          {/* Live preview — exactly what friends see on a shared map. */}
          <div className="profile-preview">
            <span className="preview-label">{t('profile.preview', 'Preview')}</span>
            <div className="friend-av profile-av" style={{ background: color }} aria-hidden="true">
              {initials(previewName)}
            </div>
            <div className="preview-name">{previewName}</div>
            {handle && <div className="preview-handle">@{handle}</div>}
          </div>

          <div className="profile-fields-col">
            <div className="field">
              <label className="field-label" htmlFor="profile-name">
                {t('profile.displayName')}
              </label>
              <input
                id="profile-name"
                className="input"
                value={name}
                maxLength={60}
                placeholder={t('profile.namePlaceholder')}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="field">
              <span className="field-label">{t('profile.color')}</span>
              <div className="color-swatches" role="radiogroup" aria-label={t('profile.color')}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch${c === color ? ' is-active' : ''}`}
                    style={{ background: c }}
                    role="radio"
                    aria-checked={c === color}
                    aria-label={t('profile.colorOption', {
                      color: c,
                      defaultValue: 'Accent colour {{color}}',
                    })}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="profile-handle">
                {t('profile.handle', 'Handle')}
              </label>
              <input
                id="profile-handle"
                className="input mono"
                value={handle}
                maxLength={30}
                placeholder="yourname"
                disabled={!connected}
                aria-describedby="profile-handle-hint"
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              />
              <span id="profile-handle-hint" className="helper">
                {connected
                  ? t('profile.handleHint', {
                      handle: handle || 'yourname',
                      defaultValue: 'Your public address: /u/{{handle}}',
                    })
                  : t('profile.serverNeeded', 'Connect an Atlas Server to claim a public handle.')}
              </span>
            </div>

            {/* Public address with a copy button — only once a handle is saved. */}
            {publicUrl && (
              <div className="field">
                <span className="field-label">{t('profile.publicAddress', 'Public address')}</span>
                <div className="profile-address">
                  <span className="address-url" title={publicUrl}>
                    {publicUrl}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={copyAddress}
                    aria-label={t('profile.copyAddress', 'Copy public address')}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? t('actions.copied', 'Copied!') : t('actions.copy', 'Copy')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="profile-actions">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {t('profile.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
