import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '@/features/editor/store';
import { computeStats, primaryStatus, type PrimaryStatus } from '@/domain/stats';
import { STATUS_COLORS } from '@/features/map/countryMatch';
import { continentForName, CONTINENTS } from '@/domain/continents';
import { UN_MEMBER_COUNT } from '@/domain/sovereignty';
import { Flag } from '@/components/ui/Flag';
import './dashboard.css';

/* ---------------------------------------------------------------------------
   Small presentational helpers. Each reuses the shared design tokens / classes
   and only adds dashboard-specific structure.
   ------------------------------------------------------------------------- */

function StatTile({
  kicker,
  num,
  sub,
  color,
}: {
  kicker: string;
  num: number | string;
  sub: string;
  color: string;
}) {
  return (
    <div className="stat-tile">
      <div className="kicker">{kicker}</div>
      <div className="stat-num">{num}</div>
      <div className="stat-sub">{sub}</div>
      <div className="stat-accent" style={{ background: color }} />
    </div>
  );
}

/** Hero progress ring: an SVG donut whose centre reads "<pct>%" and "x / 193". */
function ProgressRing({
  pct,
  centerTop,
  centerBottom,
  size = 168,
  stroke = 16,
}: {
  pct: number;
  centerTop: string;
  centerBottom: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fill = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="dash-hero-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--panel-2)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={STATUS_COLORS.visited}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${fill} ${c - fill}`}
            style={{ transition: 'stroke-dasharray .7s cubic-bezier(.3,.7,.4,1)' }}
          />
        </g>
      </svg>
      <div className="dash-ring-center">
        <span className="dash-ring-pct">{centerTop}</span>
        <span className="dash-ring-frac">{centerBottom}</span>
      </div>
    </div>
  );
}

function Milestone({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="dash-milestone">
      <span className="dash-milestone-val">{value}</span>
      <span className="dash-milestone-label">{label}</span>
    </div>
  );
}

/** One "Europe — 23 / 44 · 52%" progress row. */
function ContinentRow({
  name,
  visited,
  unMembers,
  pct,
}: {
  name: string;
  visited: number;
  unMembers: number;
  pct: number;
}) {
  return (
    <div className="dash-cont-row">
      <span className="dash-cont-name">{name}</span>
      <span className="dash-cont-frac">
        {visited} / {unMembers}
        <span className="pct">{pct}%</span>
      </span>
      <div className="dash-cont-track">
        <div
          className="dash-cont-fill"
          style={{ width: `${pct}%`, background: STATUS_COLORS.visited }}
        />
      </div>
    </div>
  );
}

/** Localized continent name (falls back to the raw bucket key for "Other"). */
function useContinentLabel() {
  const { t } = useTranslation();
  return (key: string) => t(`continent.${key.toLowerCase()}`, key);
}

