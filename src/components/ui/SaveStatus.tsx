import { useTranslation } from 'react-i18next';
import { useSaveStatus, type SaveState } from '@/lib/persistence/useDataSync';

interface SaveStatusProps {
  /**
   * Override the auto-detected state. By default the indicator reads the global
   * persistence status, so any page can drop in `<SaveStatus/>` and it just works.
   */
  state?: SaveState;
  className?: string;
}

/** Maps a {@link SaveState} to its pill variant (colour) and label key. */
const PILL: Record<SaveState, { variant: string; key: string; fallback: string }> = {
  saving: { variant: 'pill-warn', key: 'status.saving', fallback: 'Saving…' },
  unsaved: { variant: 'pill-warn', key: 'status.unsaved', fallback: 'Unsaved' },
  synced: { variant: 'pill-ok', key: 'status.saved', fallback: 'Saved' },
  offline: { variant: 'pill-bad', key: 'status.offline', fallback: 'Offline (cached)' },
};

/**
 * Reusable save/sync indicator. By default it reflects the GLOBAL persistence
 * state (driven by `<DataSync/>`), so the map and any other page can show
 * "Saved" / "Saving…" / "Unsaved" / "Offline" with a single `<SaveStatus/>` and no
 * wiring. Styled with the shared `.pill` classes so it matches everywhere.
 */
export function SaveStatus({ state, className }: SaveStatusProps) {
  const { t } = useTranslation();
  const auto = useSaveStatus();
  const effective = state ?? auto.state;
  const { variant, key, fallback } = PILL[effective];

  return (
    <span
      className={`pill ${variant}${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="dot" aria-hidden="true" />
      {t(key, fallback)}
    </span>
  );
}
