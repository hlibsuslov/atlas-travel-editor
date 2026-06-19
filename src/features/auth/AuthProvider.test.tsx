import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The AuthProvider has two modes, chosen by whether an Atlas Server is connected.
 * Mutable env + atlas-client mocks let each test pick the mode: local-first (no
 * server → synthetic session, no login wall) vs. server-connected (real accounts).
 */
const { mockEnv, atlas } = vi.hoisted(() => ({
  mockEnv: {
    localOnly: true,
    demoAuth: false,
    socialBackendConfigured: false,
    selfHostUrl: undefined as string | undefined,
    appUrl: 'http://localhost',
    sentryDsn: undefined as string | undefined,
  },
  atlas: {
    url: null as string | null,
    token: null as string | null,
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('@/lib/env', () => ({ env: mockEnv, envError: null }));
vi.mock('@/lib/atlas/client', () => ({
  getAtlasUrl: () => atlas.url,
  getToken: () => atlas.token,
  atlasLogin: atlas.login,
  atlasRegister: atlas.register,
  atlasMe: atlas.me,
  atlasLogout: atlas.logout,
}));

const { AuthProvider, useAuth } = await import('./AuthProvider');

function Probe() {
  const { user, signInWithPassword } = useAuth();
  return (
    <div>
      <span data-testid="uid">{user?.id ?? 'none'}</span>
      <button
        onClick={async () => {
          const r = await signInWithPassword('a@b.co', 'supersecret');
          document.getElementById('err')!.textContent = r.error ?? 'ok';
        }}
      >
        signin
      </button>
      <div id="err" />
    </div>
  );
}

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockEnv.localOnly = true;
  mockEnv.demoAuth = false;
  atlas.url = null;
  atlas.token = null;
});

describe('AuthProvider — local-first (no server connected)', () => {
  it('is signed in with a synthetic local session (no login wall)', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('uid').textContent).toBe('local-user'));
  });

  it('sign-in reports no backend when not local and no server is connected', async () => {
    mockEnv.localOnly = false;
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('uid').textContent).toBe('none'));
    await userEvent.click(screen.getByText('signin'));
    await waitFor(() => expect(document.getElementById('err')!.textContent).toMatch(/No backend/));
  });
});

describe('AuthProvider — server connected', () => {
  it('hydrates the session from the server token on mount', async () => {
    atlas.url = 'http://atlas.test';
    atlas.token = 'tok';
    atlas.me.mockResolvedValue({ user: { id: 'u1', email: 'a@b.co' }, profile: null });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('uid').textContent).toBe('u1'));
  });

  it('shows no session when connected but unauthenticated, and signs in via the server', async () => {
    atlas.url = 'http://atlas.test';
    atlas.token = null;
    atlas.login.mockResolvedValue({ id: 'u2', email: 'a@b.co', username: 'a' });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('uid').textContent).toBe('none'));
    await userEvent.click(screen.getByText('signin'));
    await waitFor(() => expect(screen.getByTestId('uid').textContent).toBe('u2'));
    expect(atlas.login).toHaveBeenCalledWith('a@b.co', 'supersecret');
  });
});
