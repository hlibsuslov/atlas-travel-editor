import type { City, Country, TravelData } from './schema';
import { canonicalCountryName } from './countries';

/**
 * Canonical, diff-friendly form of a document for export.
 *
 * Editing can leave harmless noise behind: timeline entries in the order they
 * were typed, the same city entered twice with different capitalisation, empty
 * rows that were never filled in. None of it is invalid, but a file a person
 * keeps should read cleanly. This never drops information: duplicates are
 * merged, not discarded, and country order (which the person controls) is kept.
 */

/** Sort key that orders `YYYY`, `YYYY-MM`, `YYYY-MM-DD` and `YYYY-YYYY` chronologically. */
function timelineKey(entry: string): string {
  const [start = '', end = ''] = entry.includes('-') && entry.length === 9 ? entry.split('-') : [];
  if (start && end) return `${start}-00-00~${end}`;
  return entry.padEnd(10, '-');
}

export function tidyTimeline(entries: readonly string[]): string[] {
  const unique = Array.from(new Set(entries.map((e) => e.trim()).filter(Boolean)));
  return unique.sort((a, b) => timelineKey(a).localeCompare(timelineKey(b)));
}

function tidyCities(cities: readonly City[]): City[] {
  const byKey = new Map<string, City>();
  for (const city of cities) {
    const name = city.name.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    const existing = byKey.get(key);
    const years = [...(existing?.timeline.visited ?? []), ...city.timeline.visited];
    byKey.set(key, {
      name: existing?.name ?? name,
      timeline: { visited: Array.from(new Set(years)).sort((a, b) => a - b) },
    });
  }
  return [...byKey.values()];
}

function mergeCountry(into: Country, from: Country): Country {
  return {
    name: into.name,
    status: {
      visited: into.status.visited || from.status.visited,
      lived: into.status.lived || from.status.lived,
      birthplace: into.status.birthplace || from.status.birthplace,
    },
    capitalVisit: { visited: into.capitalVisit.visited || from.capitalVisit.visited },
    timeline: {
      visited: [...into.timeline.visited, ...from.timeline.visited],
      lived: [...into.timeline.lived, ...from.timeline.lived],
    },
    cities: [...into.cities, ...from.cities],
  };
}

export function tidyTravelData(data: TravelData): TravelData {
  const byKey = new Map<string, Country>();
  for (const country of data.travel.countries) {
    const name = country.name.trim();
    if (!name) continue;
    const key = canonicalCountryName(name);
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeCountry(existing, country) : { ...country, name });
  }

  const countries = [...byKey.values()].map((c) => ({
    name: c.name,
    status: c.status,
    capitalVisit: c.capitalVisit,
    timeline: { visited: tidyTimeline(c.timeline.visited), lived: tidyTimeline(c.timeline.lived) },
    cities: tidyCities(c.cities),
  }));

  const result: TravelData = {
    person: { birthplace: { country: data.person.birthplace.country.trim() } },
    travel: { countries },
  };
  const stays = data.travel.stays?.filter((s) => s.name.trim());
  if (stays?.length) {
    result.travel.stays = [...stays].sort((a, b) => (a.from ?? '').localeCompare(b.from ?? ''));
  }
  return result;
}
