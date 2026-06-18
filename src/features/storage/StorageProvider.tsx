import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  getActiveStoreId,
  listStores,
  setActiveStore as persistActiveStore,
  type StoreInfo,
} from '@/lib/storage/registry';
import type { StoreId } from '@/lib/storage/types';

/**
 * App-wide storage context. Exposes the registered backends and the active-store
 * choice so the UI (the export menu's destination selector, a future settings
 * surface) can switch providers and react to the change. The registry remains the
 * source of truth; this just makes the persisted choice reactive in React.
 */
interface StorageContextValue {
  /** All registered stores with picker metadata (ready flags, capabilities). */
  stores: StoreInfo[];
  /** The currently active store id. */
  activeId: StoreId;
  /** Switch the active store and persist the choice. */
  setActive: (id: StoreId) => void;
}

const StorageContext = createContext<StorageContextValue | null>(null);

export function StorageProvider({ children }: { children: ReactNode }) {
  const stores = useMemo(() => listStores(), []);
  const [activeId, setActiveId] = useState<StoreId>(() => getActiveStoreId());

  const setActive = useCallback((id: StoreId) => {
    persistActiveStore(id);
    setActiveId(getActiveStoreId());
  }, []);

  const value = useMemo<StorageContextValue>(
    () => ({ stores, activeId, setActive }),
    [stores, activeId, setActive],
  );

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStorage(): StorageContextValue {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be used within a StorageProvider.');
  return ctx;
}
