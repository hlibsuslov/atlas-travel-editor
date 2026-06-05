import { useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { geoBounds, geoCentroid } from 'd3-geo';
import worldData from 'world-atlas/countries-50m.json';
import type { TravelData } from '@/domain/schema';
import { codeForEnglishName, localizedCountryName } from '@/domain/countries';
import { buildStatusMap, STATUS_COLORS, statusForGeography, type MapStatus } from './countryMatch';
import { CRIMEA_FEATURES, CRIMEA_OWNER } from './crimea';

const GEO = worldData as unknown as Record<string, unknown>;

const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
export const WORLD_VIEW = { coordinates: [10, 30] as [number, number], zoom: MIN_ZOOM };

// Viewport aspect (width 960 / height 500) used to balance lon vs lat fitting.
const VIEW_ASPECT = 960 / 500;

/**
 * Given a GeoJSON geography, return a controlled `position` ({ coordinates, zoom })
 * that centres the controlled ZoomableGroup on the geography and increases zoom so
 * the country roughly fills the viewport, clamped to [MIN_ZOOM, MAX_ZOOM].
 * Pure + exported so it can be unit-tested without rendering the map.
 */
export function zoomToFit(geo: unknown): { coordinates: [number, number]; zoom: number } {
  const [[minLon, minLat], [maxLon, maxLat]] = geoBounds(geo as never);
  const [cLon, cLat] = geoCentroid(geo as never);

  // Geographic span of the country (guard against degenerate / zero spans).
  const spanLon = Math.max(Math.abs(maxLon - minLon), 0.5);
  const spanLat = Math.max(Math.abs(maxLat - minLat), 0.5);

  // At zoom 1 the map shows ~360° of longitude and ~180° of latitude. Add padding
  // so the country doesn't touch the edges, and fit the tighter of the two axes.
  const padding = 1.4;
  const zoomLon = 360 / (spanLon * padding);
  const zoomLat = 180 / (spanLat * padding * VIEW_ASPECT);
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomLon, zoomLat)));

  const coordinates: [number, number] = [
    Number.isFinite(cLon) ? cLon : (minLon + maxLon) / 2,
    Number.isFinite(cLat) ? cLat : (minLat + maxLat) / 2,
  ];
  return { coordinates, zoom };
}

interface Hover {
  name: string;
  iso: string;
  status: MapStatus;
  x: number;
  y: number;
}

interface WorldMapProps {
  data: TravelData;
  onCountryClick?: (geographyName: string) => void;
  readOnly?: boolean;
}

