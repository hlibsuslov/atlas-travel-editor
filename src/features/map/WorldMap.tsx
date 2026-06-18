import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import worldData from 'world-atlas/countries-50m.json';
import type { TravelData } from '@/domain/schema';
import { codeForEnglishName, localizedCountryName } from '@/domain/countries';
import { buildStatusMap, STATUS_COLORS, statusForGeography, type MapStatus } from './countryMatch';
import { useMapZoom } from './useMapZoom';
import { CRIMEA_FEATURES, CRIMEA_OWNER } from './crimea';

const GEO = worldData as unknown as Record<string, unknown>;

/**
 * Status a country can be set to from the map's modifier/long-press menu. Mirrors
 * the four legend tiers plus "clear"; `MapPage` translates each into the right
 * `setPrimaryStatus` / `setCapitalVisit` store calls.
 */
export type StatusChoice = 'visited' | 'lived' | 'capital' | 'birthplace' | 'none';

// Items shown in the per-country status menu, top to bottom. `none` is the clear
// action and is rendered with a separating rule above it.
const MENU_CHOICES: readonly StatusChoice[] = ['visited', 'lived', 'capital', 'birthplace', 'none'];

// Hold this long (ms) on a country to open the status menu on touch / no-modifier
// pointers. Chosen above the 220ms double-click defer so a quick double-tap to
// zoom never trips it.
const LONG_PRESS_MS = 480;

interface Hover {
  name: string;
  iso: string;
  status: MapStatus;
  x: number;
  y: number;
}

interface StatusMenu {
  name: string;
  x: number;
  y: number;
}

interface WorldMapProps {
  data: TravelData;
  onCountryClick?: (geographyName: string) => void;
  /** Set a country to an explicit status from the modifier/long-press menu. */
  onSetStatus?: (geographyName: string, choice: StatusChoice) => void;
  readOnly?: boolean;
}

export function WorldMap({ data, onCountryClick, onSetStatus, readOnly }: WorldMapProps) {
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
  const [menu, setMenu] = useState<StatusMenu | null>(null);
  const { position, setPosition, setZoom, reset, zoomToGeo, deferClick } = useMapZoom();
  const wrapRef = useRef<HTMLDivElement>(null);
  // Pending long-press; cleared on pointer up / move / leave or when it fires.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when a long-press opened the menu, so the trailing click doesn't also
  // cycle the country's status.
  const pressFired = useRef(false);

  // The status menu can only ever appear on the editable map.
  const editable = !readOnly && !!onSetStatus;

  // Translate viewport coords to a point inside the map wrapper for absolute
  // positioning of the tooltip / menu.
  const localPoint = (clientX: number, clientY: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const moveTip = (e: MouseEvent, name: string, status: MapStatus) => {
    const p = localPoint(e.clientX, e.clientY);
    if (!p) return;
    setHover({
      name,
      iso: codeForEnglishName(name) ?? '—',
      status,
      x: p.x + 14,
      y: p.y + 14,
    });
  };

  const clearPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  // Width reserved for the menu when keeping it inside the map's right edge.
  const MENU_WIDTH = 176;

  // Open the per-country status menu at the given viewport point, nudged so it
  // stays inside the map wrapper horizontally.
  const openMenu = (name: string, clientX: number, clientY: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover(null);
    setMenu({
      name,
      x: Math.min(clientX - rect.left, Math.max(0, rect.width - MENU_WIDTH)),
      y: clientY - rect.top,
    });
  };

  // Single-click cycles status, but is deferred so a follow-up double-click
  // (zoom-to-fit) can cancel it — double-click never triggers a status change.
  // A modifier-click (Alt/Option) instead opens the explicit status menu.
  const handleCountryClick = (e: MouseEvent, name: string) => {
    if (!editable) return;
    // A long-press just opened the menu — swallow the trailing click.
    if (pressFired.current) {
      pressFired.current = false;
      return;
    }
    if (e.altKey) {
      deferClick(() => {}); // cancel any pending cycle without scheduling a new one
      openMenu(name, e.clientX, e.clientY);
      return;
    }
    deferClick(() => onCountryClick?.(name));
  };

  // Long-press (primary button / touch) opens the menu — the touch-friendly
  // equivalent of Alt-click. We hold the geometry/coords by value so the timer
  // callback doesn't depend on React state.
  const handlePointerDown = (e: PointerEvent, name: string) => {
    if (!editable || e.button !== 0) return;
    const { clientX, clientY } = e;
    clearPress();
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      pressFired.current = true;
      openMenu(name, clientX, clientY);
    }, LONG_PRESS_MS);
  };

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (!(e.target as HTMLElement | null)?.closest('.atlas-menu')) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  useEffect(() => clearPress, []);

  const chooseStatus = (choice: StatusChoice) => {
    if (menu) onSetStatus?.(menu.name, choice);
    setMenu(null);
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
                        onPointerDown={(e) => handlePointerDown(e, geo.properties.name)}
                        onPointerUp={clearPress}
                        onPointerLeave={clearPress}
                        onClick={(e) => handleCountryClick(e, geo.properties.name)}
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
                    onPointerDown={(e) => handlePointerDown(e, CRIMEA_OWNER)}
                    onPointerUp={clearPress}
                    onPointerLeave={clearPress}
                    onClick={(e) => handleCountryClick(e, CRIMEA_OWNER)}
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

        {hover && !menu && (
          <div className="atlas-tip" style={{ left: hover.x, top: hover.y }}>
            <span className="atlas-tip-iso mono">{hover.iso}</span>
            <span className="atlas-tip-name">{hover.name}</span>
            <span className="atlas-tip-status">
              <i style={{ background: STATUS_COLORS[hover.status] }} />
              {t(`map.legend.${hover.status}`)}
            </span>
          </div>
        )}

        {menu && (
          <div
            className="atlas-menu"
            // Inline styles keep this component self-contained (its CSS class is
            // not in any locale/stylesheet owned here); tokens mirror the export
            // popover so it stays on-palette.
            style={{
              position: 'absolute',
              zIndex: 30,
              left: menu.x,
              top: menu.y,
              minWidth: 168,
              background: 'var(--panel)',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow)',
              padding: 6,
            }}
            role="menu"
            aria-label={t('map.statusMenuAria', {
              defaultValue: 'Set status for {{name}}',
              name: localizedCountryName(menu.name, i18n.language),
            })}
          >
            <div
              style={{
                padding: '4px 8px 6px',
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--ink)',
              }}
            >
              {localizedCountryName(menu.name, i18n.language)}
            </div>
            {MENU_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                role="menuitem"
                className="atlas-menu-item"
                onClick={() => chooseStatus(choice)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '7px 8px',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 'var(--radius)',
                  borderTop: choice === 'none' ? '1px solid var(--line)' : undefined,
                  marginTop: choice === 'none' ? 4 : undefined,
                  fontFamily: 'var(--font-ui)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: choice === 'none' ? 'var(--ink-soft)' : 'var(--ink)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {choice === 'none' ? (
                  t('map.statusClear', { defaultValue: 'Clear' })
                ) : (
                  <>
                    <i
                      aria-hidden="true"
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: STATUS_COLORS[choice],
                        flex: '0 0 auto',
                      }}
                    />
                    {t(`map.legend.${choice}`)}
                  </>
                )}
              </button>
            ))}
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
