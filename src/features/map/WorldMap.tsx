import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, LocateFixed, Minus, Plus, X } from 'lucide-react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import type { TravelData } from '@/domain/schema';
import { Flag } from '@/components/ui/Flag';
import { codeForEnglishName, localizedCountryName } from '@/domain/countries';
import {
  buildStatusMap,
  canonical,
  countryNameForGeography,
  STATUS_COLORS,
  statusForGeography,
  type MapStatus,
} from './countryMatch';
import { europeView, MAX_ZOOM, useMapZoom, WORLD_VIEW, type MapPosition } from './useMapZoom';
import { resolveBrushClick, type Brush } from './brush';
import { SUPPLEMENTAL_PLACES } from './mapData';
import { LOW_RES_COUNTRIES, useWorldCountries, type CountryFeature } from './geography';

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

const MAP_WIDTH = 960;
const MAP_HEIGHT = 500;
const PROJECTION_CONFIG = { scale: 165 } as const;
const MAP_STYLE = { background: 'var(--sea)' } as const;
const MINI_MAP_STYLE = { width: '100%', height: '100%', background: 'transparent' } as const;
const EDITABLE_REGION_STYLE = {
  default: { outline: 'none' },
  hover: { outline: 'none', opacity: 0.88, cursor: 'pointer' },
  pressed: { outline: 'none', opacity: 0.76 },
} as const;
const READ_ONLY_REGION_STYLE = {
  default: { outline: 'none' },
  hover: { outline: 'none', opacity: 0.9, cursor: 'grab' },
  pressed: { outline: 'none', opacity: 0.8 },
} as const;
/**
 * Zoom with the wheel, trackpad pinch (arrives as ctrl+wheel) and drag; never on
 * double-click, which belongs to marking a country. Module-level so the zoom
 * behaviour is not rebuilt on every render.
 */
const ZOOM_FILTER = (event: { type: string; ctrlKey?: boolean; button?: number }) => {
  if (event.type === 'dblclick') return false;
  if (event.type === 'wheel') return true;
  return !event.ctrlKey && !event.button;
};

const SELECTED_STYLE = {
  default: { outline: 'none', pointerEvents: 'none' },
  hover: { outline: 'none', pointerEvents: 'none' },
  pressed: { outline: 'none', pointerEvents: 'none' },
} as const;
const MINI_REGION_STYLE = {
  default: { outline: 'none' },
  hover: { outline: 'none' },
  pressed: { outline: 'none' },
} as const;

const MENU_WIDTH = 292;
const MENU_HEIGHT_ESTIMATE = 286;
const OVERLAY_EDGE = 10;
const OVERLAY_GAP = 12;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * The viewBox height that matches the container's aspect at MAP_WIDTH, tracked
 * with a ResizeObserver; `null` until the first measurement. Without `fill`,
 * the classic 960×500 frame. Rounded so sub-pixel jitter does not re-render.
 */
function useFillHeight(ref: RefObject<HTMLElement>, fill: boolean): number | null {
  const [height, setHeight] = useState<number | null>(fill ? null : MAP_HEIGHT);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!fill || !el) return;
    const measure = () => {
      const { width, height: h } = el.getBoundingClientRect();
      const next = width > 0 && h > 0 ? (MAP_WIDTH * h) / width : MAP_HEIGHT;
      setHeight(Math.round(Math.min(2400, Math.max(360, next)) / 10) * 10);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fill, ref]);
  return height;
}

interface Hover {
  name: string;
  flagName: string;
  label?: string;
  iso: string;
  status: MapStatus;
}

interface StatusMenu {
  name: string;
  status: MapStatus;
  /** Anchored popover coords inside the wrapper; ignored when rendered as a sheet. */
  x: number;
  y: number;
  /** When true, render as a bottom sheet rather than an anchored popover. */
  sheet: boolean;
  placement: 'above' | 'below';
}

