import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
 * Compact editor for the user's public identity (name + avatar color) — the
 * face friends see on shared maps. Lives on the Friends page since that's the
 * social hub; there is no separate settings route.
 */
export function ProfileEditor() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['my-profile'], queryFn: getMyProfile });

  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]!);
  const [handle, setHandle] = useState('');
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

  return (
    <div className="panel profile-editor">
      <div className="panel-head">
        <div>
          <h2>{t('profile.title')}</h2>
          <div className="sub">{t('profile.subtitle')}</div>
        </div>
      </div>
      <div className="panel-body profile-editor-body">
        <div className="friend-av profile-av" style={{ background: color }}>
          {initials(name || t('profile.namePlaceholder'))}
        </div>
        <div className="profile-fields">
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
                  aria-label={c}
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
        </div>
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
  );
}
