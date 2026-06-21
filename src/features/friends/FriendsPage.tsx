import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Search, UserPlus, Users } from 'lucide-react';
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
import { computeStats, primaryStatus, type PrimaryStatus } from '@/domain/stats';
import { continentForName } from '@/domain/continents';
import type { TravelData } from '@/domain/schema';
import { MiniMap } from '@/features/map/WorldMap';
import { Flag } from '@/components/ui/Flag';
import './friends.css';

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

/** Rank for picking the most interesting countries to surface as flags. */
const STATUS_RANK: Record<PrimaryStatus, number> = {
  birthplace: 4,
  lived: 3,
  visited: 2,
  capital: 1,
  none: 0,
};

/** The friend's most meaningful countries (birthplace → lived → visited …) for the flag strip. */
function topCountries(data: TravelData, limit: number): string[] {
  return data.travel.countries
    .filter((c) => primaryStatus(c) !== 'none')
    .sort((a, b) => STATUS_RANK[primaryStatus(b)] - STATUS_RANK[primaryStatus(a)])
    .map((c) => c.name)
    .slice(0, limit);
}

export function FriendsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const connected = !!getAtlasUrl();
  const friends = useQuery({ queryKey: ['friends'], queryFn: listFriends, enabled: connected });

  const remove = useMutation({
    mutationFn: (handle: string | null) => removeFriend(handle),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['friends'] }),
  });

  const list = friends.data ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">{t('friends.kicker')}</div>
          <h1 className="page-title">{t('friends.title')}</h1>
          <p className="page-lede">{t('friends.subtitle')}</p>
        </div>
      </div>

      <div className="friends-page">
        {/* The public identity friends see — always available (works locally too). */}
        <ProfileEditor />

        {connected ? (
          <>
            <FindPeople />
            <Feed />

            <section>
              <div className="friends-grid-head">
                <h2>
                  <Users size={16} aria-hidden="true" style={{ marginRight: 6 }} />
                  {t('friends.following', 'Following')}
                </h2>
                {list.length > 0 && (
                  <span className="friends-count">
                    {t('friends.count', { count: list.length, defaultValue: '{{count}} people' })}
                  </span>
                )}
              </div>

              {friends.isLoading && <p className="empty-note">{t('common.loading')}</p>}
              {!friends.isLoading && list.length === 0 && (
                <p className="empty-note">{t('friends.empty')}</p>
              )}

              <div className="friends-grid">
                {list.map((f) => (
                  <FriendCard
                    key={f.handle ?? f.share_slug ?? f.display_name}
                    friend={f}
                    onRemove={() => remove.mutate(f.handle)}
                  />
                ))}
              </div>
            </section>
          </>
        ) : (
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
      </div>
    </div>
  );
}

