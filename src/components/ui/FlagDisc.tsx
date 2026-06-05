import { STATUS_COLORS, type MapStatus } from '@/features/map/countryMatch';
import { codeForEnglishName } from '@/domain/countries';

/** Round disc showing a country's ISO code, tinted by its travel status. */
export function FlagDisc({ name, status }: { name: string; status: MapStatus }) {
  const iso = codeForEnglishName(name) ?? (name || '··').slice(0, 2).toUpperCase();
  return (
    <div className="country-flag" style={{ background: STATUS_COLORS[status] }}>
      {iso}
    </div>
  );
}
