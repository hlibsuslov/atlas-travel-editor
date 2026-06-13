import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the Supabase client so auth can be tested with no live backend.
const { mockSignUp, mockSignIn, mockGetSession, mockOnAuthStateChange } = vi.hoisted(() => ({
  mockSignUp: vi.fn(),
  mockSignIn: vi.fn(),
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignIn,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}));

const { AuthProvider, useAuth } = await import('./AuthProvider');

function SignUpProbe() {
  const { signUpWithPassword } = useAuth();
  return (
    <button
      onClick={async () => {
        const res = await signUpWithPassword('new@user.io', 'sixchars');
        const node = document.getElementById('result')!;
        node.textContent = `${res.error ?? 'ok'}:${res.needsConfirmation}`;
      }}
    >
      go
    </button>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
});

async function renderAndSignUp() {
  render(
    <AuthProvider>
      <SignUpProbe />
      <div id="result" />
    </AuthProvider>,
  );
  await userEvent.click(screen.getByText('go'));
}

describe('AuthProvider.signUpWithPassword', () => {
  it('flags needsConfirmation when Supabase returns no session (email confirmation on)', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u1' }, session: null }, error: null });
    await renderAndSignUp();
    await waitFor(() => expect(document.getElementById('result')!.textContent).toBe('ok:true'));
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@user.io', password: 'sixchars' }),
    );
  });

  it('does not require confirmation when a session is returned immediately', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 't' } },
      error: null,
    });
    await renderAndSignUp();
    await waitFor(() => expect(document.getElementById('result')!.textContent).toBe('ok:false'));
  });

  it('surfaces the error message on failure', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'taken' },
    });
    await renderAndSignUp();
    await waitFor(() => expect(document.getElementById('result')!.textContent).toBe('taken:false'));
  });
});