interface MapCanvasProps {
  /** viewBox height; the width is always MAP_WIDTH. */
  height: number;
  statusMap: Map<string, MapStatus>;
  countries: CountryFeature[];
  /** The selected country as a one-item list (Geographies computes its path). */
  selectedFeatures: CountryFeature[] | null;
  position: MapPosition;
  readOnly: boolean;
  regionAria: (name: string, status: MapStatus) => string;
  onTipEnter: (
    event: MouseEvent,
    name: string,
    status: MapStatus,
    flagName?: string,
    label?: string,
  ) => void;
  onTipMove: (event: MouseEvent) => void;
  onPointerDown: (event: PointerEvent, name: string, status: MapStatus) => void;
  onPointerEnd: () => void;
  onCountryClick: (event: MouseEvent, name: string, status: MapStatus) => void;
  onZoomToGeo: (geography: unknown) => void;
  onMoveStart: () => void;
  onMoveEnd: (position: MapPosition) => void;
}

/**
 * The expensive SVG tree is isolated behind React.memo. Tooltip/menu state lives
 * in the parent, so moving between overlays no longer reconciles every country.
 */
const MapCanvas = memo(function MapCanvas({
  height,
  statusMap,
  countries,
  selectedFeatures,
  position,
  readOnly,
  regionAria,
  onTipEnter,
  onTipMove,
  onPointerDown,
  onPointerEnd,
  onCountryClick,
  onZoomToGeo,
  onMoveStart,
  onMoveEnd,
}: MapCanvasProps) {
  const regionStyle = readOnly ? READ_ONLY_REGION_STYLE : EDITABLE_REGION_STYLE;

  return (
    <ComposableMap
      projection="geoEqualEarth"
      projectionConfig={PROJECTION_CONFIG}
      width={MAP_WIDTH}
      height={height}
      className="atlas-svg"
      style={MAP_STYLE}
    >
      <ZoomableGroup
        zoom={position.zoom}
        center={position.coordinates}
        minZoom={1}
        maxZoom={MAX_ZOOM}
        // @types/react-simple-maps declares an SVGElement here, but the library
        // passes the d3 event through (see its filterFunc).
        filterZoomEvent={ZOOM_FILTER as unknown as (element: SVGElement) => boolean}
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
      >
        <Geographies geography={countries}>
          {({ geographies }) =>
            geographies.map((geo: { rsmKey: string; properties: { name: string } }) => {
              const name = countryNameForGeography(geo.properties.name);
              const status = statusForGeography(name, statusMap);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  className="atlas-country"
                  role="button"
                  aria-label={regionAria(name, status)}
                  fill={STATUS_COLORS[status]}
                  stroke="var(--map-stroke)"
                  strokeWidth={0.6}
                  onMouseMove={onTipMove}
                  onMouseEnter={(event) => onTipEnter(event, name, status)}
                  onPointerDown={(event) => onPointerDown(event, name, status)}
                  onPointerUp={onPointerEnd}
                  onPointerLeave={onPointerEnd}
                  onClick={(event) => onCountryClick(event, name, status)}
                  onDoubleClick={() => onZoomToGeo(geo)}
                  style={regionStyle}
                />
              );
            })
          }
        </Geographies>

        {/* Keep sovereign microstates/islands missing from the 110m polygons as
            tiny vector markers. They preserve full country coverage at a tiny
            fraction of the geometry cost of countries-50m. */}
        {SUPPLEMENTAL_PLACES.map((place) => {
          const status = statusForGeography(place.name, statusMap);
          return (
            <Marker
              key={place.code}
              coordinates={place.coordinates}
              className="atlas-place"
              role="button"
              aria-label={regionAria(place.name, status)}
              onMouseMove={onTipMove}
              onMouseEnter={(event) => onTipEnter(event, place.name, status)}
              onPointerDown={(event) => onPointerDown(event, place.name, status)}
              onPointerUp={onPointerEnd}
              onPointerLeave={onPointerEnd}
              onClick={(event) => onCountryClick(event, place.name, status)}
              onDoubleClick={() =>
                onZoomToGeo({
                  type: 'Feature',
                  properties: { name: place.name },
                  geometry: { type: 'Point', coordinates: place.coordinates },
                })
              }
              style={regionStyle}
            >
              <circle
                className="atlas-place-dot"
                r={status === 'none' ? 1.05 : 1.4}
                fill={STATUS_COLORS[status]}
                stroke="var(--map-stroke)"
                strokeWidth={0.55}
                vectorEffect="non-scaling-stroke"
              />
              <circle className="atlas-place-hit" r={2.8} fill="transparent" />
            </Marker>
          );
        })}
        {selectedFeatures && (
          <Geographies geography={selectedFeatures}>
            {({ geographies }) =>
              geographies.map((geo: { rsmKey: string }) => (
                <Geography
                  key={`selected-${geo.rsmKey}`}
                  geography={geo}
                  className="atlas-selected"
                  fill="var(--map-selected)"
                  stroke="none"
                  style={SELECTED_STYLE}
                  aria-hidden="true"
                />
              ))
            }
          </Geographies>
        )}
      </ZoomableGroup>
    </ComposableMap>
  );
});

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
  /**
   * Select mode: a plain click opens the country (e.g. a docked panel) instead
   * of painting. Double-click still zooms; long-press still opens the popover.
   */
  onSelectCountry?: (geographyName: string) => void;
  /**
   * Double-click on an editable map: a quick status change (e.g. cycle visited
   * → lived → clear) instead of zooming. Without it, double-click fits the
   * country in view.
   */
  onQuickMark?: (geographyName: string) => void;
  /** Fly the view to this country; `at` makes a repeat request distinct. */
  flyTo?: { name: string; at: number } | null;
  /** Country to highlight as selected. */
  selected?: string | null;
  readOnly?: boolean;
  /**
   * Fill the parent: the viewBox follows the container's aspect ratio (no empty
   * sea bands), and tall containers start zoomed in so land fills the screen.
   */
  fill?: boolean;
}

