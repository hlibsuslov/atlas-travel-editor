import { useDataSync } from './useDataSync';

/**
 * Headless global persistence mount. Rendered exactly once inside `AppShell`, so
 * the working travel document autosaves to the active store from EVERY route — not
 * only the editor. Renders nothing; all behaviour lives in {@link useDataSync}.
 */
export function DataSync(): null {
  useDataSync();
  return null;
}
