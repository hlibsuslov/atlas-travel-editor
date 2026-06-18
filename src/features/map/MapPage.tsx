import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, Image as ImageIcon, Layers, MapPin } from 'lucide-react';
import { useEditorStore } from '@/features/editor/store';
import { computeStats } from '@/domain/stats';
import { WorldMap, type StatusChoice } from './WorldMap';
import { Legend } from './Legend';
import { MapEmptyState } from './MapEmptyState';
import {
  buildStatusMap,
  computeCoverage,
  STATUS_COLORS,
  unmatchedCountryNames,
} from './countryMatch';
import { EXPORT_FORMATS, exportMapPng } from './mapExport';
import { ImportModal } from '@/features/editor/components/ImportModal';

export function MapPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const data = useEditorStore((s) => s.data);
  const setData = useEditorStore((s) => s.setData);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => computeStats(data), [data]);
  // Coverage of the user's statused countries against the bundled atlas, plus the
  // specific names that silently rendered as "none" so we can surface them.
  const coverage = useMemo(() => computeCoverage(buildStatusMap(data)), [data]);
  const unmatched = useMemo(() => unmatchedCountryNames(data), [data]);

  useEffect(() => {
    if (!exportOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [exportOpen]);

  // Click cycles none → visited → lived → none. Birthplace is owned by the
  // Person field and is never set on an arbitrary country from the map.
  const onCountryClick = (geographyName: string) => {
    const store = useEditorStore.getState();
    const idx = store.ensureCountry(geographyName);
    const c = store.data.travel.countries[idx];
    const current = c?.status.lived ? 'lived' : c?.status.visited ? 'visited' : 'none';
    const next = current === 'none' ? 'visited' : current === 'visited' ? 'lived' : 'none';
    store.setPrimaryStatus(idx, next);
  };

  // Modifier/long-press menu: set one of the four statuses (or clear) directly.
  // "capital" is a separate flag from the primary status, so each choice sets
  // both the dominant status and the capital-visit flag explicitly.
  const onSetStatus = (geographyName: string, choice: StatusChoice) => {
    const store = useEditorStore.getState();
    const idx = store.ensureCountry(geographyName);
    if (choice === 'capital') {
      store.setPrimaryStatus(idx, 'none');
      store.setCapitalVisit(idx, true);
    } else {
      store.setPrimaryStatus(idx, choice);
      if (choice === 'none') store.setCapitalVisit(idx, false);
    }
  };

  // Send the user to the editor with this country materialised, so an unmatched
  // name is easy to find and fix. Cross-route selection isn't wired through a
  // param yet, so we at least ensure the row exists and open the editor route.
  const focusInEditor = (name: string) => {
    useEditorStore.getState().ensureCountry(name);
    navigate('/');
  };

  const exportImage = async (formatId: string) => {
    setExportOpen(false);
    const svg = mapRef.current?.querySelector('svg');
    const format = EXPORT_FORMATS.find((f) => f.id === formatId);
    if (!svg || !format) return;
    try {
      await exportMapPng(svg, format, {
        title: t('app.name'),
        subtitle: t('share.summary', {
          country: data.person.birthplace.country || '—',
          count: stats.traveled,
        }),
        legend: (['birthplace', 'lived', 'visited', 'capital'] as const).map((k) => ({
          color: STATUS_COLORS[k],
          label: t(`map.legend.${k}`),
        })),
      });
      toast.success(t('toast.imageExported'));
    } catch {
      toast.error(t('toast.imageFailed'));
    }
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
          <div className="export-menu" ref={exportRef}>
            <button
              className="btn btn-sm"
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((o) => !o)}
            >
              <ImageIcon size={14} /> {t('map.exportImage')} <ChevronDown size={13} />
            </button>
            {exportOpen && (
              <div className="export-popover" role="menu">
                {EXPORT_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="export-item"
                    role="menuitem"
                    onClick={() => void exportImage(f.id)}
                  >
                    <ImageIcon size={15} /> {t(`map.format.${f.id}`)}
                    <span className="export-soon">
                      {f.w}×{f.h}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
        <div className="panel-body" ref={mapRef}>
          <WorldMap data={data} onCountryClick={onCountryClick} onSetStatus={onSetStatus} />
        </div>
      </div>

      {coverage.total > 0 && (
        <div className="panel-head" role="status" aria-live="polite" style={{ marginTop: 12 }}>
          <span className="chip">
            <MapPin size={13} />
            {t('map.matched', {
              defaultValue: '{{matched}} of {{total}} countries matched on the map',
              matched: coverage.matched,
              total: coverage.total,
            })}
          </span>
          {unmatched.length > 0 && (
            <span
              className="kicker"
              style={{ textTransform: 'none', display: 'flex', flexWrap: 'wrap', gap: 6 }}
            >
              {t('map.unmatchedLabel', { defaultValue: "Didn't match:" })}
              {unmatched.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="btn btn-sm btn-ghost"
                  title={t('map.fixInEditor', {
                    defaultValue: 'Open {{name}} in the editor to fix the name',
                    name,
                  })}
                  onClick={() => focusInEditor(name)}
                >
                  {name}
                </button>
              ))}
            </span>
          )}
        </div>
      )}

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
