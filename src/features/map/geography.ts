import { useEffect, useState } from 'react';
import { feature, merge } from 'topojson-client';
import type { GeometryCollection, MultiPolygon, Polygon, Topology } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { geoContains } from 'd3-geo';
import lowRes from 'world-atlas/countries-110m.json';

/**
 * World geometry for the maps, with Crimea drawn as part of Ukraine.
 *
 * Natural Earth ships Crimea as one polygon of Russia's MultiPolygon. Instead of
 * painting an approximate overlay on top, the polygon is moved into Ukraine at
 * the topology level and merged with it, so the border, hover, click, fill and
 * PNG export all follow the internationally recognized boundary.
 */

export interface CountryProperties {
  name: string;
}
export type CountryFeature = Feature<Geometry, CountryProperties> & { rsmKey?: string };

type CountryTopology = Topology<{ countries: GeometryCollection<CountryProperties> }>;

/** A point well inside Crimea (Simferopol), used to find its polygon. */
const CRIMEA_POINT: [number, number] = [34.1, 44.95];

function withCrimeaInUkraine(
  topology: CountryTopology,
): FeatureCollection<Geometry, CountryProperties> {
  const geometries = topology.objects.countries.geometries;
  const russia = geometries.find(
    (g) => (g.properties as CountryProperties | undefined)?.name === 'Russia',
  );
  const ukraine = geometries.find(
    (g) => (g.properties as CountryProperties | undefined)?.name === 'Ukraine',
  );
  const collection = feature(topology, topology.objects.countries);
  if (!russia || russia.type !== 'MultiPolygon' || !ukraine) return collection;

  const russiaPolygons = russia.arcs;
  const crimeaIndex = russiaPolygons.findIndex((arcs) =>
    geoContains(feature(topology, { type: 'Polygon', arcs } as Polygon), CRIMEA_POINT),
  );
  if (crimeaIndex < 0) return collection;

  const crimea: Polygon = { type: 'Polygon', arcs: russiaPolygons[crimeaIndex]! };
  const russiaRest: MultiPolygon = {
    type: 'MultiPolygon',
    arcs: russiaPolygons.filter((_, i) => i !== crimeaIndex),
  };
  const ukraineMerged = merge(topology, [ukraine as Polygon | MultiPolygon, crimea]) as Geometry;
  const russiaGeometry = feature(topology, russiaRest).geometry as Geometry;

  return {
    ...collection,
    features: collection.features.map((f) => {
      if (f.properties.name === 'Ukraine') return { ...f, geometry: ukraineMerged };
      if (f.properties.name === 'Russia') return { ...f, geometry: russiaGeometry };
      return f;
    }),
  };
}

function toCountryFeatures(topology: CountryTopology): CountryFeature[] {
  return withCrimeaInUkraine(topology).features.filter((f) => f.properties.name !== 'Antarctica');
}

/** 1:110m countries, bundled with the app: small, used for thumbnails and first paint. */
export const LOW_RES_COUNTRIES: CountryFeature[] = toCountryFeatures(
  lowRes as unknown as CountryTopology,
);

let detailed: CountryFeature[] | null = null;
let detailedPromise: Promise<CountryFeature[]> | null = null;

/** 1:50m countries, loaded as a separate chunk (coastlines, islands, microstates). */
export function loadDetailedCountries(): Promise<CountryFeature[]> {
  detailedPromise ??= import('world-atlas/countries-50m.json').then((mod) => {
    detailed = toCountryFeatures((mod.default ?? mod) as unknown as CountryTopology);
    return detailed;
  });
  return detailedPromise;
}

/**
 * Countries for the interactive map: the bundled 110m set renders immediately,
 * then the detailed 50m set replaces it once its chunk has loaded.
 */
export function useWorldCountries(): CountryFeature[] {
  const [countries, setCountries] = useState<CountryFeature[]>(detailed ?? LOW_RES_COUNTRIES);
  useEffect(() => {
    if (detailed) return;
    let alive = true;
    loadDetailedCountries()
      .then((next) => alive && setCountries(next))
      .catch(() => {
        // Keep the bundled low-resolution map if the chunk cannot load offline.
      });
    return () => {
      alive = false;
    };
  }, []);
  return countries;
}

/** Names present in the bundled geometry, for coverage checks. */
export const LOW_RES_NAMES: readonly string[] = LOW_RES_COUNTRIES.map((f) => f.properties.name);
