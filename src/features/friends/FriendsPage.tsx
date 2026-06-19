import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Plus } from 'lucide-react';
import { addFriend, listFriends, removeFriend, type FriendLink } from './api';
import { atlasGetPublic, atlasGetPublicByHandle, getAtlasUrl } from '@/lib/atlas/client';
import { ProfileEditor } from '@/features/profile/ProfileEditor';
import { normalizeTravelData } from '@/domain/normalize';
import { computeStats, primaryStatus } from '@/domain/stats';
import { MiniMap } from '@/features/map/WorldMap';

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

export function FriendsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const connected = !!getAtlasUrl();

  const friends = useQuery({ queryKey: ['friends'], queryFn: listFriends, enabled: connected });

  const add = useMutation({
    mutationFn: (value: string) => addFriend(value),
    onSuccess: () => {
      setCode('');
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const remove = useMutation({
    mutationFn: (handle: string | null) => removeFriend(handle),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['friends'] }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) add.mutate(code);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">{t('friends.kicker')}</div>
          <h1 className="page-title">{t('friends.title')}</h1>
          <p className="page-lede">{t('friends.subtitle')}</p>
        </div>
        {connected && (
          <form className="toolbar" onSubmit={onSubmit}>
            <input
              className="input mono"
              style={{ width: 200 }}
              value={code}
              placeholder={t('friends.addPlaceholder')}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={add.isPending}>
              <Plus size={14} /> {t('friends.add')}
            </button>
          </form>
        )}
      </div>

      <ProfileEditor />

      {!connected && (
        <p className="empty-note">
          {t(
            'friends.serverNeeded',
            'Following people needs a connected Atlas Server. This is a local-first instance.',
          )}
        </p>
      )}

      {connected && friends.isLoading && <p className="empty-note">{t('common.loading')}</p>}
      {connected && friends.data && friends.data.length === 0 && (
        <p className="empty-note">{t('friends.empty')}</p>
      )}

      <div className="friends-grid">
        {friends.data?.map((f) => (
          <FriendCard
            key={f.handle ?? f.share_slug ?? f.display_name}
            friend={f}
            onRemove={() => remove.mutate(f.handle)}
          />
        ))}
      </div>
    </div>
  );
}

function FriendCard({ friend, onRemove }: { friend: FriendLink; onRemove: () => void }) {
  const { t } = useTranslation();

  // The friend's public map: by their live slug, else by handle. The profile
  // (name + color) already came with the follow list — no extra fetch needed.
  const { data: view } = useQuery({
    queryKey: ['friend-map', friend.handle, friend.share_slug],
    queryFn: () =>
      friend.share_slug
        ? atlasGetPublic(friend.share_slug)
        : friend.handle
          ? atlasGetPublicByHandle(friend.handle)
          : Promise.resolve(null),
    enabled: !!(friend.share_slug || friend.handle),
  });

  const data = useMemo(() => (view ? normalizeTravelData(view.data) : null), [view]);
  const stats = useMemo(() => (data ? computeStats(data) : null), [data]);
  const lived = useMemo(
    () =>
      data
        ? data.travel.countries.filter(
            (c) => primaryStatus(c) === 'lived' || primaryStatus(c) === 'birthplace',
          ).length
        : 0,
    [data],
  );

  const label = friend.label || friend.display_name || friend.handle || '—';
  const href = friend.handle ? `/u/${friend.handle}` : `/share/${friend.share_slug ?? ''}`;

  return (
    <div className="friend-card">
      <div className="friend-head">
        <div className="friend-av" style={{ background: friend.accent_color || 'var(--accent)' }}>
          {initials(label)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="friend-name">{label}</div>
          <div className="friend-code">
            {friend.handle ? `@${friend.handle}` : friend.share_slug}
          </div>
        </div>
        <button
          className="btn btn-sm btn-ghost"
          aria-label={t('friends.remove')}
          onClick={onRemove}
        >
          ×
        </button>
      </div>

      <Link to={href} className="friend-mini" aria-label={t('friends.viewMap')}>
        {data ? <MiniMap data={data} /> : null}
      </Link>

      <div className="friend-stats">
        <div className="friend-stat">
          <div className="n">{stats?.traveled ?? '—'}</div>
          <div className="l">{t('friends.countriesLabel')}</div>
        </div>
        <div className="friend-stat">
          <div className="n">{data ? lived : '—'}</div>
          <div className="l">{t('country.lived')}</div>
        </div>
        <div className="friend-stat">
          <div className="n serif" style={{ fontStyle: 'italic', fontSize: 18 }}>
            {data?.person.birthplace.country || '—'}
          </div>
          <div className="l">{t('friends.homeBase')}</div>
        </div>
      </div>

      <Link to={href} className="btn btn-sm btn-block">
        {t('friends.viewMap')} <ArrowRight size={14} />
      </Link>
    </div>
  );
}