export function WorldMap({
  data,
  onCountryClick,
  onSetStatus,
  brush = 'cycle',
  precise = false,
  onSelectCountry,
  onQuickMark,
  flyTo = null,
  selected = null,
  readOnly,
  fill = false,
}: WorldMapProps) {
  const { t, i18n } = useTranslation();
  const statusMap = useMemo(() => buildStatusMap(data), [data]);

  // Accessible name announcing the localized country name and status. Keeping
  // this callback stable lets the memoized SVG tree ignore tooltip-only renders.
  const regionAria = useCallback(
    (name: string, status: MapStatus) =>
      t('map.regionAria', {
        defaultValue: '{{name}}: {{status}}',
        name: localizedCountryName(name, i18n.language),
        status: t(`map.legend.${status}`),
      }),
    [i18n.language, t],
  );
  const countries = useWorldCountries();
  const selectedFeatures = useMemo(() => {
    if (!selected) return null;
    const key = canonical(selected);
    const match = countries.find(
      (f) => canonical(countryNameForGeography(f.properties.name)) === key,
    );
    return match ? [match] : null;
  }, [countries, selected]);
  const [hover, setHover] = useState<Hover | null>(null);
  const [menu, setMenu] = useState<StatusMenu | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const measuredHeight = useFillHeight(wrapRef, fill);
  const viewHeight = measuredHeight ?? MAP_HEIGHT;
  // Land spans roughly 85% of the default 960×500 frame; on a taller frame,
  // zoom in until it fills the height (capped so the world stays recognisable).
  const baseZoom = Math.min(3, Math.max(1, (viewHeight / MAP_HEIGHT) * 0.85));
  const homeView = useMemo(
    () => (fill ? europeView(MAP_WIDTH, viewHeight, PROJECTION_CONFIG.scale) : WORLD_VIEW),
    [fill, viewHeight],
  );
  const { position, setPosition, setZoom, reset, zoomToGeo, deferClick, cancelClick } = useMapZoom(
    baseZoom,
    homeView,
  );
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipPoint = useRef({ clientX: 0, clientY: 0 });
  const tooltipFrame = useRef<number | null>(null);
  const tooltipFrameIsTimer = useRef(false);
  // Pending long-press; cleared on pointer up / move / leave or when it fires.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when a long-press opened the popover, so the trailing click doesn't also
  // paint the country.
  const pressFired = useRef(false);

  // The status popover/painting can only ever happen on the editable map.
  const editable = !readOnly && !!onSetStatus;

  /**
   * Position the tooltip at most once per animation frame by mutating its single
   * transform. Crucially, pointer coordinates never enter React state, so normal
   * mouse movement does not re-render 200-ish SVG regions.
   */
  const queueTooltipPosition = useCallback((clientX: number, clientY: number) => {
    tooltipPoint.current = { clientX, clientY };
    if (tooltipFrame.current !== null) return;

    const place = () => {
      tooltipFrame.current = null;
      const wrap = wrapRef.current;
      const tip = tooltipRef.current;
      if (!wrap || !tip) return;

      const rect = wrap.getBoundingClientRect();
      const localX = tooltipPoint.current.clientX - rect.left;
      const localY = tooltipPoint.current.clientY - rect.top;
      const width = tip.offsetWidth || 190;
      const height = tip.offsetHeight || 74;

      let x = localX + OVERLAY_GAP;
      let y = localY + OVERLAY_GAP;
      if (x + width + OVERLAY_EDGE > rect.width) x = localX - width - OVERLAY_GAP;
      if (y + height + OVERLAY_EDGE > rect.height) y = localY - height - OVERLAY_GAP;
      x = clamp(x, OVERLAY_EDGE, rect.width - width - OVERLAY_EDGE);
      y = clamp(y, OVERLAY_EDGE, rect.height - height - OVERLAY_EDGE);
      tip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    };

    if (typeof window.requestAnimationFrame === 'function') {
      tooltipFrameIsTimer.current = false;
      tooltipFrame.current = window.requestAnimationFrame(place);
    } else {
      // jsdom/older embedded browsers: preserve behaviour without making the
      // rendering path depend on requestAnimationFrame support.
      tooltipFrameIsTimer.current = true;
      tooltipFrame.current = window.setTimeout(place, 16);
    }
  }, []);

  const cancelTooltipFrame = useCallback(() => {
    if (tooltipFrame.current === null) return;
    if (tooltipFrameIsTimer.current) window.clearTimeout(tooltipFrame.current);
    else window.cancelAnimationFrame(tooltipFrame.current);
    tooltipFrame.current = null;
  }, []);

  const showTip = useCallback(
    (event: MouseEvent, name: string, status: MapStatus, flagName = name, label?: string) => {
      queueTooltipPosition(event.clientX, event.clientY);
      const next: Hover = {
        name,
        flagName,
        ...(label ? { label } : {}),
        iso: codeForEnglishName(flagName) ?? '—',
        status,
      };
      setHover((current) =>
        current?.name === next.name &&
        current.flagName === next.flagName &&
        current.label === next.label &&
        current.status === next.status
          ? current
          : next,
      );
    },
    [queueTooltipPosition],
  );

  const moveTip = useCallback(
    (event: MouseEvent) => queueTooltipPosition(event.clientX, event.clientY),
    [queueTooltipPosition],
  );

  const hideTip = useCallback(() => setHover(null), []);

  const clearPress = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  // Open the per-country status popover for a country. On narrow viewports it docks
  // as a bottom sheet; otherwise it chooses the side with room and clamps both
  // axes so the complete menu stays inside the map.
  const openMenu = useCallback(
    (name: string, status: MapStatus, clientX: number, clientY: number) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      setHover(null);
      const sheet = window.innerWidth <= SHEET_BREAKPOINT;
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const placement: StatusMenu['placement'] =
        localY + MENU_HEIGHT_ESTIMATE + OVERLAY_GAP <= rect.height ? 'below' : 'above';
      const preferredX =
        localX + MENU_WIDTH + OVERLAY_GAP <= rect.width
          ? localX + OVERLAY_GAP
          : localX - MENU_WIDTH - OVERLAY_GAP;
      const preferredY =
        placement === 'below' ? localY + OVERLAY_GAP : localY - MENU_HEIGHT_ESTIMATE - OVERLAY_GAP;
      setMenu({
        name,
        status,
        x: clamp(preferredX, OVERLAY_EDGE, rect.width - MENU_WIDTH - OVERLAY_EDGE),
        y: clamp(preferredY, OVERLAY_EDGE, rect.height - MENU_HEIGHT_ESTIMATE - OVERLAY_EDGE),
        sheet,
        placement,
      });
    },
    [],
  );

  // Single-click. Deferred so a follow-up double-click (zoom-to-fit) can cancel
  // it — double-click never changes status. Behaviour depends on the mode:
  //  - precise mode (or Alt-click, kept for power users): open the popover.
  //  - a status brush: paint that status directly.
  //  - the cycle brush: cycle none→visited→lived→none (legacy default).
  const handleCountryClick = useCallback(
    (event: MouseEvent, name: string, status: MapStatus) => {
      if (!editable) return;
      // A long-press just opened the popover — swallow the trailing click.
      if (pressFired.current) {
        pressFired.current = false;
        return;
      }
      if (onSelectCountry && !event.altKey) {
        deferClick(() => onSelectCountry(name));
        return;
      }
      if (precise || event.altKey) {
        deferClick(() => {}); // cancel any pending action without scheduling a new one
        openMenu(name, status, event.clientX, event.clientY);
        return;
      }
      if (brush === 'cycle') {
        deferClick(() => onCountryClick?.(name));
        return;
      }
      deferClick(() => onSetStatus?.(name, resolveBrushClick(brush, status)));
    },
    [brush, deferClick, editable, onCountryClick, onSelectCountry, onSetStatus, openMenu, precise],
  );

  useEffect(() => {
    if (!flyTo) return;
    const key = canonical(flyTo.name);
    const match = countries.find(
      (f) => canonical(countryNameForGeography(f.properties.name)) === key,
    );
    if (match) zoomToGeo(match);
    // Only a new request moves the map; geometry swaps must not re-fly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo]);

  // Double-click: quick-mark on the editable map (cancelling the pending
  // single-click), otherwise fit the country in view.
  const handleDoubleClick = useCallback(
    (geo: unknown) => {
      const raw = (geo as { properties?: { name?: string } }).properties?.name;
      if (editable && onQuickMark && raw) {
        cancelClick();
        onQuickMark(countryNameForGeography(raw));
        return;
      }
      zoomToGeo(geo);
    },
    [cancelClick, editable, onQuickMark, zoomToGeo],
  );

  // Long-press (primary button / touch) opens the popover — the touch-friendly
  // equivalent of precise mode. We hold the geometry/coords by value so the timer
  // callback doesn't depend on React state.
  const handlePointerDown = useCallback(
    (event: PointerEvent, name: string, status: MapStatus) => {
      if (!editable || event.button !== 0) return;
      const { clientX, clientY } = event;
      clearPress();
      pressTimer.current = setTimeout(() => {
        pressTimer.current = null;
        pressFired.current = true;
        openMenu(name, status, clientX, clientY);
      }, LONG_PRESS_MS);
    },
    [clearPress, editable, openMenu],
  );

  const handleMoveStart = useCallback(() => {
    wrapRef.current?.classList.add('is-moving');
    setHover(null);
  }, []);

  const handleMoveEnd = useCallback(
    (next: MapPosition) => {
      wrapRef.current?.classList.remove('is-moving');
      setPosition(next);
    },
    [setPosition],
  );

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

  useEffect(
    () => () => {
      clearPress();
      cancelTooltipFrame();
      wrapRef.current?.classList.remove('is-moving');
    },
    [cancelTooltipFrame, clearPress],
  );

  const chooseStatus = (choice: StatusChoice) => {
    if (menu) onSetStatus?.(menu.name, choice);
    setMenu(null);
  };

  // The per-country popover body, shared by the anchored popover and the sheet.
  const renderMenuBody = () => {
    if (!menu) return null;
    const name = localizedCountryName(menu.name, i18n.language);
    return (
      <>
        <div className="map-pop-head">
          <span className="map-pop-flag" aria-hidden="true">
            <Flag name={menu.name} status={menu.status} size={38} />
          </span>
          <div className="map-pop-id">
            <span className="map-pop-kicker">
              {t('map.statusPickLabel', { defaultValue: 'Set status' })}
            </span>
            <span className="map-pop-name">{name}</span>
            <span className="map-pop-current">
              <i className="dot" style={{ background: STATUS_COLORS[menu.status] }} />
              {t(`map.legend.${menu.status}`)}
            </span>
          </div>
          <button
            type="button"
            className="map-pop-close"
            aria-label={t('map.statusClose', { defaultValue: 'Close' })}
            onClick={() => setMenu(null)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="map-pop-body">
          <div className="map-pop-options">
            {MENU_CHOICES.filter((choice) => choice !== 'none').map((choice) => {
              const active = menu.status === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  className="atlas-pop-item map-pop-option"
                  onClick={() => chooseStatus(choice)}
                >
                  <span
                    className="map-pop-dot"
                    aria-hidden="true"
                    style={{ background: STATUS_COLORS[choice] }}
                  />
                  <span>{t(`map.legend.${choice}`)}</span>
                  {active && <Check className="map-pop-check" size={15} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <hr className="atlas-pop-sep" />
          <button
            type="button"
            role="menuitem"
            className={`atlas-pop-item map-pop-clear${menu.status === 'none' ? ' is-active' : ''}`}
            onClick={() => chooseStatus('none')}
          >
            <span className="map-pop-dot map-pop-dot-erase" aria-hidden="true" />
            {t('map.statusClear', { defaultValue: 'Clear' })}
            {menu.status === 'none' && (
              <Check className="map-pop-check" size={15} aria-hidden="true" />
            )}
          </button>
        </div>
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
        onMouseLeave={hideTip}
        style={{ cursor: 'grab' }}
      >
        {/* The zoom library places the view once per mount from the frame size,
            so wait for the measurement and remount when the frame's shape changes. */}
        {measuredHeight !== null && (
          <MapCanvas
            key={viewHeight}
            height={viewHeight}
            statusMap={statusMap}
            countries={countries}
            selectedFeatures={selectedFeatures}
            position={position}
            readOnly={!!readOnly}
            regionAria={regionAria}
            onTipEnter={showTip}
            onTipMove={moveTip}
            onPointerDown={handlePointerDown}
            onPointerEnd={clearPress}
            onCountryClick={handleCountryClick}
            onZoomToGeo={handleDoubleClick}
            onMoveStart={handleMoveStart}
            onMoveEnd={handleMoveEnd}
          />
        )}

        {hover && !menu && (
          <div ref={tooltipRef} className="atlas-tip" role="tooltip">
            <div className="atlas-tip-head">
              <Flag name={hover.flagName} status={hover.status} size={26} />
              <div className="atlas-tip-id">
                <span className="atlas-tip-iso mono">{hover.iso}</span>
                <span className="atlas-tip-name">
                  {hover.label ?? localizedCountryName(hover.name, i18n.language)}
                </span>
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
            className={`atlas-pop map-pop is-${menu.placement}`}
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
          <div className="atlas-sheet map-status-sheet" role="menu" aria-label={menuAria}>
            {renderMenuBody()}
          </div>
        </>
      )}

      <div className="atlas-zoom">
        <div className="atlas-zoom-group">
          <button
            type="button"
            onClick={() => setZoom(1.5)}
            aria-label={t('map.zoomIn', { defaultValue: 'Zoom in' })}
            title={t('map.zoomIn', { defaultValue: 'Zoom in' })}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1 / 1.5)}
            aria-label={t('map.zoomOut', { defaultValue: 'Zoom out' })}
            title={t('map.zoomOut', { defaultValue: 'Zoom out' })}
          >
            <Minus size={18} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          className="atlas-zoom-home"
          onClick={reset}
          aria-label={t('map.zoomReset', { defaultValue: 'Reset view' })}
          title={t('map.zoomReset', { defaultValue: 'Reset view' })}
        >
          <LocateFixed size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="atlas-coord mono">
        {t('map.projectionLabel', {
          defaultValue: 'EQUAL EARTH · {{pct}}%',
          pct: Math.round(position.zoom * 100),
        })}
      </div>
    </div>
  );
}

/** Lightweight, non-interactive mini map for friend cards and the login art. */
export const MiniMap = memo(function MiniMap({ data, none }: { data: TravelData; none?: string }) {
  const statusMap = useMemo(() => buildStatusMap(data), [data]);
  const fill = (status: MapStatus) => (status === 'none' && none ? none : STATUS_COLORS[status]);

  return (
    <ComposableMap
      projection="geoEqualEarth"
      projectionConfig={PROJECTION_CONFIG}
      width={MAP_WIDTH}
      height={MAP_HEIGHT}
      aria-hidden
      style={MINI_MAP_STYLE}
    >
      <Geographies geography={LOW_RES_COUNTRIES}>
        {({ geographies }) =>
          geographies.map((geo: { rsmKey: string; properties: { name: string } }) => (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              fill={fill(
                statusForGeography(countryNameForGeography(geo.properties.name), statusMap),
              )}
              stroke="var(--map-stroke)"
              strokeWidth={0.3}
              style={MINI_REGION_STYLE}
            />
          ))
        }
      </Geographies>
      {SUPPLEMENTAL_PLACES.map((place) => {
        const status = statusForGeography(place.name, statusMap);
        return (
          <Marker key={place.code} coordinates={place.coordinates}>
            <circle
              r={status === 'none' ? 0.8 : 1.15}
              fill={fill(status)}
              stroke="var(--map-stroke)"
              strokeWidth={0.35}
              vectorEffect="non-scaling-stroke"
            />
          </Marker>
        );
      })}
    </ComposableMap>
  );
});
