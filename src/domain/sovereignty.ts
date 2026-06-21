import { codeForEnglishName } from './countries';

/**
 * Sovereignty truth for honest "% of the world" math.
 *
 * The denominator for "countries of the world" is the 193 UN MEMBER STATES.
 * This set is typed out authoritatively below (NOT derived by subtracting a
 * few names from the picker) so the count cannot silently drift if the picker
 * gains or loses an entry. Cross-checked: exactly 193, no duplicates.
 *
 * Non-members that DO appear in the picker must never count toward the UN
 * numerator or denominator:
 *  - VA (Holy See / Vatican City) is a UN *observer state*, not a member.
 *  - TW (Taiwan) is not recognized as a UN member.
 * Unrecognized entities (Crimea, "DNR/LNR", etc.) are not separate countries
 * at all — they are not in the picker and never reach this layer.
 */

/** The canonical number of UN member states. */
export const UN_MEMBER_COUNT = 193 as const;

/**
 * The 193 UN member states as ISO 3166-1 alpha-2 codes, grouped by continent
 * for human auditability: Africa 54, Asia 47, Europe 43, Americas 35,
 * Oceania 14 = 193.
 */
export const UN_MEMBER_CODES: readonly string[] = [
  // Africa (54)
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI', 'DJ', 'EG',
  'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML',
  'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD',
  'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW',
  // Asia (47)
  'AF', 'AM', 'AZ', 'BH', 'BD', 'BT', 'BN', 'KH', 'CN', 'CY', 'GE', 'IN', 'ID', 'IR', 'IQ', 'IL',
  'JP', 'JO', 'KZ', 'KW', 'KG', 'LA', 'LB', 'MY', 'MV', 'MN', 'MM', 'NP', 'KP', 'OM', 'PK', 'PH',
  'QA', 'SA', 'SG', 'KR', 'LK', 'SY', 'TJ', 'TH', 'TL', 'TM', 'AE', 'UZ', 'VN', 'YE', 'TR',
  // Europe (43)
  'AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT',
  'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'GB',
  // Americas (35)
  'AG', 'AR', 'BS', 'BB', 'BZ', 'BO', 'BR', 'CA', 'CL', 'CO', 'CR', 'CU', 'DM', 'DO', 'EC', 'SV',
  'GD', 'GT', 'GY', 'HT', 'HN', 'JM', 'MX', 'NI', 'PA', 'PY', 'PE', 'KN', 'LC', 'VC', 'SR', 'TT',
  'US', 'UY', 'VE',
  // Oceania (14)
  'AU', 'FJ', 'KI', 'MH', 'FM', 'NR', 'NZ', 'PW', 'PG', 'WS', 'SB', 'TO', 'TV', 'VU',
];

const UN_MEMBER_SET = new Set<string>(UN_MEMBER_CODES);

/**
 * UN observer states present in the picker. Vatican (Holy See) is the only one
 * here; it is a *permanent observer*, never a member, so it is labelled honestly
 * but never counted. Taiwan is neither a member nor an observer → it falls
 * through to 'other' below.
 */
const OBSERVER_CODES = new Set<string>(['VA']);

/** UN recognition class of a place: member state, observer, or anything else. */
export type Recognition = 'un-member' | 'observer' | 'other';

/**
 * Resolve a value to an ISO 3166-1 alpha-2 code. Accepts either an alpha-2
 * code directly or a canonical English country name (resolved via countries.ts).
 */
function toCode(codeOrEnglishName: string): string | undefined {
  const raw = codeOrEnglishName.trim();
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  // A bare 2-letter token is treated as an ISO code.
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return codeForEnglishName(raw);
}

/** True only for the 193 UN member states. Vatican/Taiwan/unknown → false. */
export function isUnMember(codeOrEnglishName: string): boolean {
  const code = toCode(codeOrEnglishName);
  return code !== undefined && UN_MEMBER_SET.has(code);
}

/**
 * Recognition class for a code or English name:
 *  - 'un-member' for the 193 member states,
 *  - 'observer'  for UN observer states (Vatican),
 *  - 'other'     for everything else (Taiwan, unrecognized, unknown).
 */
export function recognition(codeOrEnglishName: string): Recognition {
  const code = toCode(codeOrEnglishName);
  if (code !== undefined && UN_MEMBER_SET.has(code)) return 'un-member';
  if (code !== undefined && OBSERVER_CODES.has(code)) return 'observer';
  // Anything not a member or observer (Taiwan, unrecognized, unknown) is 'other'.
  return 'other';
}
