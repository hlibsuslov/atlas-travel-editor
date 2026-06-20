import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, LogOut, Map as MapIcon, PencilLine, Users } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { BrandMark } from '@/components/brand/BrandMark';
import { LanguageSwitcher } from '@/features/settings/LanguageSwitcher';

const NAV = [
  { to: '/map', icon: MapIcon, key: 'nav.map' },
  { to: '/', icon: PencilLine, key: 'nav.editor' },
  { to: '/stats', icon: Compass, key: 'nav.stats' },
  { to: '/friends', icon: Users, key: 'nav.friends' },
] as const;

export function AppShell() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();

  const avatar = (user?.email ?? 'me').slice(0, 2).toUpperCase();

  return (
    <>
      <a className="skip-link" href="#main">
        {t('a11y.skipToContent')}
      </a>
      <header className="topbar">
        <div className="brand">
          <BrandMark size={40} className="brand-mark" />
          <div className="brand-text">
            <span className="brand-name">{t('app.name')}</span>
            <span className="brand-sub">{t('app.tagline')}</span>
          </div>
        </div>

        <nav className="nav" aria-label="Primary">
          {NAV.map((n) => {
            const I = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <I size={16} aria-hidden="true" />
                <span className="nav-text">{t(n.key)}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="topbar-right">
          <LanguageSwitcher />
          <button className="btn btn-sm btn-ghost" onClick={() => void signOut()}>
            <LogOut size={14} />
            <span className="nav-text">{t('nav.signOut')}</span>
          </button>
          <div className="avatar">{avatar}</div>
        </div>
      </header>

      <main id="main">
        <Outlet />
      </main>
    </>
  );
}
