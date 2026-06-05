import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '@/features/editor/store';
import { computeStats, primaryStatus } from '@/domain/stats';
import { STATUS_COLORS } from '@/features/map/countryMatch';
import { FlagDisc } from '@/components/ui/FlagDisc';

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

function Bars({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="bars">
      {data.map((d) => (
        <div className="bar-row" key={d.label}>
          <span className="bar-label">{d.label}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(d.value / max) * 100}%`, background: color }}
            />
          </div>
          <span className="bar-val">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function Sparkline({
  yearTrips,
  color,
  label,
}: {
  yearTrips: Record<number, number>;
  color: string;
  label: string;
}) {
  const years = Object.keys(yearTrips)
    .map(Number)
    .sort((a, b) => a - b);
  if (years.length === 0) return <p className="empty-note">—</p>;
  const min = years[0]!;
  const max = years[years.length - 1]!;
  const all: { y: number; v: number }[] = [];
  for (let y = min; y <= max; y++) all.push({ y, v: yearTrips[y] ?? 0 });
  const peak = Math.max(...all.map((a) => a.v), 1);
  return (
    <div>
      <div className="spark">
        {all.map((a) => (
          <div
            key={a.y}
            className="spark-bar"
            title={`${a.y}: ${a.v}`}
            style={{
              height: `${Math.max(6, (a.v / peak) * 100)}%`,
              background: color,
              opacity: a.v ? 0.85 : 0.25,
            }}
          />
        ))}
      </div>
      <div className="spark-labels">
        <span>{min}</span>
        <span>{label}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Donut({
  segments,
  label,
  size = 132,
  stroke = 22,
}: {
  segments: { color: string; value: number }[];
  label: string;
  size?: number;
  stroke?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--panel-2)"
          strokeWidth={stroke}
        />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={i}
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

export function DashboardPage() {
  const { t } = useTranslation();
  const data = useEditorStore((s) => s.data);
  const stats = useMemo(() => computeStats(data), [data]);

  const topCities = useMemo(() => {
    const arr: {
      name: string;
      country: string;
      visits: number;
      status: ReturnType<typeof primaryStatus>;
    }[] = [];
    for (const c of data.travel.countries) {
      const status = primaryStatus(c);
      for (const city of c.cities) {
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

  const continents = Object.entries(stats.byContinent)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const donutSegs = (['birthplace', 'lived', 'visited', 'capital'] as const).map((k) => ({
    color: STATUS_COLORS[k],
    value: stats.byStatus[k],
    label: t(`map.legend.${k}`),
  }));

  const worldPct = Math.round((stats.traveled / 195) * 100);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">{t('dash.kicker')}</div>
          <h1 className="page-title">{t('dash.title')}</h1>
          <p className="page-lede">{t('dash.lede')}</p>
        </div>
      </div>

      <div className="stat-strip" style={{ marginBottom: 'var(--gap)' }}>
        <StatTile
          kicker={t('stats.countries')}
          num={stats.traveled}
          sub={`${worldPct}% ${t('dash.ofWorld')}`}
          color={STATUS_COLORS.visited}
        />
        <StatTile
          kicker={t('stats.cities')}
          num={stats.cities}
          sub={t('dash.acrossContinents', { n: continents.length })}
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
          num={stats.byStatus.lived + stats.byStatus.birthplace}
          sub={t('dash.calledHome')}
          color={STATUS_COLORS.capital}
        />
      </div>

      <div className="grid-editor">
        <div className="col">
          <div className="panel">
            <div className="panel-head">
              <h2>{t('dash.byContinent')}</h2>
              <span className="kicker">
                {stats.traveled} {t('dash.total')}
              </span>
            </div>
            <div className="panel-body">
              {continents.length ? (
                <Bars data={continents} color={STATUS_COLORS.visited} />
              ) : (
                <p className="empty-note">—</p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{t('dash.travelRhythm')}</h2>
              {stats.firstYear && (
                <span className="kicker">
                  {stats.firstYear}–{stats.lastYear}
                </span>
              )}
            </div>
            <div className="panel-body">
              <Sparkline
                yearTrips={stats.yearTrips}
                color={STATUS_COLORS.lived}
                label={t('dash.tripsPerYear')}
              />
            </div>
          </div>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panel-head">
              <h2>{t('dash.statusMix')}</h2>
            </div>
            <div className="panel-body">
              <div className="donut-wrap">
                <Donut segments={donutSegs} label={t('stats.countries').toUpperCase()} />
                <div className="donut-legend" style={{ flex: 1 }}>
                  {donutSegs.map((s, i) => (
                    <span className="legend-item" key={i}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        <span className="legend-sw" style={{ background: s.color }} />
                        {s.label}
                      </span>
                      <span className="mono">{s.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{t('dash.topDest')}</h2>
              <span className="kicker">{t('dash.byVisits')}</span>
            </div>
            <div className="panel-body">
              <div className="city-list">
                {topCities.length === 0 && <p className="empty-note">—</p>}
                {topCities.map((c, i) => (
                  <div
                    key={`${c.name}-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 2px',
                      borderBottom: i < topCities.length - 1 ? '1px solid var(--line)' : 'none',
                    }}
                  >
                    <span
                      className="serif"
                      style={{ fontSize: 20, color: 'var(--ink-faint)', width: 24 }}
                    >
                      {i + 1}
                    </span>
                    <FlagDisc name={c.country} status={c.status} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name || '—'}</div>
                      <div className="country-meta">{c.country}</div>
                    </div>
                    <span className="chip">
                      <span className="mono">{c.visits}×</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
