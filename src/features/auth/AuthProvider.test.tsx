import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The AuthProvider is fully local (no third-party auth SDK). A mutable env mock
 * lets each test pick the mode: local-first (no login wall, synthetic session) vs.
 * a configured-but-not-yet-wired backend (sign-in reports no backend).
 */
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    localOnly: true,
    demoAuth: false,
    socialBackendConfigured: false,
    selfHostUrl: undefined as string | undefined,
    appUrl: 'http://localhost',
    sentryDsn: undefined as string | undefined,
  },
}));

vi.mock('@/lib/env', () => ({ env: mockEnv, envError: null }));

const { AuthProvider, useAuth } = await import('./AuthProvider');

function Probe() {
  const { user, signInWithPassword } = useAuth();
  return (
    <div>
      <span data-testid="uid">{user?.id ?? 'none'}</span>
      <button
        onClick={async () => {
          const r = await signInWithPassword('a@b.co', 'secret');
          document.getElementById('err')!.textContent = r.error ?? 'ok';
        }}
      >
        signin
      </button>
      <div id="err" />
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockEnv.localOnly = true;
  mockEnv.demoAuth = false;
  mockEnv.socialBackendConfigured = false;
});

describe('AuthProvider (local-first)', () => {
  it('local-only mode is signed in with a synthetic local session (no login wall)', async () => {
    mockEnv.localOnly = true;
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('uid').textContent).toBe('local-user'));
  });

  it('with a backend configured but not local, sign-in reports no backend wired yet', async () => {
    mockEnv.localOnly = false;
    mockEnv.demoAuth = false;
    renderProbe();
    // Not local mode → no synthetic session.
    await waitFor(() => expect(screen.getByTestId('uid').textContent).toBe('none'));
    await userEvent.click(screen.getByText('signin'));
    await waitFor(() => expect(document.getElementById('err')!.textContent).toMatch(/No backend/));
  });
});
