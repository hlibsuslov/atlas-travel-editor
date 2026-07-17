import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Profiler } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { WorldMap, MiniMap } from './WorldMap';
import { WORLD_VIEW, zoomToFit } from './useMapZoom';
import type { TravelData } from '@/domain/schema';

// jsdom does not implement the SVG geometry properties d3-zoom reads when the
// ZoomableGroup mounts (viewBox.baseVal / width.baseVal). Provide minimal stubs
// so <WorldMap> can render in tests; this only affects the test environment.
beforeAll(() => {
  const svgProto = window.SVGSVGElement.prototype as unknown as Record<string, unknown>;
  if (!('viewBox' in svgProto)) {
    Object.defineProperty(svgProto, 'viewBox', {
      configurable: true,
      get() {
        return { baseVal: { x: 0, y: 0, width: 960, height: 500 } };
      },
    });
  }
  const elProto = window.SVGElement.prototype as unknown as Record<string, unknown>;
  for (const dim of ['width', 'height'] as const) {
    if (!(dim in elProto)) {
      Object.defineProperty(elProto, dim, {
        configurable: true,
        get() {
          return { baseVal: { value: dim === 'width' ? 960 : 500 } };
        },
      });
    }
  }
});

// The world default the controlled ZoomableGroup starts at / RESET returns to.
const WORLD_DEFAULT = { coordinates: [10, 30], zoom: 1 };

// Synthetic country geometries. Rings use counter-clockwise winding so d3-geo's
// spherical interior matches the small box (the same winding world-atlas uses).
function box(coords: Array<[number, number]>) {
  return {
    type: 'Feature' as const,
    properties: { name: 'Testland' },
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
  };
}

// ~10°×10° box centred near [20, 50].
const smallCountry = box([
  [15, 45],
  [15, 55],
  [25, 55],
  [25, 45],
  [15, 45],
]);

// Minimal travel document marking France as visited so at least one geography
// has a non-"none" status to announce.
const sampleData: TravelData = {
  person: { birthplace: { country: 'France' } },
  travel: {
    countries: [
      {
        name: 'France',
        status: { visited: true, lived: false, birthplace: true },
        capitalVisit: { visited: false },
        timeline: { visited: [], lived: [] },
        cities: [],
      },
    ],
  },
};

describe('WORLD_VIEW (RESET target)', () => {
  it('matches the documented world view { coordinates: [10, 30], zoom: 1 }', () => {
    expect(WORLD_VIEW.coordinates).toEqual(WORLD_DEFAULT.coordinates);
    expect(WORLD_VIEW.zoom).toBe(WORLD_DEFAULT.zoom);
  });
});

describe('zoomToFit (applied on double-click)', () => {
  it('updates the position to a higher zoom centred away from the world default', () => {
    const pos = zoomToFit(smallCountry);

    // Higher zoom than the world view.
    expect(pos.zoom).toBeGreaterThan(WORLD_DEFAULT.zoom);

    // Re-centred on the country centroid (~[20, 50]), away from the world default.
    expect(pos.coordinates).not.toEqual(WORLD_DEFAULT.coordinates);
    expect(pos.coordinates[0]).toBeGreaterThan(15);
    expect(pos.coordinates[0]).toBeLessThan(25);
    expect(pos.coordinates[1]).toBeGreaterThan(45);
    expect(pos.coordinates[1]).toBeLessThan(55);
  });

  it('clamps zoom within the existing minZoom 1 / maxZoom 10 bounds', () => {
    const wholeWorld = box([
      [-179, -85],
      [-179, 85],
      [179, 85],
      [179, -85],
      [-179, -85],
    ]);
    const tiny = box([
      [20, 50],
      [20, 50.1],
      [20.1, 50.1],
      [20.1, 50],
      [20, 50],
    ]);

    // A world-sized geography cannot zoom below the minimum.
    expect(zoomToFit(wholeWorld).zoom).toBe(1);
    // A pin-sized geography is capped at the maximum.
    expect(zoomToFit(tiny).zoom).toBe(10);

    // Anything in between stays within bounds.
    const mid = zoomToFit(smallCountry).zoom;
    expect(mid).toBeGreaterThanOrEqual(1);
    expect(mid).toBeLessThanOrEqual(10);
  });
});

