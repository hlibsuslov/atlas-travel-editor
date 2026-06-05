/**
 * Canonical country list for the picker. We keep ISO 3166-1 alpha-2 codes and
 * derive display names at runtime with `Intl.DisplayNames`, so:
 *  - labels are localized to the active UI language for free, and
 *  - the value stored in the document is the canonical English name, which is
 *    exactly what the world atlas uses — so map matching stays exact.
 *
 * Crimea is intentionally NOT a separate entry: it is part of Ukraine.
 */
const ISO_CODES = [
  'AD',
  'AE',
  'AF',
  'AG',
  'AL',
  'AM',
  'AO',
  'AR',
  'AT',
  'AU',
  'AZ',
  'BA',
  'BB',
  'BD',
  'BE',
  'BF',
  'BG',
  'BH',
  'BI',
  'BJ',
  'BN',
  'BO',
  'BR',
  'BS',
  'BT',
  'BW',
  'BY',
  'BZ',
  'CA',
  'CD',
  'CF',
  'CG',
  'CH',
  'CI',
  'CL',
  'CM',
  'CN',
  'CO',
  'CR',
  'CU',
  'CV',
  'CY',
  'CZ',
  'DE',
  'DJ',
  'DK',
  'DM',
  'DO',
  'DZ',
  'EC',
  'EE',
  'EG',
  'ER',
  'ES',
  'ET',
  'FI',
  'FJ',
  'FM',
  'FR',
  'GA',
  'GB',
  'GD',
  'GE',
  'GH',
  'GM',
  'GN',
  'GQ',
  'GR',
  'GT',
  'GW',
  'GY',
  'HN',
  'HR',
  'HT',
  'HU',
  'ID',
  'IE',
  'IL',
  'IN',
  'IQ',
  'IR',
  'IS',
  'IT',
  'JM',
  'JO',
  'JP',
  'KE',
  'KG',
  'KH',
  'KI',
  'KM',
  'KN',
  'KP',
  'KR',
  'KW',
  'KZ',
  'LA',
  'LB',
  'LC',
  'LI',
  'LK',
  'LR',
  'LS',
  'LT',
  'LU',
  'LV',
  'LY',
  'MA',
  'MC',
  'MD',
  'ME',
  'MG',
  'MH',
  'MK',
  'ML',
  'MM',
  'MN',
  'MR',
  'MT',
  'MU',
  'MV',
  'MW',
  'MX',
  'MY',
  'MZ',
  'NA',
  'NE',
  'NG',
  'NI',
  'NL',
  'NO',
  'NP',
  'NR',
  'NZ',
  'OM',
  'PA',
  'PE',
  'PG',
  'PH',
  'PK',
  'PL',
  'PT',
  'PW',
  'PY',
  'QA',
  'RO',
  'RS',
  'RU',
  'RW',
  'SA',
  'SB',
  'SC',
  'SD',
  'SE',
  'SG',
  'SI',
  'SK',
  'SL',
  'SM',
  'SN',
  'SO',
  'SR',
  'SS',
  'ST',
  'SV',
  'SY',
  'SZ',
  'TD',
  'TG',
  'TH',
  'TJ',
  'TL',
  'TM',
  'TN',
  'TO',
  'TR',
  'TT',
  'TV',
  'TW',
  'TZ',
  'UA',
  'UG',
  'US',
  'UY',
  'UZ',
  'VA',
  'VC',
  'VE',
  'VN',
  'VU',
  'WS',
  'YE',
  'ZA',
  'ZM',
  'ZW',
] as const;

function displayNames(locale: string): Intl.DisplayNames {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  }
}

const enNames = displayNames('en');

export interface Country {
  code: string;
  /** Canonical English name — the value stored in the document. */
  en: string;
}

export const COUNTRIES: Country[] = ISO_CODES.map((code) => ({
  code,
  en: enNames.of(code) ?? code,
})).filter((c) => c.en && c.en !== c.code);

const EN_TO_CODE = new Map(COUNTRIES.map((c) => [c.en.toLowerCase(), c.code]));

export function codeForEnglishName(name: string): string | undefined {
  return EN_TO_CODE.get(name.trim().toLowerCase());
}

/** Localized display name for a stored (English) country name, or the input itself. */
export function localizedCountryName(englishName: string, locale: string): string {
  const code = codeForEnglishName(englishName);
  return code ? (displayNames(locale).of(code) ?? englishName) : englishName;
}

export interface CountryOption {
  code: string;
  /** Stored value (English name). */
  value: string;
  /** Localized label shown to the user. */
  label: string;
}

/** Country options sorted by their localized label for the active locale. */
export function countryOptions(locale: string): CountryOption[] {
  const dn = displayNames(locale);
  return COUNTRIES.map((c) => ({ code: c.code, value: c.en, label: dn.of(c.code) ?? c.en })).sort(
    (a, b) => a.label.localeCompare(b.label, locale),
  );
}