export function WorldMap({ data, onCountryClick, readOnly }: WorldMapProps) {
  const { t, i18n } = useTranslation();
  const statusMap = useMemo(() => buildStatusMap(data), [data]);

  // Accessible name announcing the localized country name and its localized status,
  // e.g. "France: Visited". Uses the defaultValue i18n pattern so no locale JSON
  // files need editing.
  const regionAria = (name: string, status: MapStatus) =>
    t('map.regionAria', {
      defaultValue: '{{name}}: {{status}}',
      name: localizedCountryName(name, i18n.language),
      status: t(`map.legend.${status}`),
    });
  const crimeaStatus = statusForGeography(CRIMEA_OWNER, statusMap);
  const [hover, setHover] = useState<Hover | null>(null);
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>(
    WORLD_VIEW,
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  // Tracks a pending single-click so a double-click can cancel the status cycle.
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const moveTip = (e: MouseEvent, name: string, status: MapStatus) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({
      name,
      iso: codeForEnglishName(name) ?? '—',
      status,
      x: e.clientX - rect.left + 14,
      y: e.clientY - rect.top + 14,
    });
  };

  const setZoom = (factor: number) =>
    setPosition((p) => ({ ...p, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, p.zoom * factor)) }));
  const reset = () => setPosition(WORLD_VIEW);

  // Single-click cycles status, but is deferred so a follow-up double-click
  // (zoom-to-fit) can cancel it — double-click never triggers a status change.
  const handleCountryClick = (name: string) => {
    if (readOnly) return;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      onCountryClick?.(name);
    }, 220);
  };

  const handleCountryDoubleClick = (geo: unknown) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    setPosition(zoomToFit(geo));
  };

  const cursor = readOnly ? 'grab' : 'pointer';

  return (
    <div className="atlas-stage">
      <div
        className="atlas-wrap"
        ref={wrapRef}
        role="group"
        aria-label={t('map.mapAria', { defaultValue: 'World travel map' })}
        onMouseLeave={() => setHover(null)}
        style={{ cursor: 'grab' }}
      >
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 165 }}
          width={960}
          height={500}
          className="atlas-svg"
          style={{ background: 'var(--sea)' }}
        >
          <ZoomableGroup
            zoom={position.zoom}
            center={position.coordinates}
            minZoom={1}
            maxZoom={10}
            onMoveEnd={(pos: { coordinates: [number, number]; zoom: number }) => setPosition(pos)}
          >
            <Geographies geography={GEO}>
              {({ geographies }) =>
                geographies
                  .filter(
                    (geo: { properties: { name: string } }) => geo.properties.name !== 'Antarctica',
                  )
                  .map((geo: { rsmKey: string; properties: { name: string } }) => {
                    const status = statusForGeography(geo.properties.name, statusMap);
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        role="button"
                        aria-label={regionAria(geo.properties.name, status)}
                        fill={STATUS_COLORS[status]}
                        stroke="var(--map-stroke)"
                        strokeWidth={0.4}
                        onMouseMove={(e) => moveTip(e, geo.properties.name, status)}
                        onMouseEnter={(e) => moveTip(e, geo.properties.name, status)}
                        onClick={() => handleCountryClick(geo.properties.name)}
                        onDoubleClick={() => handleCountryDoubleClick(geo)}
                        style={{
                          default: { outline: 'none', transition: 'fill .25s ease' },
                          hover: { outline: 'none', opacity: 0.85, cursor },
                          pressed: { outline: 'none' },
                        }}
                      />
                    );
                  })
              }
            </Geographies>

            {/* Crimea (Ukraine) — explicit overlay so the border is always correct. */}
            <Geographies geography={CRIMEA_FEATURES}>
              {({ geographies }) =>
                geographies.map((geo: { rsmKey: string }) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    role="button"
                    aria-label={regionAria(CRIMEA_OWNER, crimeaStatus)}
                    fill={STATUS_COLORS[crimeaStatus]}
                    stroke="var(--map-stroke)"
                    strokeWidth={0.4}
                    onMouseMove={(e) => moveTip(e, 'Crimea (Ukraine)', crimeaStatus)}
                    onMouseEnter={(e) => moveTip(e, 'Crimea (Ukraine)', crimeaStatus)}
                    onClick={() => handleCountryClick(CRIMEA_OWNER)}
                    onDoubleClick={() => handleCountryDoubleClick(geo)}
                    style={{
                      default: { outline: 'none', transition: 'fill .25s ease' },
                      hover: { outline: 'none', opacity: 0.85, cursor },
                      pressed: { outline: 'none' },
                    }}
                  />
                ))
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {hover && (
          <div className="atlas-tip" style={{ left: hover.x, top: hover.y }}>
            <span className="atlas-tip-iso mono">{hover.iso}</span>
            <span className="atlas-tip-name">{hover.name}</span>
            <span className="atlas-tip-status">
              <i style={{ background: STATUS_COLORS[hover.status] }} />
              {t(`map.legend.${hover.status}`)}
            </span>
          </div>
        )}

        <div className="atlas-zoom">
          <button
            onClick={() => setZoom(1.5)}
            aria-label={t('map.zoomIn', { defaultValue: 'Zoom in' })}
          >
            +
          </button>
          <button
            onClick={() => setZoom(1 / 1.5)}
            aria-label={t('map.zoomOut', { defaultValue: 'Zoom out' })}
          >
            −
          </button>
          <button
            onClick={reset}
            aria-label={t('map.zoomReset', { defaultValue: 'Reset view' })}
            className="atlas-zoom-reset mono"
          >
            RESET
          </button>
        </div>

        <div className="atlas-coord mono">EQUAL EARTH · {Math.round(position.zoom * 100)}%</div>
      </div>
    </div>
  );
}

/** Lightweight, non-interactive mini map for friend cards and the login art. */
export function MiniMap({ data, none }: { data: TravelData; none?: string }) {
  const statusMap = useMemo(() => buildStatusMap(data), [data]);
  const crimeaStatus = statusForGeography(CRIMEA_OWNER, statusMap);
  const fill = (status: MapStatus) => (status === 'none' && none ? none : STATUS_COLORS[status]);

  return (
    <ComposableMap
      projection="geoEqualEarth"
      projectionConfig={{ scale: 165 }}
      width={960}
      height={500}
      aria-hidden
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <Geographies geography={GEO}>
        {({ geographies }) =>
          geographies
            .filter((geo: { properties: { name: string } }) => geo.properties.name !== 'Antarctica')
            .map((geo: { rsmKey: string; properties: { name: string } }) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fill(statusForGeography(geo.properties.name, statusMap))}
                stroke="var(--map-stroke)"
                strokeWidth={0.3}
                style={{
                  default: { outline: 'none' },
                  hover: { outline: 'none' },
                  pressed: { outline: 'none' },
                }}
              />
            ))
        }
      </Geographies>
      <Geographies geography={CRIMEA_FEATURES}>
        {({ geographies }) =>
          geographies.map((geo: { rsmKey: string }) => (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              fill={fill(crimeaStatus)}
              stroke="var(--map-stroke)"
              strokeWidth={0.3}
              style={{
                default: { outline: 'none' },
                hover: { outline: 'none' },
                pressed: { outline: 'none' },
              }}
            />
          ))
        }
      </Geographies>
    </ComposableMap>
  );
}
