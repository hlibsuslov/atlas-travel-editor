import { useCallback, useEffect, useRef, useState } from 'react';
import { geoBounds, geoCentroid } from 'd3-geo';

/**
 * Map zoom/pan logic, factored out of the WorldMap component so it can be unit
 * tested and reused without rendering. Owns the controlled `position`, the
 * zoom-to-fit math, and the deferred single-click that lets a double-click
 * cancel a pending status change.
 */

const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
// Viewport aspect (width 960 / height 500) used to balance lon vs lat fitting.
const VIEW_ASPECT = 960 / 500;
// Single-click is deferred this long so a follow-up double-click can cancel it.
const CLICK_DEFER_MS = 220;

export interface MapPosition {
  coordinates: [number, number];
  zoom: number;
}

export const WORLD_VIEW: MapPosition = { coordinates: [10, 30], zoom: MIN_ZOOM };

const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/**
 * Given a GeoJSON geography, return a controlled `position` that centres on the
 * geography and increases zoom so the country roughly fills the viewport,
 * clamped to [MIN_ZOOM, MAX_ZOOM]. Pure + exported for unit testing.
 */
export function zoomToFit(geo: unknown): MapPosition {
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
  const zoom = clampZoom(Math.min(zoomLon, zoomLat));

  const coordinates: [number, number] = [
    Number.isFinite(cLon) ? cLon : (minLon + maxLon) / 2,
    Number.isFinite(cLat) ? cLat : (minLat + maxLat) / 2,
  ];
  return { coordinates, zoom };
}

export function useMapZoom() {
  const [position, setPosition] = useState<MapPosition>(WORLD_VIEW);
  // Tracks a pending single-click so a double-click can cancel the status cycle.
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
  }, []);

  useEffect(() => clearPending, [clearPending]);

  /** Multiply the current zoom (e.g. 1.5 to zoom in, 1/1.5 to zoom out). */
  const setZoom = useCallback(
    (factor: number) => setPosition((p) => ({ ...p, zoom: clampZoom(p.zoom * factor) })),
    [],
  );

  const reset = useCallback(() => setPosition(WORLD_VIEW), []);

  /** Center + fit the given geography, cancelling any pending single-click. */
  const zoomToGeo = useCallback(
    (geo: unknown) => {
      clearPending();
      setPosition(zoomToFit(geo));
    },
    [clearPending],
  );

  /** Run `fn` after a short delay unless a double-click cancels it first. */
  const deferClick = useCallback(
    (fn: () => void) => {
      clearPending();
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        fn();
      }, CLICK_DEFER_MS);
    },
    [clearPending],
  );

  return { position, setPosition, setZoom, reset, zoomToGeo, deferClick };
}
