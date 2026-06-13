import { useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import worldData from 'world-atlas/countries-50m.json';
import type { TravelData } from '@/domain/schema';
import { codeForEnglishName, localizedCountryName } from '@/domain/countries';
import { buildStatusMap, STATUS_COLORS, statusForGeography, type MapStatus } from './countryMatch';
import { useMapZoom } from './useMapZoom';
import { CRIMEA_FEATURES, CRIMEA_OWNER } from './crimea';

const GEO = worldData as unknown as Record<string, unknown>;

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
  const { position, setPosition, setZoom, reset, zoomToGeo, deferClick } = useMapZoom();
  const wrapRef = useRef<HTMLDivElement>(null);

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

  // Single-click cycles status, but is deferred so a follow-up double-click
  // (zoom-to-fit) can cancel it — double-click never triggers a status change.
  const handleCountryClick = (name: string) => {
    if (readOnly) return;
    deferClick(() => onCountryClick?.(name));
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
                        onDoubleClick={() => zoomToGeo(geo)}
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
                    onDoubleClick={() => zoomToGeo(geo)}
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
