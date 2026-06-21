import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import worldData from 'world-atlas/countries-50m.json';
import type { TravelData } from '@/domain/schema';
import { Flag } from '@/components/ui/Flag';
import { codeForEnglishName, localizedCountryName } from '@/domain/countries';
import { buildStatusMap, STATUS_COLORS, statusForGeography, type MapStatus } from './countryMatch';
import { useMapZoom } from './useMapZoom';
import { resolveBrushClick, type Brush } from './brush';
import { CRIMEA_FEATURES, CRIMEA_OWNER } from './crimea';

const GEO = worldData as unknown as Record<string, unknown>;

/**
 * Status a country can be set to from the map's popover / brush. Mirrors the four
 * legend tiers plus "clear"; `MapPage` translates each into the right
 * `setPrimaryStatus` / `setCapitalVisit` store calls.
 */
export type StatusChoice = 'visited' | 'lived' | 'capital' | 'birthplace' | 'none';

// Items shown in the per-country status popover, top to bottom. `none` is the
// clear action and is rendered with a separating rule above it.
const MENU_CHOICES: readonly StatusChoice[] = ['visited', 'lived', 'capital', 'birthplace', 'none'];

// Hold this long (ms) on a country to open the status popover on touch / no
// precise mode. Chosen above the 220ms double-click defer so a quick double-tap
// to zoom never trips it.
const LONG_PRESS_MS = 480;

// Below this viewport width the per-country popover docks as a bottom sheet for
// comfortable thumb targets (matches the .atlas-sheet design contract).
const SHEET_BREAKPOINT = 560;

interface Hover {
  name: string;
  iso: string;
  status: MapStatus;
  x: number;
  y: number;
}

interface StatusMenu {
  name: string;
  status: MapStatus;
  /** Anchored popover coords inside the wrapper; ignored when rendered as a sheet. */
  x: number;
  y: number;
  /** When true, render as a bottom sheet rather than an anchored popover. */
  sheet: boolean;
}

interface WorldMapProps {
  data: TravelData;
  onCountryClick?: (geographyName: string) => void;
  /** Set a country to an explicit status from the popover / brush. */
  onSetStatus?: (geographyName: string, choice: StatusChoice) => void;
  /**
   * The active status brush. When given (and not `cycle`), a single click paints
   * that status directly via `onSetStatus`. Defaults to `cycle`, which keeps the
   * legacy none→visited→lived→none behaviour through `onCountryClick`.
   */
  brush?: Brush;
  /**
   * Precise mode: a plain click opens the per-country status popover instead of
   * painting — the discoverable replacement for Alt-click. Long-press still opens
   * the popover regardless (touch path).
   */
  precise?: boolean;
  readOnly?: boolean;
}

