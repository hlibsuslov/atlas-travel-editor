/**
 * Crimea is part of Ukraine. Base world atlases (Natural Earth) are inconsistent
 * about Crimea, so we draw it explicitly as an overlay tied to Ukraine's status
 * — it is coloured by Ukraine's status, clicking it edits Ukraine, and it is
 * labelled "Crimea (Ukraine)". This guarantees the map reflects the
 * internationally recognized border irrespective of the underlying dataset.
 */
/** The country whose status governs Crimea on the map. */
export const CRIMEA_OWNER = 'Ukraine';

interface CrimeaFeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: { name: string };
    geometry: { type: 'Polygon'; coordinates: [number, number][][] };
  }[];
}

/** Simplified Crimea coastline (lon, lat), accurate enough at world scale. */
const CRIMEA_RING: [number, number][] = [
  [33.6, 46.15],
  [34.3, 46.1],
  [34.9, 46.0],
  [35.4, 45.95],
  [35.95, 46.0],
  [36.3, 45.55],
  [36.62, 45.36],
  [36.2, 45.1],
  [35.7, 45.0],
  [35.2, 44.9],
  [34.8, 44.82],
  [34.3, 44.58],
  [33.95, 44.42],
  [33.6, 44.5],
  [33.42, 44.58],
  [33.35, 44.8],
  [33.25, 45.05],
  [33.0, 45.18],
  [32.55, 45.35],
  [32.7, 45.55],
  [33.05, 45.7],
  [33.3, 45.9],
  [33.55, 46.05],
  [33.6, 46.15],
];

export const CRIMEA_FEATURES: CrimeaFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Crimea' },
      geometry: { type: 'Polygon', coordinates: [CRIMEA_RING] },
    },
  ],
};
