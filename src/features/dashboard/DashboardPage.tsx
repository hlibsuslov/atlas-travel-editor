import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '@/features/editor/store';
import { computeStats, primaryStatus, type BudgetStats, type PrimaryStatus } from '@/domain/stats';
import { STATUS_COLORS } from '@/features/map/countryMatch';
import { UN_MEMBER_COUNT } from '@/domain/sovereignty';
import { Flag } from '@/components/ui/Flag';
import { ContinentCards } from './ContinentCards';
import { MiniMap } from '@/features/map/WorldMap';
import './dashboard.css';

/* ---------------------------------------------------------------------------
   Small presentational helpers. Each reuses the shared design tokens / classes
   and only adds dashboard-specific structure.
   ------------------------------------------------------------------------- */

function Milestone({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="dash-milestone">
      <span className="dash-milestone-val">{value}</span>
      <span className="dash-milestone-label">{label}</span>
    </div>
  );
}

/**
 * Format an integer minor-unit amount + ISO code with Intl. Intl supplies the
 * currency's own fraction digits (JPY → 0, USD → 2), so we divide minor units by
 * the matching power of ten ONLY for display — storage stays in integer minor
 * units. Mirrors StaysEditor.formatMoney so the two surfaces read identically;
 * an unknown / non-ISO code degrades to "major-units CODE" instead of crashing.
 */
function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    return fmt.format(amount / 10 ** digits);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

/** How many spend-by-country bars to show before we stop (keeps the panel calm). */
const SPEND_COUNTRY_LIMIT = 6;

/**
 * "Travel spend" panel driven entirely by the pure `stats.budget` block.
 * Multi-currency is grouped by code and NEVER summed across currencies — there
 * is no live FX in a local-first app, so a single "total" would be dishonest.
 * Only rendered when there is at least one stay (the caller guards stayCount).
 */
