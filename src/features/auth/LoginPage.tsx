import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Compass, Globe, Share2, UserPlus } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { LanguageSwitcher } from '@/features/settings/LanguageSwitcher';
import { makeDefaultData } from '@/domain/normalize';
import { MiniMap } from '@/features/map/WorldMap';

const ART_DOC = makeDefaultData();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

export function LoginPage() {
  const { t } = useTranslation();
  const { signInWithPassword, signUpWithPassword, signInWithOtp, signInWithGoogle, demo } =
    useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicEmail, setMagicEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (msg: string) => {
    setError(true);
    setMessage(msg);
  };

  const onCredentialSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError(false);

    // Demo mode accepts the configured demo credentials as-is; real auth needs a
    // valid email and a password long enough for Supabase to accept.
    if (!demo) {
      if (!EMAIL_RE.test(email.trim())) return fail(t('auth.emailInvalid'));
      if (password.length < MIN_PASSWORD) return fail(t('auth.passwordTooShort'));
    }

    setBusy(true);
    if (mode === 'signup' && !demo) {
      const res = await signUpWithPassword(email.trim(), password);
      setBusy(false);
      if (res.error) return fail(res.error);
      if (res.needsConfirmation) {
        setError(false);
        setMessage(t('auth.confirmEmail', { email: email.trim() }));
      }
      // Otherwise the new session arrives via onAuthStateChange → editor.
    } else {
      const res = await signInWithPassword(email.trim(), password);
      setBusy(false);
      if (res.error) fail(res.error);
    }
  };

  const onMagic = async () => {
    if (!magicEmail.trim()) return;
    const res = await signInWithOtp(magicEmail.trim());
    setError(!!res.error);
    setMessage(res.error ?? t('auth.linkSent', { email: magicEmail.trim() }));
  };

  const onGoogle = async () => {
    const res = await signInWithGoogle();
    if (res.error) fail(res.error);
  };

  const toggleMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setMessage('');
    setError(false);
  };

  const isSignup = mode === 'signup' && !demo;
  const submitLabel = busy ? t('actions.saving') : isSignup ? t('auth.signUp') : t('auth.signIn');

  return (
    <div className="login-screen">
      <div className="login-art">
        <div className="login-art-map">
          <MiniMap data={ART_DOC} none="#34322b" />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(28,26,22,.35), rgba(28,26,22,.78))',
          }}
        />
        <div className="brand" style={{ position: 'relative', zIndex: 2, color: '#f3efe6' }}>
          <div className="brand-mark" style={{ borderColor: '#f3efe6', color: '#f3efe6' }}>
            <Compass size={21} />
          </div>
          <div className="brand-text">
            <span className="brand-name">{t('app.name')}</span>
            <span className="brand-sub" style={{ color: 'rgba(243,239,230,.6)' }}>
              {t('app.tagline')}
            </span>
          </div>
        </div>
        <div className="login-art-title">{t('auth.artTitle')}</div>
        <div className="login-art-foot">
          <span>48.45°N 35.04°E</span>
          <span>EQUAL EARTH</span>
          <span>EST. 2026</span>
        </div>
      </div>

      <div className="login-form-side">
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <LanguageSwitcher />
        </div>
        <div className="login-card">
          <h1>{isSignup ? t('auth.signUp') : t('auth.signIn')}</h1>
          <p className="lede">{t('auth.subtitle')}</p>

          <form onSubmit={onCredentialSubmit}>
            <div className="field">
              <div className="field-label">
                <span>{demo ? t('auth.login') : t('auth.emailLabel')}</span>
              </div>
              <input
                className="input"
                type={demo ? 'text' : 'email'}
                inputMode={demo ? 'text' : 'email'}
                autoComplete={demo ? 'username' : 'email'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={demo ? '1' : 'you@email.com'}
              />
            </div>
            <div className="field">
              <div className="field-label">
                <span>{t('auth.password')}</span>
              </div>
              <input
                className="input"
                type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
              />
              {isSignup && <div className="helper">{t('auth.passwordHint')}</div>}
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {isSignup ? <UserPlus size={15} /> : <ArrowRight size={15} />} {submitLabel}
            </button>
          </form>

          {!demo && (
            <p className="auth-toggle empty-note">
              {mode === 'signin' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
              <button type="button" className="auth-toggle-btn" onClick={toggleMode}>
                {mode === 'signin' ? t('auth.toSignUp') : t('auth.toSignIn')}
              </button>
            </p>
          )}

          <div className="divider">{t('auth.orMagic')}</div>

          <div className="field" style={{ marginBottom: 10 }}>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={magicEmail}
              onChange={(e) => setMagicEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </div>
          <button className="btn btn-block" onClick={onMagic} style={{ marginBottom: 10 }}>
            <Share2 size={15} /> {t('auth.sendLink')}
          </button>
          <button className="btn btn-block" onClick={onGoogle}>
            <Globe size={15} /> {t('auth.google')}
          </button>

          {message && (
            <p
              className={`empty-note${error ? ' field-error' : ''}`}
              style={{ marginTop: 14 }}
              role="status"
            >
              {message}
            </p>
          )}
          {demo && (
            <p className="empty-note" style={{ marginTop: 18, textAlign: 'center' }}>
              {t('auth.demoHint', { login: '1', password: '1' })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