export function WorldMap({
  data,
  onCountryClick,
  onSetStatus,
  brush = 'cycle',
  precise = false,
  readOnly,
}: WorldMapProps) {
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
  // Set when a long-press opened the popover, so the trailing click doesn't also
  // paint the country.
  const pressFired = useRef(false);

  // The status popover/painting can only ever happen on the editable map.
  const editable = !readOnly && !!onSetStatus;

  // Translate viewport coords to a point inside the map wrapper for absolute
  // positioning of the tooltip / popover.
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

  // Width reserved for the popover when keeping it inside the map's right edge.
  const MENU_WIDTH = 232;

  // Open the per-country status popover for a country. On narrow viewports it docks
  // as a bottom sheet; otherwise it's anchored near the click, nudged to stay
  // inside the map wrapper horizontally.
  const openMenu = (name: string, status: MapStatus, clientX: number, clientY: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover(null);
    const sheet = window.innerWidth <= SHEET_BREAKPOINT;
    setMenu({
      name,
      status,
      x: Math.min(clientX - rect.left, Math.max(0, rect.width - MENU_WIDTH)),
      y: clientY - rect.top,
      sheet,
    });
  };

  // Single-click. Deferred so a follow-up double-click (zoom-to-fit) can cancel
  // it — double-click never changes status. Behaviour depends on the mode:
  //  - precise mode (or Alt-click, kept for power users): open the popover.
  //  - a status brush: paint that status directly.
  //  - the cycle brush: cycle none→visited→lived→none (legacy default).
  const handleCountryClick = (e: MouseEvent, name: string, status: MapStatus) => {
    if (!editable) return;
    // A long-press just opened the popover — swallow the trailing click.
    if (pressFired.current) {
      pressFired.current = false;
      return;
    }
    if (precise || e.altKey) {
      deferClick(() => {}); // cancel any pending action without scheduling a new one
      openMenu(name, status, e.clientX, e.clientY);
      return;
    }
    if (brush === 'cycle') {
      deferClick(() => onCountryClick?.(name));
      return;
    }
    // An explicit brush: resolve the click to a concrete status and apply it.
    deferClick(() => onSetStatus?.(name, resolveBrushClick(brush, status)));
  };

  // Long-press (primary button / touch) opens the popover — the touch-friendly
  // equivalent of precise mode. We hold the geometry/coords by value so the timer
  // callback doesn't depend on React state.
  const handlePointerDown = (e: PointerEvent, name: string, status: MapStatus) => {
    if (!editable || e.button !== 0) return;
    const { clientX, clientY } = e;
    clearPress();
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      pressFired.current = true;
      openMenu(name, status, clientX, clientY);
    }, LONG_PRESS_MS);
  };

  // Close the popover on outside click / Escape.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: globalThis.MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest('.map-pop') && !el?.closest('.atlas-sheet')) setMenu(null);
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

  // The per-country popover body, shared by the anchored popover and the sheet.
  const renderMenuBody = () => {
    if (!menu) return null;
    const name = localizedCountryName(menu.name, i18n.language);
    return (
      <>
        <div className="map-pop-head">
          <Flag name={menu.name} status={menu.status} size={34} />
          <div className="map-pop-id">
            <span className="map-pop-name">{name}</span>
            <span className="map-pop-current">
              <i className="dot" style={{ background: STATUS_COLORS[menu.status] }} />
              {t(`map.legend.${menu.status}`)}
            </span>
          </div>
        </div>
        <div className="atlas-pop-label">
          {t('map.statusPickLabel', { defaultValue: 'Set status' })}
        </div>
        {MENU_CHOICES.map((choice) => {
          if (choice === 'none') {
            return (
              <div key="clear-group">
                <hr className="atlas-pop-sep" />
                <button
                  type="button"
                  role="menuitem"
                  className="atlas-pop-item"
                  onClick={() => chooseStatus('none')}
                >
                  <span className="map-pop-dot map-pop-dot-erase" aria-hidden="true" />
                  {t('map.statusClear', { defaultValue: 'Clear' })}
                  {menu.status === 'none' && (
                    <Check className="map-pop-check" size={15} aria-hidden="true" />
                  )}
                </button>
              </div>
            );
          }
          const active = menu.status === choice;
          return (
            <button
              key={choice}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              className="atlas-pop-item"
              onClick={() => chooseStatus(choice)}
            >
              <span
                className="map-pop-dot"
                aria-hidden="true"
                style={{ background: STATUS_COLORS[choice] }}
              />
              {t(`map.legend.${choice}`)}
              {active && <Check className="map-pop-check" size={15} aria-hidden="true" />}
            </button>
          );
        })}
      </>
    );
  };

  const menuAria = menu
    ? t('map.statusMenuAria', {
        defaultValue: 'Set status for {{name}}',
        name: localizedCountryName(menu.name, i18n.language),
      })
    : '';

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
                        onPointerDown={(e) => handlePointerDown(e, geo.properties.name, status)}
                        onPointerUp={clearPress}
                        onPointerLeave={clearPress}
                        onClick={(e) => handleCountryClick(e, geo.properties.name, status)}
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
                    onPointerDown={(e) => handlePointerDown(e, CRIMEA_OWNER, crimeaStatus)}
                    onPointerUp={clearPress}
                    onPointerLeave={clearPress}
                    onClick={(e) => handleCountryClick(e, CRIMEA_OWNER, crimeaStatus)}
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
            <div className="atlas-tip-head">
              <Flag name={hover.name} status={hover.status} size={24} />
              <div className="atlas-tip-id">
                <span className="atlas-tip-iso mono">{hover.iso}</span>
                <span className="atlas-tip-name">{hover.name}</span>
              </div>
            </div>
            <span className="atlas-tip-status">
              <i style={{ background: STATUS_COLORS[hover.status] }} />
              {t(`map.legend.${hover.status}`)}
            </span>
          </div>
        )}

        {/* Anchored popover (wide screens) — built on the shared .atlas-pop surface. */}
        {menu && !menu.sheet && (
          <div
            className="atlas-pop map-pop"
            style={{ left: menu.x, top: menu.y }}
            role="menu"
            aria-label={menuAria}
          >
            {renderMenuBody()}
          </div>
        )}
      </div>

      {/* Bottom sheet (narrow screens) — rendered outside .atlas-wrap so it can be
          fixed to the viewport with its backdrop. */}
      {menu && menu.sheet && (
        <>
          <div className="atlas-sheet-backdrop" onClick={() => setMenu(null)} />
          <div className="atlas-sheet" role="menu" aria-label={menuAria}>
            <button
              type="button"
              className="atlas-pop-item"
              style={{ position: 'absolute', top: 6, right: 6, width: 'auto' }}
              aria-label={t('map.statusClose', { defaultValue: 'Close' })}
              onClick={() => setMenu(null)}
            >
              <X size={16} aria-hidden="true" />
            </button>
            {renderMenuBody()}
          </div>
        </>
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
