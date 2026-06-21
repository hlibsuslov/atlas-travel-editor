import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth/AuthProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { AppShell } from '@/components/AppShell';
import { EditorPage } from '@/features/editor/EditorPage';
import { StorageProvider } from '@/features/storage/StorageProvider';

// Code-split the heavier routes (world atlas, charts) so the editor's initial
// bundle stays small.
const MapPage = lazy(() => import('@/features/map/MapPage').then((m) => ({ default: m.MapPage })));
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const FriendsPage = lazy(() =>
  import('@/features/friends/FriendsPage').then((m) => ({ default: m.FriendsPage })),
);
const SharePage = lazy(() =>
  import('@/features/sharing/SharePage').then((m) => ({ default: m.SharePage })),
);

function PageFallback() {
  return (
    <div className="full-center">
      <p className="empty-note">Loading…</p>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, localOnly } = useAuth();
  if (loading) return <PageFallback />;
  // No-backend local-first mode is always "signed in" as the synthetic local
  // user — skip the login wall entirely.
  if (localOnly) return <>{children}</>;
  return session ? <>{children}</> : <LoginPage />;
}

/**
 * Keeps `<html lang>` in sync with the active i18n language for EVERY route
 * (including the public share pages, which render outside `AppShell`). This drives
 * the `:lang(ru)/:lang(uk)` Cyrillic typography overrides in index.css and is the
 * correct accessibility signal for screen readers / hyphenation. `resolvedLanguage`
 * is the actually-applied locale (e.g. `ru` for a detected `ru-RU`).
 */
function useHtmlLangSync() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const apply = (lng: string) => {
      document.documentElement.lang = (lng || i18n.language || 'en').split('-')[0]!;
    };
    apply(i18n.resolvedLanguage ?? i18n.language);
    i18n.on('languageChanged', apply);
    return () => i18n.off('languageChanged', apply);
  }, [i18n]);
}

export function App() {
  useHtmlLangSync();
  return (
    <StorageProvider>
      <BrowserRouter>
        <div className="atlas-app">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/share/:slug" element={<SharePage />} />
              <Route path="/u/:handle" element={<SharePage />} />

              <Route
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route path="/" element={<EditorPage />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/stats" element={<DashboardPage />} />
                <Route path="/friends" element={<FriendsPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </BrowserRouter>
    </StorageProvider>
  );
}
