import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Plus } from 'lucide-react';
import { addFriend, listFriends, removeFriend, type FriendLink } from './api';
import { fetchPublicRecord } from '@/features/editor/api';
import { fetchSharedProfile } from '@/features/profile/api';
import { ProfileEditor } from '@/features/profile/ProfileEditor';
import { computeStats, primaryStatus } from '@/domain/stats';
import { MiniMap } from '@/features/map/WorldMap';

function initials(s: string): string {
  return s
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function FriendsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');

  const friends = useQuery({ queryKey: ['friends'], queryFn: listFriends });

  const add = useMutation({
    mutationFn: (value: string) => addFriend(value),
    onSuccess: () => {
      setCode('');
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFriend(id),
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
        <form className="toolbar" onSubmit={onSubmit}>
          <input
            className="input mono"
            style={{ width: 180 }}
            value={code}
            placeholder={t('friends.addPlaceholder')}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={add.isPending}>
            <Plus size={14} /> {t('friends.add')}
          </button>
        </form>
      </div>

      <ProfileEditor />

      {friends.isLoading && <p className="empty-note">{t('common.loading')}</p>}
      {friends.data && friends.data.length === 0 && (
        <p className="empty-note">{t('friends.empty')}</p>
      )}

      <div className="friends-grid">
        {friends.data?.map((f) => (
          <FriendCard key={f.id} friend={f} onRemove={() => remove.mutate(f.id)} />
        ))}
      </div>
    </div>
  );
}

function FriendCard({ friend, onRemove }: { friend: FriendLink; onRemove: () => void }) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['public-record', friend.slug],
    queryFn: () => fetchPublicRecord(friend.slug),
  });
  const { data: profile } = useQuery({
    queryKey: ['shared-profile', friend.slug],
    queryFn: () => fetchSharedProfile(friend.slug),
  });

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
  // Prefer the user's own nickname, then the owner's public display name, then
  // the raw slug as a last resort.
  const label = friend.label || profile?.display_name || friend.slug;
  const avatarColor = profile?.accent_color || 'var(--accent)';

  return (
    <div className="friend-card">
      <div className="friend-head">
        <div className="friend-av" style={{ background: avatarColor }}>
          {initials(label)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="friend-name">{label}</div>
          <div className="friend-code">{friend.slug}</div>
        </div>
        <button
          className="btn btn-sm btn-ghost"
          aria-label={t('friends.remove')}
          onClick={onRemove}
        >
          ×
        </button>
      </div>

      <Link to={`/share/${friend.slug}`} className="friend-mini" aria-label={t('friends.viewMap')}>
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

      <Link to={`/share/${friend.slug}`} className="btn btn-sm btn-block">
        {t('friends.viewMap')} <ArrowRight size={14} />
      </Link>
    </div>
  );
}
