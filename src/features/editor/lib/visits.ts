import type { Country } from '@/domain/schema';
import { canonicalCountryName } from '@/domain/countries';

/** The country with this name (canonical match) and its index, or `[undefined, -1]`. */
export function findCountry(
  countries: readonly Country[],
  name: string,
): [Country | undefined, number] {
  const key = canonicalCountryName(name);
  const index = countries.findIndex((c) => canonicalCountryName(c.name) === key);
  return [countries[index], index];
}

/** "2023-09" → "September 2023" in the active locale; ranges and years pass through. */
export function formatVisit(entry: string, locale: string): string {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entry);
  if (ymd) {
    const date = new Date(Date.UTC(+ymd[1]!, +ymd[2]! - 1, +ymd[3]!));
    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  const ym = /^(\d{4})-(\d{2})$/.exec(entry);
  if (ym) {
    const date = new Date(Date.UTC(+ym[1]!, +ym[2]! - 1, 1));
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  return entry.replace('-', '–');
}
