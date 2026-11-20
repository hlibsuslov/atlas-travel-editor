import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TravelData } from '@/domain/schema';
import type { ContinentProgress } from '@/domain/stats';
import { primaryStatus } from '@/domain/stats';
import { CONTINENTS, continentForName, unMembersInContinent } from '@/domain/continents';
import { Flag } from '@/components/ui/Flag';

/** Flags shown per card before collapsing the rest into "+N". */
const FLAG_LIMIT = 8;

/**
 * One compact card per continent: visited / UN members, the share as a thin
 * bar, and the flags of the countries already reached there.
 */
export function ContinentCards({
  data,
  progress,
}: {
  data: TravelData;
  progress: Record<string, ContinentProgress>;
}) {
  const { t } = useTranslation();

  const visitedByContinent = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const c of data.travel.countries) {
      if (primaryStatus(c) === 'none') continue;
      const continent = continentForName(c.name);
      groups.set(continent, [...(groups.get(continent) ?? []), c.name]);
    }
    return groups;
  }, [data]);

  return (
    <div className="continent-cards">
      {CONTINENTS.map((continent) => {
        const p = progress[continent] ?? {
          visited: 0,
          unMembers: unMembersInContinent(continent),
          pct: 0,
        };
        const names = visitedByContinent.get(continent) ?? [];
        return (
          <article key={continent} className="continent-card">
            <header className="continent-card-head">
              <h3>{t(`continent.${continent.toLowerCase()}`, continent)}</h3>
              <span className="continent-card-pct">{p.pct}%</span>
            </header>
            <span className="continent-card-frac">
              {p.visited} / {p.unMembers}
            </span>
            <span className="continent-card-bar" aria-hidden="true">
              <span style={{ width: `${p.pct}%` }} />
            </span>
            <div className="continent-card-flags">
              {names.slice(0, FLAG_LIMIT).map((name) => (
                <Flag key={name} name={name} size={22} />
              ))}
              {names.length > FLAG_LIMIT && (
                <span className="continent-card-more">+{names.length - FLAG_LIMIT}</span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
