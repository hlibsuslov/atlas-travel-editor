import { type MapStatus } from '@/features/map/countryMatch';
import { Flag } from './Flag';

/**
 * Round country disc tinted by travel status, kept as the app-wide call site
 * (CountryCard, Dashboard, Friends). It now renders the real circular flag
 * artwork via <Flag> — including the status ring — and falls back to a tinted
 * ISO-code disc when no flag is available. Props are unchanged so every
 * existing call site upgrades automatically; sizing honours the 30px
 * `.country-flag` contract by default.
 */
export function FlagDisc({ name, status }: { name: string; status: MapStatus }) {
  return <Flag name={name} status={status} />;
}
