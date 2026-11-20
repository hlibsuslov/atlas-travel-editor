import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, Image as ImageIcon, Layers } from 'lucide-react';
import { useEditorStore } from '@/features/editor/store';
import { Flag } from '@/components/ui/Flag';
import { computeStats } from '@/domain/stats';
import { WorldMap, type StatusChoice } from './WorldMap';
import { Legend } from './Legend';
import { MapEmptyState } from './MapEmptyState';
import { CountryPanel } from './CountryPanel';
import { resolveBrushClick } from './brush';
import { STATUS_COLORS, unmatchedCountryNames, type MapStatus } from './countryMatch';
import { EXPORT_FORMATS, exportMapPng } from './mapExport';
import { ImportModal } from '@/features/editor/components/ImportModal';
import { CountrySelect } from '@/features/editor/components/CountrySelect';
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
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ name: string; at: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => computeStats(data), [data]);
  const unmatched = useMemo(() => unmatchedCountryNames(data), [data]);

  useEffect(() => {
    if (!exportOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [exportOpen]);

  // Apply an explicit status (or clear) to a country — the single apply path for
  // the panel, the popover, the brushes and the cycle click. "capital" is a
  // separate flag from the primary status, so each choice sets both explicitly.
  const onSetStatus = useCallback((geographyName: string, choice: StatusChoice) => {
    const store = useEditorStore.getState();
    const idx = store.ensureCountry(geographyName);
    if (choice === 'capital') {
      store.setPrimaryStatus(idx, 'none');
      store.setCapitalVisit(idx, true);
    } else {
      store.setPrimaryStatus(idx, choice);
      if (choice === 'none') store.setCapitalVisit(idx, false);
    }
  }, []);

  // Double-click: derive the country's current status and let the
  // shared brush resolver decide the next one (covered by brush.test.ts).
  const onCountryClick = (geographyName: string) => {
    const store = useEditorStore.getState();
    const idx = store.ensureCountry(geographyName);
    const c = store.data.travel.countries[idx];
    const current: MapStatus = c?.status.lived
      ? 'lived'
      : c?.status.visited
        ? 'visited'
        : c?.capitalVisit.visited
          ? 'capital'
          : 'none';
    onSetStatus(geographyName, resolveBrushClick('cycle', current));
  };

  const closePanel = useCallback(() => setSelected(null), []);

  // Send the user to the editor with this country materialised, so an unmatched
  // name is easy to find and fix.
  const focusInEditor = (name: string) => {
    useEditorStore.getState().ensureCountry(name);
    navigate('/countries');
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
        caption: t('map.exportCaption', {
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

  return (
    <div className={`map-screen${selected ? ' has-panel' : ''}`}>
      <div className="map-stage" ref={mapRef}>
        <WorldMap
          data={data}
          onCountryClick={onCountryClick}
          onSetStatus={onSetStatus}
          onSelectCountry={setSelected}
          onQuickMark={onCountryClick}
          flyTo={flyTo}
          selected={selected}
          fill
        />
      </div>

      <div className="map-bar">
        <div className="map-search">
          <CountrySelect
            value=""
            ariaLabel={t('country.searchPlaceholder')}
            onChange={(name) => {
              setSelected(name);
              setFlyTo({ name, at: Date.now() });
            }}
          />
        </div>
        <div className="map-bar-actions">
          <button className="btn btn-sm" onClick={() => setImportOpen(true)}>
            <Layers size={14} aria-hidden="true" />{' '}
            <span className="hide-sm">{t('map.loadOwn')}</span>
          </button>
          <div className="export-menu" ref={exportRef}>
            <button
              className="btn btn-sm"
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              aria-label={t('map.exportImage')}
              onClick={() => setExportOpen((o) => !o)}
            >
              <ImageIcon size={14} aria-hidden="true" />
              <span className="hide-sm">{t('map.exportImage')}</span>
              <ChevronDown size={13} aria-hidden="true" />
            </button>
            {exportOpen && (
              <div className="atlas-pop export-popover" role="menu">
                <div className="atlas-pop-label">{t('map.exportFormatLabel')}</div>
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
                        className="format-glyph"
                        style={{ width: a.w, height: a.h }}
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

      <section className="map-summary" aria-label={t('stats.countries')}>
        <div className="map-summary-figures">
          <div className="figure">
            <span className="figure-value">{stats.world.visitedUnMembers}</span>
            <span className="figure-label">
              {t('stats.countries')} · {stats.world.pct}%
            </span>
          </div>
          <div className="figure">
            <span className="figure-value">{stats.distinctCities}</span>
            <span className="figure-label">{t('stats.cities')}</span>
          </div>
        </div>
        <Legend counts={stats.byStatus} />
        {unmatched.length > 0 && (
          <div className="map-unmatched">
            <span>{t('map.unmatchedLabel')}</span>
            {unmatched.map((name) => (
              <button
                key={name}
                type="button"
                className="btn btn-sm btn-ghost"
                title={t('map.fixInEditor', { name })}
                onClick={() => focusInEditor(name)}
              >
                <Flag name={name} size={16} />
                {name}
              </button>
            ))}
          </div>
        )}
        <p className="map-hint">{t('map.selectHint')}</p>
      </section>

      {stats.traveled === 0 && !selected && (
        <div className="map-empty">
          <MapEmptyState onImport={() => setImportOpen(true)} />
        </div>
      )}

      {selected && <CountryPanel name={selected} onClose={closePanel} onSetStatus={onSetStatus} />}

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
