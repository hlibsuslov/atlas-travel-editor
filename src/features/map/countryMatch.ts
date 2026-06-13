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
  'south korea': 'south korea',
  'republic of korea': 'south korea',
  'north korea': 'north korea',
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
  vietnam: 'vietnam',
  laos: 'laos',
  syria: 'syria',
  tanzania: 'tanzania',
  bolivia: 'bolivia',
  venezuela: 'venezuela',
  iran: 'iran',
  moldova: 'moldova',
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

/** How many of the user's statused countries actually appear on the atlas. */
export function computeCoverage(statusMap: Map<string, MapStatus>): {
  matched: number;
  total: number;
} {
  const keys = [...statusMap.keys()];
  return { total: keys.length, matched: keys.filter((k) => GEO_NAMES.has(k)).length };
}
