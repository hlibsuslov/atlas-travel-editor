import worldData from 'world-atlas/countries-50m.json';
import type { TravelData } from '@/domain/schema';
import { canonicalCountryName } from '@/domain/countries';

/** Visual status of a country on the map, from strongest to weakest. */
export type MapStatus = 'birthplace' | 'lived' | 'visited' | 'capital' | 'none';

const RANK: Record<MapStatus, number> = {
  birthplace: 4,
  lived: 3,
  visited: 2,
  capital: 1,
  none: 0,
};

// Driven by the design tokens (see index.css :root) so map, legend and flag
// discs all share one palette.
export const STATUS_COLORS: Record<MapStatus, string> = {
  birthplace: 'var(--c-birthplace)',
  lived: 'var(--c-lived)',
  visited: 'var(--c-visited)',
  capital: 'var(--c-capital)',
  none: 'var(--c-none)',
};

/**
 * Aliases mapping common name variants to the canonical key. Both the user's
 * free-text names and the map's geography names are run through `canonical`, so
 * an entry here only needs to unify the two sides onto the same string.
 */
const ALIASES: Record<string, string> = {
  usa: 'united states of america',
  us: 'united states of america',
  'united states': 'united states of america',
  america: 'united states of america',
  uk: 'united kingdom',
  'great britain': 'united kingdom',
  england: 'united kingdom',
  britain: 'united kingdom',
  'republic of korea': 'south korea',
  'czech republic': 'czechia',
  uae: 'united arab emirates',
  'russian federation': 'russia',
  'the netherlands': 'netherlands',
  holland: 'netherlands',
  burma: 'myanmar',
  'ivory coast': "cote d'ivoire",
  'cape verde': 'cabo verde',
  swaziland: 'eswatini',
  macedonia: 'north macedonia',
  'democratic republic of the congo': 'dem rep congo',
  'dr congo': 'dem rep congo',
  'republic of the congo': 'congo',
};

/** Canonical comparison key for a country name. */
export function canonical(name: string): string {
  const s = canonicalCountryName(name);
  return ALIASES[s] ?? s;
}

/**
 * Build a map of `canonical country name -> strongest MapStatus` from a travel
 * document. The person's birthplace country is always marked as birthplace.
 */
export function buildStatusMap(data: TravelData): Map<string, MapStatus> {
  const result = new Map<string, MapStatus>();

  const setStrongest = (key: string, status: MapStatus) => {
    if (!key || status === 'none') return;
    const existing = result.get(key);
    if (!existing || RANK[status] > RANK[existing]) result.set(key, status);
  };

  setStrongest(canonical(data.person.birthplace.country), 'birthplace');

  for (const c of data.travel.countries) {
    const key = canonical(c.name);
    let status: MapStatus = 'none';
    if (c.status.birthplace) status = 'birthplace';
    else if (c.status.lived) status = 'lived';
    else if (c.status.visited) status = 'visited';
    else if (c.capitalVisit.visited) status = 'capital';
    setStrongest(key, status);
  }

  return result;
}

/** Resolve a geography's name to a status using the prebuilt map. */
export function statusForGeography(
  geographyName: string,
  statusMap: Map<string, MapStatus>,
): MapStatus {
  return statusMap.get(canonical(geographyName)) ?? 'none';
}

/** Canonical names present in the bundled atlas. */
const GEO_NAMES: ReadonlySet<string> = new Set(
  (
    worldData as unknown as {
      objects: { countries: { geometries: { properties: { name: string } }[] } };
    }
  ).objects.countries.geometries.map((g) => canonical(g.properties.name)),
);

/** Whether a (canonical) key exists on the bundled atlas. */
export function isOnAtlas(name: string): boolean {
  return GEO_NAMES.has(canonical(name));
}

/** How many of the user's statused countries actually appear on the atlas. */
export function computeCoverage(statusMap: Map<string, MapStatus>): {
  matched: number;
  total: number;
} {
  const keys = [...statusMap.keys()];
  return { total: keys.length, matched: keys.filter((k) => GEO_NAMES.has(k)).length };
}

/**
 * The user's statused country names that do NOT resolve to any geography on the
 * bundled atlas — i.e. the silently-uncoloured entries `computeCoverage` counts
 * as missed. Returns the original display names (deduped by canonical key, first
 * spelling wins, sorted) so the UI can list them and link back to the editor.
 */
export function unmatchedCountryNames(data: TravelData): string[] {
  const byKey = new Map<string, string>();
  const consider = (name: string) => {
    const display = name.trim();
    if (!display) return;
    const key = canonical(display);
    if (GEO_NAMES.has(key) || byKey.has(key)) return;
    byKey.set(key, display);
  };

  consider(data.person.birthplace.country);
  for (const c of data.travel.countries) {
    // Only flag countries that actually carry a status — an empty/placeholder
    // row isn't a "missed match", it's just unfinished.
    const statused =
      c.status.visited || c.status.lived || c.status.birthplace || c.capitalVisit.visited;
    if (statused) consider(c.name);
  }

  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}
