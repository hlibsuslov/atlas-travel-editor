import { useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Plus } from 'lucide-react';
import {
  addFriend,
  discoverProfiles,
  feed,
  listFriends,
  removeFriend,
  type FriendLink,
} from './api';
import { atlasGetPublic, atlasGetPublicByHandle, getAtlasUrl } from '@/lib/atlas/client';
import { ProfileEditor } from '@/features/profile/ProfileEditor';
import { AtlasConnect } from '@/features/storage/AtlasConnect';
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

      {connected && <Discover />}
      {connected && <Feed />}

      {!connected && (
        <div className="panel">
          <div className="panel-head">
            <h2>{t('friends.connectTitle', 'Connect an Atlas Server')}</h2>
          </div>
          <div className="panel-body">
            <p className="empty-note" style={{ marginTop: 0 }}>
              {t(
                'friends.connectBody',
                'Atlas runs fully local-first — your map lives in this browser. Connecting an optional, self-hostable Atlas Server unlocks following people, a public @handle, and a feed of friends’ updates.',
              )}
            </p>
            <AtlasConnect />
          </div>
        </div>
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

const socialRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 0',
};
const socialAv: CSSProperties = { width: 28, height: 28, fontSize: 12 };

/** Search discoverable profiles and follow them. */
function Discover() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const results = useQuery({
    queryKey: ['discover', q],
    queryFn: () => discoverProfiles(q),
    enabled: q.trim().length >= 1,
  });
  const follow = useMutation({
    mutationFn: (handle: string) => addFriend(handle),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{t('discover.title', 'Discover people')}</h2>
      </div>
      <div className="panel-body">
        <input
          className="input"
          value={q}
          placeholder={t('discover.placeholder', 'Search by handle or name')}
          aria-label={t('discover.title', 'Discover people')}
          onChange={(e) => setQ(e.target.value)}
        />
        {results.data?.map((p) => (
          <div key={p.handle} style={socialRow}>
            <div className="friend-av" style={{ background: p.accent_color, ...socialAv }}>
              {initials(p.display_name || p.handle || '?')}
            </div>
            <Link to={`/u/${p.handle ?? ''}`} style={{ flex: 1, minWidth: 0 }}>
              {p.display_name || p.handle} <span className="friend-code">@{p.handle}</span>
            </Link>
            <button
              type="button"
              className="btn btn-sm"
              disabled={follow.isPending || !p.handle}
              onClick={() => p.handle && follow.mutate(p.handle)}
            >
              <Plus size={13} /> {t('friends.add')}
            </button>
          </div>
        ))}
        {results.data && results.data.length === 0 && q.trim().length >= 1 && (
          <p className="empty-note">{t('discover.none', 'No matches')}</p>
        )}
      </div>
    </div>
  );
}

/** Recent shared-map updates from people you follow. */
function Feed() {
  const { t } = useTranslation();
  const feedQuery = useQuery({ queryKey: ['feed'], queryFn: feed });
  if (!feedQuery.data || feedQuery.data.length === 0) return null;
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{t('feed.title', 'Recent activity')}</h2>
      </div>
      <div className="panel-body">
        {feedQuery.data.map((e) => (
          <Link
            key={`${e.handle ?? e.share_slug ?? ''}-${e.updated_at}`}
            to={e.handle ? `/u/${e.handle}` : `/share/${e.share_slug ?? ''}`}
            style={socialRow}
          >
            <div className="friend-av" style={{ background: e.accent_color, ...socialAv }}>
              {initials(e.display_name || e.handle || '?')}
            </div>
            <span style={{ flex: 1, minWidth: 0 }}>{e.display_name || e.handle}</span>
            <span className="friend-code">
              {t('feed.countries', {
                count: e.country_count,
                defaultValue: '{{count}} countries',
              })}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