function FriendCard({ friend, onRemove }: { friend: FriendLink; onRemove: () => void }) {
  const { t } = useTranslation();

  // The friend's public map: by their live slug, else by handle. The profile
  // (name + color) already came with the follow list — no extra fetch needed.
  const { data: view, isLoading } = useQuery({
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
  const lived = stats ? stats.byStatus.lived + stats.byStatus.birthplace : 0;
  const continents = useMemo(
    () =>
      data
        ? new Set(
            data.travel.countries
              .filter((c) => primaryStatus(c) !== 'none')
              .map((c) => continentForName(c.name)),
          ).size
        : 0,
    [data],
  );
  const flags = useMemo(() => (data ? topCountries(data, 5) : []), [data]);
  const homeBase = data?.person.birthplace.country || '';

  const label = friend.label || friend.display_name || friend.handle || '—';
  const href = friend.handle ? `/u/${friend.handle}` : `/share/${friend.share_slug ?? ''}`;
  const handleLabel = friend.handle ? `@${friend.handle}` : friend.share_slug;

  return (
    <div className="friend-card">
      <div className="friend-head">
        <div className="friend-av" style={{ background: friend.accent_color || 'var(--accent)' }}>
          {initials(label)}
        </div>
        <div className="friend-id">
          <div className="friend-name">{label}</div>
          {handleLabel && <div className="friend-code">{handleLabel}</div>}
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          aria-label={t('friends.removeNamed', {
            name: label,
            defaultValue: 'Unfollow {{name}}',
          })}
          onClick={onRemove}
        >
          ×
        </button>
      </div>

      {/* Home base + the friend's top-country flags (real circular artwork). */}
      {homeBase && (
        <div className="friend-home">
          <Flag name={homeBase} size={22} />
          <span className="friend-home-name">{homeBase}</span>
        </div>
      )}
      {flags.length > 0 && (
        <div className="friend-flags" aria-label={t('friends.topCountries', 'Top countries')}>
          {flags.map((name) => (
            <Flag key={name} name={name} size={22} />
          ))}
          {stats && stats.traveled > flags.length && (
            <span className="flag-more">+{stats.traveled - flags.length}</span>
          )}
        </div>
      )}

      <Link
        to={href}
        className="friend-mini"
        aria-label={t('friends.viewMapNamed', { name: label, defaultValue: "View {{name}}'s map" })}
      >
        {isLoading ? <div className="friend-skeleton" /> : data ? <MiniMap data={data} /> : null}
      </Link>

      <div className="friend-stats">
        <div className="friend-stat">
          <div className="n">{stats?.traveled ?? '—'}</div>
          <div className="sub">
            {stats
              ? t('friends.ofWorld', {
                  pct: stats.world.pct,
                  defaultValue: '{{pct}}% of the world',
                })
              : t('friends.countriesLabel')}
          </div>
        </div>
        <div className="friend-stat">
          <div className="n">{data ? lived : '—'}</div>
          <div className="sub">{t('country.lived')}</div>
        </div>
        <div className="friend-stat">
          <div className="n">{data ? continents : '—'}</div>
          <div className="sub">{t('friends.continents', 'Continents')}</div>
        </div>
      </div>

      <div className="friend-foot">
        <Link to={href} className="btn btn-sm">
          {t('friends.viewMap')} <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

/**
 * One unified "Add / discover people" control: a follow-by-code/link field plus a
 * live directory search, in a single panel. There is exactly one obvious place to
 * find people, with clear empty / loading / no-match states.
 */
function FindPeople() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [q, setQ] = useState('');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['friends'] });
    void queryClient.invalidateQueries({ queryKey: ['feed'] });
  };

  const add = useMutation({
    mutationFn: (value: string) => addFriend(value),
    onSuccess: () => {
      setCode('');
      toast.success(t('friends.followed', 'Now following.'));
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const follow = useMutation({
    mutationFn: (handle: string) => addFriend(handle),
    onSuccess: () => {
      toast.success(t('friends.followed', 'Now following.'));
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const results = useQuery({
    queryKey: ['discover', q],
    queryFn: () => discoverProfiles(q),
    enabled: q.trim().length >= 1,
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) add.mutate(code);
  };

  const searching = q.trim().length >= 1;
  const noMatches = searching && !results.isLoading && results.data && results.data.length === 0;

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>{t('friends.findTitle', 'Add people')}</h2>
          <div className="sub">
            {t('friends.findSubtitle', 'Search the directory, or paste a share code or link.')}
          </div>
        </div>
      </div>
      <div className="panel-body people-find">
        {/* Add by code / link. */}
        <form className="people-find-row" onSubmit={onSubmit}>
          <input
            className="input mono"
            value={code}
            placeholder={t('friends.addPlaceholder')}
            aria-label={t('friends.addByCode', 'Add by share code or link')}
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={add.isPending || !code.trim()}
          >
            <UserPlus size={14} /> {t('friends.add')}
          </button>
        </form>

        {/* Live directory search. */}
        <div className="field" style={{ marginBottom: 0 }}>
          <div className="people-find-row">
            <input
              className="input"
              value={q}
              placeholder={t('discover.placeholder', 'Search by handle or name')}
              aria-label={t('discover.title', 'Discover people')}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {!searching && (
            <p className="people-find-hint">
              <Search
                size={12}
                aria-hidden="true"
                style={{ verticalAlign: '-2px', marginRight: 4 }}
              />
              {t('discover.hint', 'Type a name or @handle to find people to follow.')}
            </p>
          )}
        </div>

        {/* Results: loading / matches / no-match. */}
        {searching && results.isLoading && (
          <div className="atlas-pop people-results is-empty">
            <span className="empty-note">{t('common.loading')}</span>
          </div>
        )}
        {results.data && results.data.length > 0 && (
          <div className="atlas-pop people-results" role="list">
            {results.data.map((p) => (
              <div
                key={p.handle ?? p.display_name}
                className="atlas-pop-item person-row"
                role="listitem"
              >
                <span
                  className="person-av"
                  style={{ background: p.accent_color || 'var(--accent)' }}
                  aria-hidden="true"
                >
                  {initials(p.display_name || p.handle || '?')}
                </span>
                <Link to={`/u/${p.handle ?? ''}`} className="person-id">
                  <span className="person-name">{p.display_name || p.handle}</span>
                  {p.handle && <span className="friend-code">@{p.handle}</span>}
                </Link>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={follow.isPending || !p.handle}
                  onClick={() => p.handle && follow.mutate(p.handle)}
                >
                  <UserPlus size={13} /> {t('friends.add')}
                </button>
              </div>
            ))}
          </div>
        )}
        {noMatches && (
          <div className="atlas-pop people-results is-empty">
            <span className="empty-note">
              {t('discover.noneFor', {
                q: q.trim(),
                defaultValue: 'No one found for “{{q}}”.',
              })}
            </span>
          </div>
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
        <div className="feed-list">
          {feedQuery.data.map((e) => (
            <Link
              key={`${e.handle ?? e.share_slug ?? ''}-${e.updated_at}`}
              to={e.handle ? `/u/${e.handle}` : `/share/${e.share_slug ?? ''}`}
              className="feed-row"
            >
              <span
                className="person-av"
                style={{ background: e.accent_color || 'var(--accent)' }}
                aria-hidden="true"
              >
                {initials(e.display_name || e.handle || '?')}
              </span>
              <span className="feed-name">{e.display_name || e.handle}</span>
              <span className="chip feed-meta">
                {t('feed.countries', {
                  count: e.country_count,
                  defaultValue: '{{count}} countries',
                })}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
