import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { fetchPublicRecord } from '@/features/editor/api';
import { computeStats } from '@/domain/stats';
import { WorldMap } from '@/features/map/WorldMap';
import { Legend } from '@/features/map/Legend';

export function SharePage() {
  const { t } = useTranslation();
  const { slug = '' } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-record', slug],
    queryFn: () => fetchPublicRecord(slug),
    enabled: !!slug,
  });

  const stats = useMemo(() => (data ? computeStats(data) : null), [data]);

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

      {isLoading && <p className="empty-note">{t('common.loading')}</p>}
      {(isError || (!isLoading && !data)) && <p className="empty-note">{t('share.private')}</p>}

      {data && stats && (
        <>
          <div className="share-banner">
            <div>
              <div className="mono">
                {slug} · {t('share.readOnly')}
              </div>
              <h1>{data.person.birthplace.country || t('share.title')}</h1>
              <div style={{ color: '#cfc8b6', marginTop: 4 }}>
                {t('share.summary', {
                  country: data.person.birthplace.country || '—',
                  count: data.travel.countries.length,
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