export function DashboardPage() {
  const { t } = useTranslation();
  const continentLabel = useContinentLabel();
  const data = useEditorStore((s) => s.data);
  const stats = useMemo(() => computeStats(data), [data]);

  // Discovery chart can show either "new countries" or "trips" per year.
  const [series, setSeries] = useState<'discovery' | 'trips'>('discovery');

  // Top returned-to destinations (cities ranked by visit count).
  const topCities = useMemo(() => {
    const arr: { name: string; country: string; visits: number; status: PrimaryStatus }[] = [];
    for (const c of data.travel.countries) {
      const status = primaryStatus(c);
      for (const city of c.cities) {
        if (city.timeline.visited.length === 0) continue;
        arr.push({
          name: city.name,
          country: c.name,
          visits: city.timeline.visited.length,
          status,
        });
      }
    }
    return arr.sort((a, b) => b.visits - a.visits).slice(0, 6);
  }, [data]);

  // Visited countries grouped by continent, for the passport grid. Each entry
  // keeps its display name + dominant status so <Flag> can draw the right ring.
  const passport = useMemo(() => {
    const groups = new Map<string, { name: string; status: PrimaryStatus }[]>();
    for (const c of data.travel.countries) {
      const status = primaryStatus(c);
      if (status === 'none') continue;
      const continent = continentForName(c.name);
      const list = groups.get(continent) ?? [];
      list.push({ name: c.name, status });
      groups.set(continent, list);
    }
    const order = [...CONTINENTS, 'Other'];
    return order
      .filter((k) => groups.has(k))
      .map((k) => ({
        continent: k,
        countries: groups.get(k)!.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [data]);

  // Continent coverage rows: "x / y UN members", busiest continent first.
  const continentRows = useMemo(
    () =>
      Object.entries(stats.byContinentPct)
        .map(([key, p]) => ({ key, ...p }))
        .sort((a, b) => b.visited - a.visited || b.pct - a.pct),
    [stats.byContinentPct],
  );

  // Build a dense year axis for whichever series is active, so gap years show
  // as empty columns (an honest rhythm, not a misleading compressed one).
  const yearChart = useMemo(() => {
    const source = series === 'discovery' ? stats.newCountriesPerYear : stats.yearTrips;
    const years = Object.keys(source).map(Number);
    if (years.length === 0) return null;
    const min = Math.min(...years);
    const max = Math.max(...years);
    const cols: { year: number; value: number }[] = [];
    for (let y = min; y <= max; y++) cols.push({ year: y, value: source[y] ?? 0 });
    const peak = Math.max(...cols.map((col) => col.value), 1);
    return { cols, min, max, peak };
  }, [series, stats.newCountriesPerYear, stats.yearTrips]);

  const donutSegs = (['birthplace', 'lived', 'visited', 'capital'] as const).map((k) => ({
    color: STATUS_COLORS[k],
    value: stats.byStatus[k],
    label: t(`map.legend.${k}`),
  }));
  const donutTotal = donutSegs.reduce((s, x) => s + x.value, 0);

  const { world, milestones } = stats;
  const homes = stats.byStatus.lived + stats.byStatus.birthplace;
  const seriesColor = series === 'discovery' ? STATUS_COLORS.visited : STATUS_COLORS.lived;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">{t('dash.kicker')}</div>
          <h1 className="page-title">{t('dash.title')}</h1>
          <p className="page-lede">{t('dash.lede')}</p>
        </div>
      </div>

      {/* Hero: honest "% of the world" against the 193 UN member states. */}
      <div className="panel" style={{ marginBottom: 'var(--gap)' }}>
        <div className="panel-body">
          <div className="dash-hero">
            <ProgressRing
              pct={world.pct}
              centerTop={`${world.pct}%`}
              centerBottom={`${world.visitedUnMembers} / ${UN_MEMBER_COUNT}`}
            />
            <div className="dash-hero-copy">
              <div className="kicker">{t('dash.hero.kicker')}</div>
              <h2>
                {t('dash.hero.headline', '{{visited}} of 193 countries', {
                  visited: world.visitedUnMembers,
                })}
              </h2>
              <p>
                {t(
                  'dash.hero.sub',
                  'The world is the 193 UN member states. That is the honest denominator.',
                )}
              </p>
              {world.nonMemberVisited > 0 && (
                <p className="dash-hero-note">
                  {t('dash.hero.nonMembers', {
                    defaultValue:
                      'Plus {{count}} place not counted toward the % — Taiwan / Vatican are not UN members.',
                    count: world.nonMemberVisited,
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick-glance tiles. */}
      <div className="stat-strip" style={{ marginBottom: 'var(--gap)' }}>
        <StatTile
          kicker={t('stats.countries')}
          num={stats.traveled}
          sub={`${world.pct}% ${t('dash.ofWorld')}`}
          color={STATUS_COLORS.visited}
        />
        <StatTile
          kicker={t('stats.cities')}
          num={stats.cities}
          sub={t('dash.acrossContinents', { n: continentRows.length })}
          color={STATUS_COLORS.lived}
        />
        <StatTile
          kicker={t('dash.yearsTravelling')}
          num={stats.span}
          sub={stats.firstYear ? `${stats.firstYear} – ${stats.lastYear}` : '—'}
          color={STATUS_COLORS.birthplace}
        />
        <StatTile
          kicker={t('dash.homes')}
          num={homes}
          sub={t('dash.calledHome')}
          color={STATUS_COLORS.capital}
        />
      </div>

      {/* Milestones strip. */}
      <div className="panel" style={{ marginBottom: 'var(--gap)' }}>
        <div className="panel-head">
          <h2>{t('dash.milestones.title', 'Milestones')}</h2>
        </div>
        <div className="panel-body">
          {milestones.firstEverYear === null ? (
            <p className="empty-note">{t('dash.empty.noTrips', 'No dated trips yet.')}</p>
          ) : (
            <div className="dash-milestones">
              <Milestone
                value={milestones.firstEverYear}
                label={t('dash.milestones.firstYear', 'First year')}
              />
              <Milestone
                value={milestones.activeYears}
                label={t('dash.milestones.activeYears', 'Years active')}
              />
              <Milestone
                value={milestones.busiestYear ? milestones.busiestYear.year : '—'}
                label={t('dash.milestones.busiestYear', 'Busiest year')}
              />
              <Milestone
                value={milestones.longestStreak}
                label={t('dash.milestones.longestStreak', 'Longest streak (yrs)')}
              />
              <Milestone value={homes} label={t('dash.milestones.homes', 'Homes')} />
            </div>
          )}
        </div>
      </div>

      <div className="grid-editor">
        <div className="col">
          {/* Continent coverage as x / y UN members + progress bar. */}
          <div className="panel">
            <div className="panel-head">
              <h2>{t('dash.byContinent')}</h2>
              <span className="kicker">
                {world.visitedUnMembers} / {UN_MEMBER_COUNT}
              </span>
            </div>
            <div className="panel-body">
              {continentRows.length ? (
                <div className="dash-continents">
                  {continentRows.map((row) => (
                    <ContinentRow
                      key={row.key}
                      name={continentLabel(row.key)}
                      visited={row.visited}
                      unMembers={row.unMembers}
                      pct={row.pct}
                    />
                  ))}
                </div>
              ) : (
                <p className="empty-note">
                  {t('dash.empty.noCountries', 'No countries yet — add some in the editor.')}
                </p>
              )}
            </div>
          </div>

          {/* Discovery over time: new countries OR trips per year, toggleable. */}
          <div className="panel">
            <div className="panel-head">
              <h2>{t('dash.discovery.title', 'Discovery over time')}</h2>
              <div
                className="dash-discovery-toggle"
                role="group"
                aria-label={t('dash.discovery.toggleAria', 'Choose a series')}
              >
                <button
                  type="button"
                  className="dash-toggle-btn"
                  aria-pressed={series === 'discovery'}
                  onClick={() => setSeries('discovery')}
                >
                  <span
                    className="dash-toggle-sw"
                    style={{ background: STATUS_COLORS.visited }}
                    aria-hidden="true"
                  />
                  {t('dash.discovery.newCountries', 'New countries')}
                </button>
                <button
                  type="button"
                  className="dash-toggle-btn"
                  aria-pressed={series === 'trips'}
                  onClick={() => setSeries('trips')}
                >
                  <span
                    className="dash-toggle-sw"
                    style={{ background: STATUS_COLORS.lived }}
                    aria-hidden="true"
                  />
                  {t('dash.discovery.trips', 'Trips')}
                </button>
              </div>
            </div>
            <div className="panel-body">
              {yearChart ? (
                <>
                  <div className="dash-years">
                    {yearChart.cols.map((col) => (
                      <div className="dash-year-col" key={col.year}>
                        <div
                          className="dash-year-bar"
                          title={`${col.year}: ${col.value}`}
                          style={{
                            height: `${Math.max(3, (col.value / yearChart.peak) * 100)}%`,
                            background: seriesColor,
                            opacity: col.value ? 0.9 : 0.22,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="dash-year-labels">
                    <span>{yearChart.min}</span>
                    <span>
                      {series === 'discovery'
                        ? t('dash.discovery.newCountriesLegend', 'new countries / year')
                        : t('dash.discovery.tripsLegend', 'trips / year')}
                    </span>
                    <span>{yearChart.max}</span>
                  </div>
                  <div className="dash-callouts">
                    {milestones.busiestYear && (
                      <span className="chip">
                        {t('dash.discovery.busiest', 'Busiest')}{' '}
                        <span className="mono">
                          {milestones.busiestYear.year} ({milestones.busiestYear.count})
                        </span>
                      </span>
                    )}
                    {milestones.longestStreak > 1 && (
                      <span className="chip">
                        {t('dash.discovery.streak', 'Longest streak')}{' '}
                        <span className="mono">
                          {t('dash.discovery.streakYears', '{{count}} yrs', {
                            count: milestones.longestStreak,
                          })}
                        </span>
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="empty-note">{t('dash.empty.noTrips', 'No dated trips yet.')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="col">
          {/* Status mix donut. */}
          <div className="panel">
            <div className="panel-head">
              <h2>{t('dash.statusMix')}</h2>
            </div>
            <div className="panel-body">
              {donutTotal > 0 ? (
                <div className="donut-wrap">
                  <Donut
                    segments={donutSegs}
                    total={donutTotal}
                    label={t('stats.countries').toUpperCase()}
                  />
                  <div className="donut-legend" style={{ flex: 1 }}>
                    {donutSegs.map((s) => (
                      <span className="legend-item" key={s.label}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                          <span className="legend-sw" style={{ background: s.color }} />
                          {s.label}
                        </span>
                        <span className="mono">{s.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="empty-note">
                  {t('dash.empty.noCountries', 'No countries yet — add some in the editor.')}
                </p>
              )}
            </div>
          </div>

          {/* Most-returned destinations, with real circular flags. */}
          <div className="panel">
            <div className="panel-head">
              <h2>{t('dash.topDest')}</h2>
              <span className="kicker">{t('dash.byVisits')}</span>
            </div>
            <div className="panel-body">
              {topCities.length === 0 ? (
                <p className="empty-note">
                  {t('dash.empty.noCities', 'No city visits recorded yet.')}
                </p>
              ) : (
                <div>
                  {topCities.map((c, i) => (
                    <div className="dash-dest-row" key={`${c.country}-${c.name}-${i}`}>
                      <span className="dash-dest-rank">{i + 1}</span>
                      <Flag name={c.country} status={c.status} />
                      <div className="dash-dest-body">
                        <div className="dash-dest-name">{c.name || '—'}</div>
                        <div className="country-meta">{c.country}</div>
                      </div>
                      <span className="chip">
                        <span className="mono">
                          {t('dash.visitsCount', '{{count}}×', { count: c.visits })}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Passport: every visited country, grouped by continent, with flags. */}
      <div className="panel" style={{ marginTop: 'var(--gap)' }}>
        <div className="panel-head">
          <h2>{t('dash.passport.title', 'Passport')}</h2>
          <span className="kicker">
            {stats.traveled} {t('dash.total')}
          </span>
        </div>
        <div className="panel-body">
          {passport.length === 0 ? (
            <p className="empty-note">
              {t('dash.empty.noCountries', 'No countries yet — add some in the editor.')}
            </p>
          ) : (
            <div className="dash-passport">
              {passport.map((group) => (
                <div key={group.continent}>
                  <div className="dash-passport-group-head">
                    <h3>{continentLabel(group.continent)}</h3>
                    <span className="kicker">
                      {group.countries.length}
                      {/* Show the UN-member denominator for the five real continents. */}
                      {group.continent !== 'Other' &&
                        ` / ${stats.byContinentPct[group.continent]?.unMembers ?? ''}`}
                    </span>
                  </div>
                  <div className="dash-passport-flags">
                    {group.countries.map((c) => (
                      <div className="dash-passport-item" key={c.name}>
                        <Flag name={c.name} status={c.status} size={26} />
                        <span className="name" title={c.name}>
                          {c.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Status-mix donut: reuses the existing donut visual contract. */
function Donut({
  segments,
  total,
  label,
  size = 132,
  stroke = 22,
}: {
  segments: { color: string; value: number }[];
  total: number;
  label: string;
  size?: number;
  stroke?: number;
}) {
  const safeTotal = total || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--panel-2)"
          strokeWidth={stroke}
        />
        {segments.map((s) => {
          const len = (s.value / safeTotal) * c;
          const el = (
            <circle
              key={s.color}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              style={{ transition: 'stroke-dasharray .6s ease, stroke-dashoffset .6s ease' }}
            />
          );
          offset += len;
          return el;
        })}
      </g>
      <text
        x="50%"
        y="48%"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize="30"
        fontWeight="500"
        fill="var(--ink)"
        dominantBaseline="middle"
      >
        {total}
      </text>
      <text
        x="50%"
        y="62%"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="8"
        letterSpacing="1.4"
        fill="var(--ink-faint)"
      >
        {label}
      </text>
    </svg>
  );
}
