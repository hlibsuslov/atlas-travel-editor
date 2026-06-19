import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  atlasGetPublic,
  atlasGetPublicByHandle,
  getAtlasUrl,
  type AtlasPublicView,
} from '@/lib/atlas/client';
import { normalizeTravelData } from '@/domain/normalize';
import { computeStats } from '@/domain/stats';
import { WorldMap } from '@/features/map/WorldMap';
import { Legend } from '@/features/map/Legend';

/**
 * Public, read-only view of someone's shared map. Reachable by opaque slug
 * (`/share/:slug`) or human handle (`/u/:handle`). Reads through the connected
 * Atlas Server's column-minimized public endpoints — it only ever receives the map
 * data plus the owner's public profile slice, never any private fields. When no
 * server is connected (pure local-first), sharing is gracefully unavailable.
 */
export function SharePage() {
  const { t } = useTranslation();
  const params = useParams();
  const slug = params.slug ?? '';
  const handle = params.handle ?? '';
  const serverConfigured = !!getAtlasUrl();

  const query = useQuery<AtlasPublicView | null>({
    queryKey: handle ? ['public-handle', handle] : ['public-slug', slug],
    queryFn: () => (handle ? atlasGetPublicByHandle(handle) : atlasGetPublic(slug)),
    enabled: serverConfigured && (!!slug || !!handle),
  });

  const view = query.data ?? null;
  const data = useMemo(() => (view ? normalizeTravelData(view.data) : null), [view]);
  const stats = useMemo(() => (data ? computeStats(data) : null), [data]);
  const title = view?.profile.display_name || view?.profile.handle || handle || t('share.title');

  return (
    <div className="page">
      <div className="page-head" style={{ marginBottom: 14 }}>
        <Link className="btn btn-sm btn-ghost" to="/">
          {t('share.openEditor')}
        </Link>
        <span className="pill pill-ok">
          <Globe size={12} /> {t('share.publicView')}
        </span>
      </div>

      {!serverConfigured && (
        <p className="empty-note">
          {t(
            'share.unavailable',
            'Public sharing needs a connected Atlas Server. This is a local-first instance.',
          )}
        </p>
      )}

      {serverConfigured && query.isLoading && <p className="empty-note">{t('common.loading')}</p>}

      {serverConfigured && query.isError && (
        <div className="notice-bar notice-bar-warn">
          <span>{t('share.loadError')}</span>
          <button
            type="button"
            className="btn btn-sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t('actions.retry')}
          </button>
        </div>
      )}

      {serverConfigured && !query.isLoading && !query.isError && !view && (
        <p className="empty-note">{t('share.private')}</p>
      )}

      {view && data && stats && (
        <>
          <div className="share-banner">
            <div>
              <div className="mono">
                {view.profile.handle ? `@${view.profile.handle}` : slug} · {t('share.readOnly')}
              </div>
              <h1 style={{ borderLeft: `4px solid ${view.profile.accent_color}`, paddingLeft: 10 }}>
                {title}
              </h1>
              <div style={{ color: '#cfc8b6', marginTop: 4 }}>
                {t('share.summary', {
                  country: data.person.birthplace.country || '—',
                  count: stats.traveled,
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 28 }}>
              <div className="friend-stat" style={{ color: '#f3efe6' }}>
                <div className="n serif" style={{ fontSize: 34 }}>
                  {stats.traveled}
                </div>
                <div className="l" style={{ color: '#b8b09c' }}>
                  {t('friends.countriesLabel')}
                </div>
              </div>
              <div className="friend-stat" style={{ color: '#f3efe6' }}>
                <div className="n serif" style={{ fontSize: 34 }}>
                  {Object.keys(stats.byContinent).length}
                </div>
                <div className="l" style={{ color: '#b8b09c' }}>
                  {t('share.continents')}
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <Legend counts={stats.byStatus} />
              <span className="kicker" style={{ textTransform: 'none' }}>
                {t('share.dragHint')}
              </span>
            </div>
            <div className="panel-body">
              <WorldMap data={data} readOnly />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