function BudgetSection({ budget, locale }: { budget: BudgetStats; locale: string }) {
  const { t } = useTranslation();

  // Headline totals: one money string per currency, biggest first, joined with
  // a middot. Sorting by amount keeps the dominant currency leading the line.
  const headline = Object.entries(budget.spendByCurrency)
    .sort((a, b) => b[1] - a[1])
    .map(([currency, amount]) => formatMoney(amount, currency, locale))
    .join(' · ');

  // Spend-by-country bars are scaled against the single largest per-country,
  // per-currency figure so the longest bar is full-width and the rest relative.
  const countries = budget.spendByCountry.slice(0, SPEND_COUNTRY_LIMIT);
  const peak = countries.reduce((max, c) => {
    for (const amount of Object.values(c.byCurrency)) max = Math.max(max, amount);
    return max;
  }, 1);

  const avgEntries = Object.entries(budget.avgNightlyByCurrency).sort((a, b) => b[1] - a[1]);
  const hasSpend = headline.length > 0;

  return (
    <div className="panel dash-budget" style={{ marginTop: 'var(--gap)' }}>
      <div className="panel-head">
        <h2>{t('report.budget.title', 'Travel spend')}</h2>
        <span className="kicker">
          {t('report.budget.stays', '{{count}} stays', { count: budget.stayCount })}
        </span>
      </div>
      <div className="panel-body">
        {hasSpend ? (
          <>
            {/* Honest headline: each currency stands alone, never converted. */}
            <div className="dash-budget-headline">
              <div className="kicker">{t('report.budget.total', 'Total spend')}</div>
              <div className="dash-budget-total" aria-label={headline}>
                {headline}
              </div>
              {budget.currencyCount > 1 && (
                <p className="dash-budget-note">
                  {t(
                    'report.budget.multiCurrency',
                    'Shown per currency — never converted (offline, no live rates).',
                  )}
                </p>
              )}
            </div>

            <div className="dash-budget-grid">
              {/* Spend by country, with circular flags + per-currency totals. */}
              {countries.length > 0 && (
                <div className="dash-budget-block">
                  <div className="kicker dash-budget-block-head">
                    {t('report.budget.byCountry', 'Spend by country')}
                  </div>
                  <div className="bars">
                    {countries.map((c) => {
                      // A country that mixes currencies shows each on its own row,
                      // biggest first — we never add EUR to USD behind the scenes.
                      const lines = Object.entries(c.byCurrency).sort((a, b) => b[1] - a[1]);
                      return (
                        <div className="dash-budget-country" key={c.country}>
                          <div className="dash-budget-country-head">
                            <Flag name={c.country} size={22} />
                            <span className="dash-budget-country-name" title={c.country}>
                              {c.country}
                            </span>
                          </div>
                          {lines.map(([currency, amount]) => (
                            <div className="bar-row dash-budget-bar" key={currency}>
                              <span className="bar-label">{currency}</span>
                              <div className="bar-track">
                                <div
                                  className="bar-fill"
                                  style={{
                                    width: `${Math.max(4, (amount / peak) * 100)}%`,
                                    background: STATUS_COLORS.visited,
                                  }}
                                />
                              </div>
                              <span className="bar-val dash-budget-money">
                                {formatMoney(amount, currency, locale)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="dash-budget-block">
                {/* Nights + average nightly cost, per currency (never blended). */}
                <div className="kicker dash-budget-block-head">
                  {t('report.budget.nightly', 'Per night')}
                </div>
                <div className="dash-budget-nights">
                  <Milestone
                    value={budget.nights}
                    label={t('report.budget.nights', 'Total nights')}
                  />
                </div>
                {avgEntries.length > 0 ? (
                  <div className="dash-budget-avg">
                    {avgEntries.map(([currency, amount]) => (
                      <div className="dash-budget-avg-row" key={currency}>
                        <span className="dash-budget-avg-val mono">
                          {formatMoney(amount, currency, locale)}
                        </span>
                        <span className="dash-budget-avg-label">
                          {t('report.budget.perNight', '/ night')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-note">
                    {t('report.budget.noNights', 'Add dates to a stay to see nightly cost.')}
                  </p>
                )}

                {/* Top stays mini-list — most expensive first, each in its code. */}
                {budget.topStays.length > 0 && (
                  <>
                    <div className="kicker dash-budget-block-head dash-budget-top-head">
                      {t('report.budget.topStays', 'Top stays')}
                    </div>
                    <ol className="dash-budget-top">
                      {budget.topStays.map((stay, i) => (
                        <li className="dash-budget-top-row" key={`${stay.name}-${i}`}>
                          {stay.country ? (
                            <Flag name={stay.country} size={20} />
                          ) : (
                            <span className="dash-budget-top-nogeo" aria-hidden="true" />
                          )}
                          <span className="dash-budget-top-name" title={stay.name}>
                            {stay.name}
                          </span>
                          <span className="dash-budget-top-cost mono">
                            {formatMoney(stay.amount, stay.currency, locale)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          // Stays exist but none carry a cost yet — nudge, don't shout.
          <p className="empty-note">
            {t('report.budget.empty', 'No costs logged yet — add a cost to a stay to see spend.')}
          </p>
        )}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
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

  const statusSegs = (['birthplace', 'lived', 'visited', 'capital'] as const).map((k) => ({
    key: k,
    color: STATUS_COLORS[k],
    value: stats.byStatus[k],
    label: t(`map.legend.${k}`),
  }));
  const statusTotal = statusSegs.reduce((s, x) => s + x.value, 0);

  const { world, milestones } = stats;
  const homes = stats.byStatus.lived + stats.byStatus.birthplace;
  const seriesColor = series === 'discovery' ? STATUS_COLORS.visited : STATUS_COLORS.lived;
  // Label every year on short ranges; thin the axis on long ones.
  const labelEvery = yearChart ? Math.max(1, Math.ceil(yearChart.cols.length / 12)) : 1;

  return (
    <div className="page dash">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('dash.title')}</h1>
          <p className="page-lede">{t('dash.lede')}</p>
        </div>
      </div>

      {/* Hero: the honest share of the world (193 UN members), the supporting
          figures, and the record itself as a small map. */}
      <section className="panel dash-hero" aria-label={t('dash.hero.kicker')}>
        <div className="dash-hero-main">
          <div className="dash-hero-lead">
            <span className="dash-hero-pct">{world.pct}%</span>
            <div>
              <span className="dash-hero-label">
                {t('dash.hero.headline', { visited: world.visitedUnMembers })}
              </span>
              <span className="dash-hero-sub">
                <span>
                  {world.visitedUnMembers} / {UN_MEMBER_COUNT}
                </span>{' '}
                · {t('dash.hero.sub')}
              </span>
            </div>
          </div>
          <span className="dash-hero-meter" aria-hidden="true">
            <span style={{ width: `${Math.max(world.pct, world.visitedUnMembers ? 1 : 0)}%` }} />
          </span>
          <dl className="dash-hero-figures">
            <div>
              <dt>{t('stats.cities')}</dt>
              <dd>{stats.cities}</dd>
            </div>
            <div>
              <dt>{t('dash.yearsTravelling')}</dt>
              <dd>{stats.span}</dd>
            </div>
            <div>
              <dt>{t('dash.homes')}</dt>
              <dd>{homes}</dd>
            </div>
            <div>
              <dt>{t('dash.milestones.firstYear', 'First year')}</dt>
              <dd>{milestones.firstEverYear ?? '—'}</dd>
            </div>
          </dl>
          {world.nonMemberVisited > 0 && (
            <p className="dash-hero-note">
              {t('dash.hero.nonMembers', { count: world.nonMemberVisited })}
            </p>
          )}
        </div>
        <div className="dash-hero-map" aria-hidden="true">
          <MiniMap data={data} />
        </div>
      </section>

      <section className="panel dash-section">
        <div className="panel-head">
          <h2>{t('dash.byContinent')}</h2>
          <span className="chip">
            {world.visitedUnMembers} / {UN_MEMBER_COUNT}
          </span>
        </div>
        <div className="panel-body">
          <ContinentCards data={data} progress={stats.byContinentPct} />
        </div>
      </section>

      <div className="dash-grid">
        {/* Discovery over time: new countries OR trips per year, toggleable. */}
        <section className="panel dash-span-8">
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
                {t('dash.discovery.newCountries', 'New countries')}
              </button>
              <button
                type="button"
                className="dash-toggle-btn"
                aria-pressed={series === 'trips'}
                onClick={() => setSeries('trips')}
              >
                {t('dash.discovery.trips', 'Trips')}
              </button>
            </div>
          </div>
          <div className="panel-body">
            {yearChart ? (
              <ol
                className="year-chart"
                aria-label={
                  series === 'discovery'
                    ? t('dash.discovery.newCountriesLegend', 'new countries / year')
                    : t('dash.discovery.tripsLegend', 'trips / year')
                }
              >
                {yearChart.cols.map((col, i) => (
                  <li key={col.year} className="year-chart-col" title={`${col.year}: ${col.value}`}>
                    <span className="year-chart-value">{col.value || ''}</span>
                    <span className="year-chart-track">
                      <span
                        className="year-chart-bar"
                        style={{
                          height: `${(col.value / yearChart.peak) * 100}%`,
                          background: seriesColor,
                        }}
                      />
                    </span>
                    <span className="year-chart-year">
                      {i % labelEvery === 0 || i === yearChart.cols.length - 1 ? col.year : ''}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-note">{t('dash.empty.noTrips', 'No dated trips yet.')}</p>
            )}
          </div>
        </section>

        {/* Status mix as one stacked bar: proportions read at a glance. */}
        <section className="panel dash-span-4">
          <div className="panel-head">
            <h2>{t('dash.statusMix')}</h2>
          </div>
          <div className="panel-body">
            {statusTotal > 0 ? (
              <>
                <span className="status-stack" aria-hidden="true">
                  {statusSegs
                    .filter((s) => s.value > 0)
                    .map((s) => (
                      <span
                        key={s.key}
                        style={{ flexGrow: s.value, background: s.color }}
                        title={`${s.label}: ${s.value}`}
                      />
                    ))}
                </span>
                <ul className="status-list">
                  {statusSegs.map((s) => (
                    <li key={s.key}>
                      <span className="status-dot" style={{ background: s.color }} />
                      <span className="status-name">{s.label}</span>
                      <span className="status-count">{s.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="empty-note">
                {t('dash.empty.noCountries', 'No countries yet — add some in the editor.')}
              </p>
            )}
          </div>
        </section>

        <section className="panel dash-span-6">
          <div className="panel-head">
            <h2>{t('dash.milestones.title', 'Milestones')}</h2>
          </div>
          <div className="panel-body">
            {milestones.firstEverYear === null ? (
              <p className="empty-note">{t('dash.empty.noTrips', 'No dated trips yet.')}</p>
            ) : (
              <dl className="milestone-list">
                <div>
                  <dt>{t('dash.milestones.firstYear', 'First year')}</dt>
                  <dd>{milestones.firstEverYear}</dd>
                </div>
                <div>
                  <dt>{t('dash.milestones.busiestYear', 'Busiest year')}</dt>
                  <dd>
                    {milestones.busiestYear
                      ? `${milestones.busiestYear.year} · ${milestones.busiestYear.count}`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>{t('dash.milestones.activeYears', 'Years active')}</dt>
                  <dd>{milestones.activeYears}</dd>
                </div>
                <div>
                  <dt>{t('dash.milestones.longestStreak', 'Longest streak (yrs)')}</dt>
                  <dd>{milestones.longestStreak}</dd>
                </div>
              </dl>
            )}
          </div>
        </section>

        {/* Most-returned destinations, with flags. */}
        <section className="panel dash-span-6">
          <div className="panel-head">
            <h2>{t('dash.topDest')}</h2>
            <span className="chip">{t('dash.byVisits')}</span>
          </div>
          <div className="panel-body">
            {topCities.length === 0 ? (
              <p className="empty-note">
                {t('dash.empty.noCities', 'No city visits recorded yet.')}
              </p>
            ) : (
              <ol className="dest-list">
                {topCities.map((c, i) => (
                  <li key={`${c.country}-${c.name}-${i}`}>
                    <Flag name={c.country} status={c.status} size={28} />
                    <span className="dest-name">
                      {c.name || '—'}
                      <span>{c.country}</span>
                    </span>
                    <span className="dest-count">
                      {t('dash.visitsCount', '{{count}}×', { count: c.visits })}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>

      {/* Travel spend: only when a diary exists; otherwise nothing is shown. */}
      {stats.budget.stayCount > 0 && <BudgetSection budget={stats.budget} locale={i18n.language} />}
    </div>
  );
}
