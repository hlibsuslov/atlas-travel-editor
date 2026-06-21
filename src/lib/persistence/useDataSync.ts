import { useCallback, useMemo } from 'react';
import { useEditorStore } from '@/features/editor/store';
import { useTravelData } from '@/features/editor/hooks/useTravelData';
import { useAutosave } from '@/features/editor/hooks/useAutosave';
import { validateTravelData } from '@/domain/schema';

/**
 * Coarse persistence state any page can render (via {@link SaveStatus}):
 * - `saving`   — a save is in flight.
 * - `unsaved`  — there are local edits not yet persisted.
 * - `synced`   — the working document matches what's stored.
 * - `offline`  — the backend is unreachable; edits stay cached locally only.
 */
export type SaveState = 'saving' | 'unsaved' | 'synced' | 'offline';

export interface DataSyncStatus {
  state: SaveState;
  /** True while the document fails validation (autosave is blocked until fixed). */
  invalid: boolean;
  /**
   * Flush the current document to the active store immediately. No-op when a save
   * is already in flight or the document is invalid. Lets the status indicator
   * double as a "Save now" control, so no separate Save button is needed.
   */
  saveNow: () => void;
}

/**
 * The single source of truth for "is my work saved?", shared by the global
 * autosave mount and any status indicator. Reading it is side-effect free, so
 * pages can call {@link useSaveStatus} freely; the actual autosave is armed ONCE
 * by {@link useDataSync} (rendered in `<DataSync/>`), never per page.
 */
export function useSaveStatus(): DataSyncStatus {
  const dirty = useEditorStore((s) => s.dirty);
  const data = useEditorStore((s) => s.data);
  const { save, isOffline } = useTravelData();

  // Validation gates autosave, so surface it for callers that want to explain why
  // a document is sitting "unsaved" (the editor shows the first blocker inline).
  const invalid = useMemo(() => !validateTravelData(data).ok, [data]);

  const state: SaveState = save.isPending
    ? 'saving'
    : isOffline
      ? 'offline'
      : dirty
        ? 'unsaved'
        : 'synced';

  // Read the latest document straight from the store at click time so a stale
  // closure can never persist an out-of-date snapshot.
  const saveNow = useCallback(() => {
    if (save.isPending) return;
    const current = useEditorStore.getState().data;
    if (!validateTravelData(current).ok) return;
    save.mutate(current);
  }, [save]);

  return { state, invalid, saveNow };
}

/**
 * Global persistence driver. Mounted exactly once (in `AppShell`) so the working
 * document autosaves to the active store on EVERY route — marking a country on
 * `/map` then reloading keeps it, even if the editor was never opened. It also
 * flushes pending edits on pagehide/visibilitychange (handled inside
 * {@link useAutosave}).
 *
 * Pages still call `useTravelData()` to read `record`/`isOffline` and to trigger
 * `save`/`share`, but they must NOT call this — arming autosave twice would double
 * every write.
 */
export function useDataSync(): void {
  const data = useEditorStore((s) => s.data);
  const dirty = useEditorStore((s) => s.dirty);
  const { save, isOffline } = useTravelData();

  // Only autosave a valid document while online; offline edits remain in the
  // local cache and flush once connectivity (and a manual Save) returns.
  const canSave = useMemo(() => validateTravelData(data).ok && !isOffline, [data, isOffline]);

  useAutosave({
    data,
    dirty,
    canSave,
    onSave: (d) => save.mutate(d),
  });
}
