import worldData from 'world-atlas/countries-110m.json';

/**
 * The low-detail Natural Earth topology used for the interactive map.
 *
 * Compared with countries-50m it contains roughly 7x fewer source bytes and
 * 10x fewer arc points, which makes SVG pan/zoom and map mounts substantially
 * cheaper. Natural Earth omits very small sovereign states at this resolution,
 * so those are retained below as inexpensive point markers instead of pulling
 * the full 50m geometry back into the browser.
 */
export const WORLD_GEO = worldData as unknown as Record<string, unknown>;

export interface SupplementalPlace {
  /** Canonical English value used by the country picker and stored documents. */
  name: string;
  /** ISO 3166-1 alpha-2 code, used by flags and tests. */
  code: string;
  /** Geographic centroid [longitude, latitude]. */
  coordinates: [number, number];
}

/** Sovereign states omitted by Natural Earth's 110m country polygons. */
export const SUPPLEMENTAL_PLACES: readonly SupplementalPlace[] = [
  { name: 'Andorra', code: 'AD', coordinates: [1.561, 42.542] },
  { name: 'Antigua & Barbuda', code: 'AG', coordinates: [-61.794, 17.276] },
  { name: 'Bahrain', code: 'BH', coordinates: [50.542, 26.042] },
  { name: 'Barbados', code: 'BB', coordinates: [-59.56, 13.181] },
  { name: 'Cape Verde', code: 'CV', coordinates: [-23.958, 15.955] },
  { name: 'Comoros', code: 'KM', coordinates: [43.684, -11.879] },
  { name: 'Dominica', code: 'DM', coordinates: [-61.358, 15.439] },
  { name: 'Grenada', code: 'GD', coordinates: [-61.682, 12.117] },
  { name: 'Kiribati', code: 'KI', coordinates: [-167.922, 0.893] },
  { name: 'Liechtenstein', code: 'LI', coordinates: [9.536, 47.137] },
  { name: 'Maldives', code: 'MV', coordinates: [73.457, 3.732] },
  { name: 'Malta', code: 'MT', coordinates: [14.405, 35.922] },
  { name: 'Marshall Islands', code: 'MH', coordinates: [170.331, 7.015] },
  { name: 'Mauritius', code: 'MU', coordinates: [57.571, -20.278] },
  { name: 'Micronesia', code: 'FM', coordinates: [153.297, 7.536] },
  { name: 'Monaco', code: 'MC', coordinates: [7.407, 43.753] },
  { name: 'Nauru', code: 'NR', coordinates: [166.933, -0.519] },
  { name: 'Palau', code: 'PW', coordinates: [134.406, 7.286] },
  { name: 'St. Kitts & Nevis', code: 'KN', coordinates: [-62.687, 17.265] },
  { name: 'St. Lucia', code: 'LC', coordinates: [-60.97, 13.895] },
  { name: 'St. Vincent & Grenadines', code: 'VC', coordinates: [-61.201, 13.225] },
  { name: 'Samoa', code: 'WS', coordinates: [-172.165, -13.754] },
  { name: 'San Marino', code: 'SM', coordinates: [12.459, 43.942] },
  { name: 'São Tomé & Príncipe', code: 'ST', coordinates: [6.723, 0.443] },
  { name: 'Seychelles', code: 'SC', coordinates: [55.476, -4.66] },
  { name: 'Singapore', code: 'SG', coordinates: [103.817, 1.359] },
  { name: 'Tonga', code: 'TO', coordinates: [-174.8, -20.416] },
  { name: 'Tuvalu', code: 'TV', coordinates: [178.528, -7.769] },
  { name: 'Vatican City', code: 'VA', coordinates: [12.454, 41.903] },
] as const;
