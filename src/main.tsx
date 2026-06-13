import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { App } from './App';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ConfigError } from '@/components/ConfigError';
import { queryClient } from '@/lib/queryClient';
import { envError } from '@/lib/env';
import { initObservability } from '@/lib/observability';
import '@/i18n';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found.');

// If required env vars are missing/invalid the app can't talk to its backend.
// Show a readable configuration screen instead of a blank white page (the most
// common cause is unset VITE_* vars on the host at build time).
if (envError) {
  createRoot(rootEl).render(
    <StrictMode>
      <ConfigError detail={envError} />
    </StrictMode>,
  );
} else {
  initObservability();
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
            <Toaster position="bottom-right" richColors closeButton />
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
