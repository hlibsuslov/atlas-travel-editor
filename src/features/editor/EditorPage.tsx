import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, Check, Globe, Redo2, Share2, Sparkles, Undo2, WifiOff, X } from 'lucide-react';
import { useEditorStore } from '@/features/editor/store';
import { useTravelData } from '@/features/editor/hooks/useTravelData';
import { validateTravelData } from '@/domain/schema';
import { computeStats } from '@/domain/stats';
import { makeEmptyData, makeSampleData } from '@/domain/sampleData';
import { env } from '@/lib/env';
import { SaveStatus } from '@/components/ui/SaveStatus';
import type { SaveState } from '@/lib/persistence/useDataSync';
import { CountryList } from './components/CountryList';
import { CountrySelect } from './components/CountrySelect';
import { EditorEmptyState } from './components/EditorEmptyState';
import { FilterInput } from './components/FilterInput';
import { JsonPreview } from './components/JsonPreview';
import { ImportModal } from './components/ImportModal';
import { ExportMenu } from './components/ExportMenu';
import { StaysEditor } from './components/StaysEditor';
import './editor.css';

/** localStorage flag: the welcome banner has been dismissed/acted on. */
const ONBOARDED_KEY = 'atlas:onboarded';

export function EditorPage() {
  const { t } = useTranslation();
  const data = useEditorStore((s) => s.data);
  const dirty = useEditorStore((s) => s.dirty);
  const setBirthplace = useEditorStore((s) => s.setBirthplace);
  const ensureCountry = useEditorStore((s) => s.ensureCountry);
  const setData = useEditorStore((s) => s.setData);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);

  const { record, save, share, isOffline } = useTravelData();
  const [importOpen, setImportOpen] = useState(false);
  const [filter, setFilter] = useState('');
  // Show the first-run welcome banner until the user dismisses or acts on it.
  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem(ONBOARDED_KEY) === '1',
  );

  const dismissWelcome = () => {
    localStorage.setItem(ONBOARDED_KEY, '1');
    setOnboarded(true);
  };

  const loadSample = () => {
    setData(makeSampleData());
    dismissWelcome();
    toast.success(t('toast.sampleLoaded', 'Sample loaded — explore away.'));
  };

  const startBlank = () => {
    setData(makeEmptyData());
    dismissWelcome();
    toast.success(t('toast.startedBlank', 'Started a blank document.'));
  };

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

  // The first blocking validation issue, surfaced inline next to Save so the
  // user doesn't have to hunt the JSON pane. We keep the human-readable message
  // (after the path prefix) and where to send focus when it's clicked.
  const firstBlocker = useMemo(() => {
    const issue = validation.errors[0];
    if (!issue) return null;
    const sep = issue.indexOf(': ');
    const message = sep === -1 ? issue : issue.slice(sep + 2);
    const country = /^travel\.countries\.(\d+)\b/.exec(issue);
    if (country) return { message, target: `country-card-${Number(country[1])}` };
    if (/^person\.birthplace\b/.test(issue)) return { message, target: 'birthplace-field' };
    return { message, target: null as string | null };
  }, [validation]);

  // Scroll to and focus the element behind the first blocking issue. The country
  // card root carries `id="country-card-<index>"`; we move focus to its header
  // button (the focusable child) so keyboard users land on it too.
  const revealBlocker = () => {
    if (!firstBlocker?.target) return;
    const el = document.getElementById(firstBlocker.target);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const focusable = el.matches('input, [tabindex], button')
      ? el
      : el.querySelector<HTMLElement>('[tabindex], input, button');
    focusable?.focus({ preventScroll: true });
  };

  const visibleCountries = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return data.travel.countries
      .map((country, idx) => ({ country, idx }))
      .filter(({ country }) => !q || country.name.toLowerCase().includes(q));
  }, [data.travel.countries, filter]);

  const shareUrl =
    record?.isPublic && record.shareSlug ? `${env.appUrl}/share/${record.shareSlug}` : null;

  // Autosave is armed GLOBALLY by `<DataSync/>` (mounted in AppShell), so edits
  // persist from every route. The editor only reads `record`/`isOffline` and
  // triggers explicit `save`/`share` below — it must NOT arm a second autosave,
  // or the document would be written twice on every settle.

  const onSave = () =>
    save.mutate(data, {
      onSuccess: () => toast.success(t('toast.saved')),
      onError: (e) =>
        toast.error(t('toast.saveFailed', { message: e instanceof Error ? e.message : '' })),
    });

  // Document-level undo/redo via keyboard, but only when the user isn't editing
  // a text field (so native text undo keeps working inside inputs).
  useEffect(() => {
    const isTextTarget = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      if (isTextTarget(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  // Reuse the shared <SaveStatus/> for a consistent indicator. We pass the state
  // explicitly (rather than letting it auto-detect) so it reflects THIS hook
  // instance's pending save and the local dirty/offline flags exactly.
  const saveState: SaveState = save.isPending
    ? 'saving'
    : isOffline
      ? 'offline'
      : dirty
        ? 'unsaved'
        : 'synced';

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
          <SaveStatus state={saveState} />
          <div className="btn-group">
            <button
              className="btn btn-sm btn-ghost"
              aria-label={t('actions.undo')}
              title={t('actions.undo')}
              disabled={!canUndo}
              onClick={() => undo()}
            >
              <Undo2 size={14} />
            </button>
            <button
              className="btn btn-sm btn-ghost"
              aria-label={t('actions.redo')}
              title={t('actions.redo')}
              disabled={!canRedo}
              onClick={() => redo()}
            >
              <Redo2 size={14} />
            </button>
          </div>
          <button className="btn btn-sm" disabled={share.isPending} onClick={onShare}>
            <Share2 size={14} /> {record?.isPublic ? t('actions.makePrivate') : t('actions.share')}
          </button>
          <button className="btn btn-sm" onClick={() => setImportOpen(true)}>
            {t('actions.import')}
          </button>
          <ExportMenu data={data} />
          {!validation.ok && firstBlocker && (
            <button
              type="button"
              className="pill pill-bad"
              style={{ cursor: 'pointer', maxWidth: 260, border: 'none' }}
              title={t('editor.fixToSave', 'Fix this to save: {{message}}', {
                message: firstBlocker.message,
              })}
              onClick={revealBlocker}
            >
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {firstBlocker.message}
              </span>
            </button>
          )}
          <button
            className="btn btn-sm btn-primary"
            disabled={save.isPending || !validation.ok}
            onClick={onSave}
          >
            <Check size={14} /> {save.isPending ? t('actions.saving') : t('actions.save')}
          </button>
        </div>
      </div>

      {!onboarded && (
        <div className="welcome-banner" role="region" aria-label={t('onboarding.welcomeTitle', 'Welcome to Atlas')}>
          <Sparkles size={18} className="welcome-icon" aria-hidden="true" />
          <div className="welcome-body">
            <strong>{t('onboarding.welcomeTitle', 'Welcome to Atlas')}</strong>
            <p>
              {t(
                'onboarding.welcomeBody',
                'You are looking at an example document — explore it freely, or start fresh.',
              )}
            </p>
            <div className="welcome-actions">
              <button className="btn btn-sm" type="button" onClick={loadSample}>
                {t('onboarding.loadSample', 'Load a richer sample')}
              </button>
              <button className="btn btn-sm btn-ghost" type="button" onClick={startBlank}>
                {t('onboarding.startBlank', 'Start blank')}
              </button>
            </div>
          </div>
          <button
            className="welcome-dismiss"
            type="button"
            aria-label={t('onboarding.dismiss', 'Dismiss')}
            title={t('onboarding.dismiss', 'Dismiss')}
            onClick={dismissWelcome}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {isOffline && (
        <div className="notice-bar notice-bar-warn">
          <WifiOff size={15} />
          <span>{t('editor.offlineNote')}</span>
        </div>
      )}

      {shareUrl && (
        <div className="notice-bar">
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
              <div id="birthplace-field" className="field" style={{ marginBottom: 0 }}>
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
                filter.trim() !== '' ? (
                  <p className="empty-note">{t('editor.noMatches')}</p>
                ) : (
                  <EditorEmptyState
                    onAddCountry={(name) => ensureCountry(name)}
                    onLoadSample={loadSample}
                    onImport={() => setImportOpen(true)}
                  />
                )
              ) : (
                <CountryList
                  countries={visibleCountries}
                  filtering={filter.trim().length > 0}
                  invalidCountries={invalidCountries}
                />
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

          <StaysEditor />
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
