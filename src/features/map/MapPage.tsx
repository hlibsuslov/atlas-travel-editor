import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, Image as ImageIcon, Layers, MapPin, Pencil, Save } from 'lucide-react';
import { useEditorStore } from '@/features/editor/store';
import { useTravelData } from '@/features/editor/hooks/useTravelData';
import { useSaveStatus } from '@/lib/persistence/useDataSync';
import { SaveStatus } from '@/components/ui/SaveStatus';
import { Flag } from '@/components/ui/Flag';
import { computeStats } from '@/domain/stats';
import { WorldMap, type StatusChoice } from './WorldMap';
import { Legend } from './Legend';
import { MapEmptyState } from './MapEmptyState';
import { BRUSHES, brushSwatch, type Brush } from './brush';
import {
  buildStatusMap,
  computeCoverage,
  STATUS_COLORS,
  unmatchedCountryNames,
} from './countryMatch';
import { EXPORT_FORMATS, exportMapPng } from './mapExport';
import { ImportModal } from '@/features/editor/components/ImportModal';
import './map.css';

// Aspect-hint glyphs for the export formats (a tiny CSS box echoing the ratio).
const FORMAT_ASPECT: Record<string, { w: number; h: number }> = {
  story: { w: 12, h: 21 },
  post: { w: 18, h: 18 },
  wide: { w: 24, h: 13.5 },
};

export function MapPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const data = useEditorStore((s) => s.data);
  const setData = useEditorStore((s) => s.setData);
  const dirty = useEditorStore((s) => s.dirty);
  const { save } = useTravelData();
  const { state: saveState } = useSaveStatus();
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // The active status brush and whether precise (popover-on-click) mode is on.
  const [brush, setBrush] = useState<Brush>('cycle');
  const [precise, setPrecise] = useState(false);
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

  // Popover / brush: set one of the four statuses (or clear) directly. "capital"
  // is a separate flag from the primary status, so each choice sets both the
  // dominant status and the capital-visit flag explicitly.
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
  // name is easy to find and fix.
  const focusInEditor = (name: string) => {
    useEditorStore.getState().ensureCountry(name);
    navigate('/');
  };

  // Explicit "Save now" — autosave already persists in the background, but this
  // gives the user a deliberate way to flush and confirms with the live status.
  const onSaveNow = () => {
    if (!dirty || save.isPending) return;
    save.mutate(useEditorStore.getState().data);
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
        // Accurate, UN-193 coverage caption (NOT the legacy denominator).
        caption: t('map.exportCaption', {
          defaultValue: '{{count}} of {{total}} countries · {{pct}}% of the world',
          count: stats.world.visitedUnMembers,
          total: stats.world.unMembers,
          pct: stats.world.pct,
        }),
        legend: (['birthplace', 'lived', 'visited', 'capital'] as const).map((k) => ({
          color: STATUS_COLORS[k],
          label: t(`map.legend.${k}`),
          count: stats.byStatus[k],
        })),
        wordmark: t('app.name'),
        dateLabel: new Date().toLocaleDateString(i18n.language),
      });
      toast.success(t('toast.imageExported'));
    } catch {
      toast.error(t('toast.imageFailed'));
    }
  };

  // The accessible label for each brush (segmented control option).
  const brushLabel = (b: Brush) =>
    t(`map.brush.${b}`, {
      defaultValue: {
        cycle: 'Cycle',
        visited: 'Visited',
        lived: 'Lived',
        capital: 'Capital',
        birthplace: 'Birthplace',
        erase: 'Erase',
      }[b],
    });

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
            <span className="mono">{stats.world.visitedUnMembers}</span>/
            <span className="mono">{stats.world.unMembers}</span> {t('map.onMap')}
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
              <div className="atlas-pop export-popover" role="menu">
                <div className="atlas-pop-label">
                  {t('map.exportFormatLabel', { defaultValue: 'Choose a format' })}
                </div>
                {EXPORT_FORMATS.map((f) => {
                  const a = FORMAT_ASPECT[f.id] ?? { w: 18, h: 18 };
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className="atlas-pop-item"
                      role="menuitem"
                      onClick={() => void exportImage(f.id)}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: a.w,
                          height: a.h,
                          flex: '0 0 auto',
                          borderRadius: 2,
                          border: '1.5px solid var(--ink-faint)',
                        }}
                      />
                      {t(`map.format.${f.id}`)}
                      <span className="export-soon">
                        {f.w}×{f.h}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {stats.traveled === 0 && <MapEmptyState onImport={() => setImportOpen(true)} />}

      <div className="panel">
        <div className="panel-head">
          <Legend counts={stats.byStatus} />
          <SaveStatus />
        </div>

        {/* Status-brush toolbar: pick the active paint; one click then applies it. */}
        <div className="panel-head map-controls">
          <div className="map-controls-left">
            <div
              className="brush-bar"
              role="radiogroup"
              aria-label={t('map.brush.aria', { defaultValue: 'Status brush' })}
            >
              <span className="brush-bar-label">
                {t('map.brush.label', { defaultValue: 'Paint' })}
              </span>
              {BRUSHES.map((b) => {
                const sw = brushSwatch(b);
                const active = brush === b;
                return (
                  <button
                    key={b}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`brush-item${active ? ' is-active' : ''}`}
                    title={brushLabel(b)}
                    onClick={() => setBrush(b)}
                  >
                    <span
                      aria-hidden="true"
                      className={
                        b === 'cycle'
                          ? 'brush-dot brush-dot-cycle'
                          : b === 'erase'
                            ? 'brush-dot brush-dot-erase'
                            : 'brush-dot'
                      }
                      style={sw && b !== 'erase' ? { background: STATUS_COLORS[sw] } : undefined}
                    />
                    <span className="brush-text">{brushLabel(b)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="map-controls-right">
            <button
              type="button"
              className={`map-precise${precise ? ' is-on' : ''}`}
              aria-pressed={precise}
              onClick={() => setPrecise((p) => !p)}
              title={t('map.preciseHint', {
                defaultValue: 'Click a country to open its full status menu',
              })}
            >
              <Pencil size={13} /> {t('map.precise', { defaultValue: 'Precise edit' })}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!dirty || save.isPending}
              onClick={onSaveNow}
            >
              <Save size={14} />{' '}
              {saveState === 'saving'
                ? t('map.saving', { defaultValue: 'Saving…' })
                : t('map.save', { defaultValue: 'Save' })}
            </button>
          </div>
        </div>

        <div className="panel-head" style={{ borderBottom: 'none' }}>
          <span className="map-hint">
            <MapPin size={13} />
            {brush === 'cycle' && !precise
              ? t('map.clickHint')
              : precise
                ? t('map.preciseActiveHint', {
                    defaultValue: 'Click a country to choose its status · long-press on touch',
                  })
                : t('map.brushActiveHint', {
                    defaultValue: 'Click a country to paint it {{brush}} · double-click to zoom',
                    brush: brushLabel(brush),
                  })}
          </span>
        </div>

        <div className="panel-body" ref={mapRef}>
          <WorldMap
            data={data}
            onCountryClick={onCountryClick}
            onSetStatus={onSetStatus}
            brush={brush}
            precise={precise}
          />
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
                  <Flag name={name} size={18} />
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