describe('<WorldMap> accessibility (G3)', () => {
  it('exposes the interactive map container as a labelled group', () => {
    render(<WorldMap data={sampleData} />);
    const group = screen.getByRole('group', { name: 'World travel map' });
    expect(group).toBeInTheDocument();
  });

  it('exposes each interactive country as a button with a name announcing country + status', () => {
    render(<WorldMap data={sampleData} />);
    const countries = screen.getAllByRole('button');
    // Many geographies plus the three zoom controls — there should be lots.
    expect(countries.length).toBeGreaterThan(3);

    // At least one geography exposes an accessible name containing a country name.
    const named = countries
      .map((el) => el.getAttribute('aria-label') ?? '')
      .filter((label) => label.includes(':'));
    expect(named.length).toBeGreaterThan(0);

    // France was marked visited/birthplace, so it announces its localized name + status.
    expect(screen.getByRole('button', { name: 'France: Birthplace' })).toBeInTheDocument();
  });

  it('gives the three zoom controls translatable accessible names', () => {
    render(<WorldMap data={sampleData} />);
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset view' })).toBeInTheDocument();
  });

  it('moves the tooltip without committing a React render on every mousemove', async () => {
    const onRender = vi.fn();
    render(
      <Profiler id="map" onRender={onRender}>
        <WorldMap data={sampleData} />
      </Profiler>,
    );

    const group = screen.getByRole('group', { name: 'World travel map' });
    vi.spyOn(group, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 960,
      bottom: 500,
      width: 960,
      height: 500,
      toJSON: () => ({}),
    });
    const france = screen.getByRole('button', { name: 'France: Birthplace' });
    fireEvent.mouseEnter(france, { clientX: 120, clientY: 90 });
    const tooltip = screen.getByRole('tooltip');
    expect(within(tooltip).getByText('France')).toBeInTheDocument();
    await waitFor(() => expect(tooltip.style.transform).toContain('translate3d'));

    const commitsAfterEnter = onRender.mock.calls.length;
    const firstTransform = tooltip.style.transform;
    fireEvent.mouseMove(france, { clientX: 140, clientY: 100 });
    fireEvent.mouseMove(france, { clientX: 160, clientY: 110 });
    fireEvent.mouseMove(france, { clientX: 180, clientY: 120 });
    await waitFor(() => expect(tooltip.style.transform).not.toBe(firstTransform));

    // Coordinates are applied directly to the tooltip element; the memoized SVG
    // tree and its parent do not commit another React update for pointer motion.
    expect(onRender).toHaveBeenCalledTimes(commitsAfterEnter);
  });
});

describe('<MiniMap> is decorative', () => {
  it('exposes no interactive button roles and is hidden from assistive tech', () => {
    const { container } = render(<MiniMap data={sampleData} />);
    expect(screen.queryByRole('button')).toBeNull();
    // The map svg wrapper is marked aria-hidden so it makes no announcements.
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

// A single click on a country is deferred (so a double-click can cancel it). The
// behaviour-under-brush tests advance fake timers to fire that deferred action.
describe('<WorldMap> brush + precise click behaviour', () => {
  // The France geography button, identified by its accessible name.
  const france = () => screen.getByRole('button', { name: 'France: Birthplace' });

  it('default (cycle brush): a click cycles via onCountryClick, not onSetStatus', () => {
    vi.useFakeTimers();
    try {
      const onCountryClick = vi.fn();
      const onSetStatus = vi.fn();
      render(
        <WorldMap data={sampleData} onCountryClick={onCountryClick} onSetStatus={onSetStatus} />,
      );
      fireEvent.click(france());
      vi.advanceTimersByTime(300);
      expect(onCountryClick).toHaveBeenCalledWith('France');
      expect(onSetStatus).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('an active paint brush applies that status directly via onSetStatus', () => {
    vi.useFakeTimers();
    try {
      const onCountryClick = vi.fn();
      const onSetStatus = vi.fn();
      render(
        <WorldMap
          data={sampleData}
          onCountryClick={onCountryClick}
          onSetStatus={onSetStatus}
          brush="lived"
        />,
      );
      fireEvent.click(france());
      vi.advanceTimersByTime(300);
      // France is currently birthplace, so the "lived" brush applies "lived".
      expect(onSetStatus).toHaveBeenCalledWith('France', 'lived');
      expect(onCountryClick).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('the erase brush clears the country to none via onSetStatus', () => {
    vi.useFakeTimers();
    try {
      const onSetStatus = vi.fn();
      render(<WorldMap data={sampleData} onSetStatus={onSetStatus} brush="erase" />);
      fireEvent.click(france());
      vi.advanceTimersByTime(300);
      expect(onSetStatus).toHaveBeenCalledWith('France', 'none');
    } finally {
      vi.useRealTimers();
    }
  });

  it('precise mode opens the per-country status popover instead of painting', () => {
    const onCountryClick = vi.fn();
    const onSetStatus = vi.fn();
    render(
      <WorldMap
        data={sampleData}
        onCountryClick={onCountryClick}
        onSetStatus={onSetStatus}
        precise
      />,
    );
    fireEvent.click(france());
    // A labelled status menu appears; nothing was painted yet.
    const menu = screen.getByRole('menu', { name: /Set status for France/ });
    expect(menu).toBeInTheDocument();
    expect(onCountryClick).not.toHaveBeenCalled();
    expect(onSetStatus).not.toHaveBeenCalled();

    // Choosing a status from the popover calls onSetStatus and closes it.
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Visited' }));
    expect(onSetStatus).toHaveBeenCalledWith('France', 'visited');
  });

  it('does not paint or open a popover when readOnly', () => {
    vi.useFakeTimers();
    try {
      const onSetStatus = vi.fn();
      render(<WorldMap data={sampleData} onSetStatus={onSetStatus} brush="visited" readOnly />);
      fireEvent.click(france());
      vi.advanceTimersByTime(300);
      expect(onSetStatus).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
