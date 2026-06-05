import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Layers } from 'lucide-react';
import { useEditorStore } from '@/features/editor/store';
import { computeStats } from '@/domain/stats';
import { WorldMap } from './WorldMap';
import { Legend } from './Legend';
import { MapEmptyState } from './MapEmptyState';
import { ImportModal } from '@/features/editor/components/ImportModal';

export function MapPage() {
  const { t } = useTranslation();
  const data = useEditorStore((s) => s.data);
  const setData = useEditorStore((s) => s.setData);
  const [importOpen, setImportOpen] = useState(false);

  const stats = useMemo(() => computeStats(data), [data]);

  const onCountryClick = (geographyName: string) => {
    const store = useEditorStore.getState();
    const idx = store.ensureCountry(geographyName);
    const c = store.data.travel.countries[idx];
    const current = c?.status.birthplace
      ? 'birthplace'
      : c?.status.lived
        ? 'lived'
        : c?.status.visited
          ? 'visited'
          : 'none';
    const next =
      current === 'none'
        ? 'visited'
        : current === 'visited'
          ? 'lived'
          : current === 'lived'
            ? 'birthplace'
            : 'none';
    store.setPrimaryStatus(idx, next);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">{t('map.kicker')}</div>
          <h1 className="page-title">{t('map.title')}</h1>
          <p className="page-lede">{t('map.lede')}</p>
        </div>
        <div className="toolbar">
          <span className="chip">
            <span className="mono">{stats.traveled}</span> {t('map.onMap')}
          </span>
          <button className="btn btn-sm" onClick={() => setImportOpen(true)}>
            <Layers size={14} /> {t('map.loadOwn')}
          </button>
        </div>
      </div>

      {stats.traveled === 0 && <MapEmptyState onImport={() => setImportOpen(true)} />}

      <div className="panel">
        <div className="panel-head">
          <Legend counts={stats.byStatus} />
          <span className="kicker" style={{ textTransform: 'none' }}>
            {t('map.clickHint')}
          </span>
        </div>
        <div className="panel-body">
          <WorldMap data={data} onCountryClick={onCountryClick} />
        </div>
      </div>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(d) => {
          setData(d);
          toast.success(t('toast.loadedOwn'));
        }}
      />
    </div>
  );
}
