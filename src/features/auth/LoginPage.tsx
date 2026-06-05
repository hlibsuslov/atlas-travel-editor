import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Compass, Globe, Share2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { LanguageSwitcher } from '@/features/settings/LanguageSwitcher';
import { makeDefaultData } from '@/domain/normalize';
import { MiniMap } from '@/features/map/WorldMap';

const ART_DOC = makeDefaultData();

export function LoginPage() {
  const { t } = useTranslation();
  const { signInWithPassword, signInWithOtp, signInWithGoogle, demo } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const onPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const res = await signInWithPassword(login.trim() || '1', password || '1');
    if (res.error) {
      setError(true);
      setMessage(res.error);
    }
  };

  const onMagic = async () => {
    if (!email.trim()) return;
    const res = await signInWithOtp(email.trim());
    setError(!!res.error);
    setMessage(res.error ?? t('auth.linkSent', { email }));
  };

  const onGoogle = async () => {
    const res = await signInWithGoogle();
    if (res.error) {
      setError(true);
      setMessage(res.error);
    }
  };

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
          <h1>{t('auth.signIn')}</h1>
          <p className="lede">{t('auth.subtitle')}</p>

          <form onSubmit={onPasswordSubmit}>
            <div className="field">
              <div className="field-label">
                <span>{t('auth.login')}</span>
              </div>
              <input
                className="input"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="field">
              <div className="field-label">
                <span>{t('auth.password')}</span>
              </div>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
              />
            </div>
            <button className="btn btn-primary btn-block" type="submit">
              <ArrowRight size={15} /> {t('auth.signIn')}
            </button>
          </form>

          <div className="divider">{t('auth.orMagic')}</div>

          <div className="field" style={{ marginBottom: 10 }}>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              className="empty-note"
              style={{ marginTop: 14, color: error ? '#b4452f' : undefined }}
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
