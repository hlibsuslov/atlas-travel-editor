import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Globe, Share2 } from 'lucide-react';
import { useEditorStore } from '@/features/editor/store';
import { useTravelData } from '@/features/editor/hooks/useTravelData';
import { validateTravelData } from '@/domain/schema';
import { computeStats } from '@/domain/stats';
import { env } from '@/lib/env';
import { CountryCard } from './components/CountryCard';
import { CountrySelect } from './components/CountrySelect';
import { FilterInput } from './components/FilterInput';
import { JsonPreview } from './components/JsonPreview';
import { ImportModal } from './components/ImportModal';

export function EditorPage() {
  const { t } = useTranslation();
  const data = useEditorStore((s) => s.data);
  const dirty = useEditorStore((s) => s.dirty);
  const setBirthplace = useEditorStore((s) => s.setBirthplace);
  const ensureCountry = useEditorStore((s) => s.ensureCountry);
  const setData = useEditorStore((s) => s.setData);

  const { record, save, share } = useTravelData();
  const [importOpen, setImportOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const validation = useMemo(() => validateTravelData(data), [data]);
  const stats = useMemo(() => computeStats(data), [data]);
  const invalidCountries = useMemo(() => {
    const set = new Set<number>();
    for (const issue of validation.errors) {
      const m = /^travel\.countries\.(\d+)\b/.exec(issue);
      if (m) set.add(Number(m[1]));
    }
    return set;
  }, [validation]);

  const visibleCountries = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return data.travel.countries
      .map((country, idx) => ({ country, idx }))
      .filter(({ country }) => !q || country.name.toLowerCase().includes(q));
  }, [data.travel.countries, filter]);

  const shareUrl =
    record?.isPublic && record.shareSlug ? `${env.appUrl}/share/${record.shareSlug}` : null;

  const onSave = () =>
    save.mutate(data, {
      onSuccess: () => toast.success(t('toast.saved')),
      onError: (e) =>
        toast.error(t('toast.saveFailed', { message: e instanceof Error ? e.message : '' })),
    });

  const onShare = () =>
    share.mutate(!record?.isPublic, {
      onSuccess: (r) => toast.success(r.isPublic ? t('toast.shareOn') : t('toast.shareOff')),
    });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">{t('editor.kicker')}</div>
          <h1 className="page-title">
            {t('editor.bornIn')} <em>{data.person.birthplace.country || '—'}</em>
          </h1>
          <p className="page-lede">{t('editor.lede')}</p>
        </div>
        <div className="toolbar">
          <span className={`pill ${dirty ? 'pill-warn' : 'pill-ok'}`}>
            <span className="dot" />
            {dirty ? t('status.unsaved') : t('status.synced')}
          </span>
          <button className="btn btn-sm" disabled={share.isPending} onClick={onShare}>
            <Share2 size={14} /> {record?.isPublic ? t('actions.makePrivate') : t('actions.share')}
          </button>
          <button className="btn btn-sm" onClick={() => setImportOpen(true)}>
            {t('actions.import')}
          </button>
          <button
            className="btn btn-sm btn-primary"
            disabled={save.isPending || !validation.ok}
            onClick={onSave}
          >
            <Check size={14} /> {save.isPending ? t('actions.saving') : t('actions.save')}
          </button>
        </div>
      </div>

      {shareUrl && (
        <div className="notice-bar" style={{ marginBottom: 'var(--gap)' }}>
          <Globe size={15} />
          <span>{t('editor.liveAt')}</span>
          <a href={shareUrl} target="_blank" rel="noreferrer">
            {shareUrl}
          </a>
        </div>
      )}

      <div className="grid-editor">
        <div className="col">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>{t('editor.person')}</h2>
                <div className="sub">{t('editor.personSub')}</div>
              </div>
            </div>
            <div className="panel-body">
              <div className="field" style={{ marginBottom: 0 }}>
                <div className="field-label">
                  <span>{t('editor.birthplace')}</span>
                  <span className="req">{t('editor.required')}</span>
                </div>
                <CountrySelect
                  value={data.person.birthplace.country}
                  onChange={setBirthplace}
                  ariaLabel={t('editor.birthplace')}
                />
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>{t('editor.countries')}</h2>
                <div className="sub">
                  {data.travel.countries.length} {t('editor.entries')} · {stats.cities}{' '}
                  {t('stats.cities').toLowerCase()}
                </div>
              </div>
              <div className="country-add">
                <CountrySelect
                  value=""
                  onChange={(name) => ensureCountry(name)}
                  ariaLabel={t('actions.addCountry')}
                />
              </div>
            </div>
            <div className="panel-body">
              <div className="field">
                <FilterInput
                  value={filter}
                  onChange={setFilter}
                  placeholder={t('editor.filter')}
                  ariaLabel={t('editor.filter')}
                />
              </div>
              {visibleCountries.length === 0 ? (
                <p className="empty-note">{t('editor.noMatches')}</p>
              ) : (
                visibleCountries.map(({ country, idx }) => (
                  <CountryCard
                    key={idx}
                    country={country}
                    index={idx}
                    invalid={invalidCountries.has(idx)}
                    defaultOpen={idx === 0 && !filter}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panel-head">
              <h2>{t('editor.previewTitle')}</h2>
              <span className={`pill ${validation.ok ? 'pill-ok' : 'pill-bad'}`}>
                {validation.ok
                  ? t('json.valid')
                  : t('json.errors', { count: validation.errors.length })}
              </span>
            </div>
            <div className="panel-body">
              <JsonPreview data={data} />
            </div>
          </div>
        </div>
      </div>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(d) => {
          setData(d);
          toast.success(t('toast.imported'));
        }}
      />
    </div>
  );
}
