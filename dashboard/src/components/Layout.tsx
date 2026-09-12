import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  MessageSquare,
  FileSpreadsheet,
  LogOut,
  Send,
  Server,
  Menu,
  X,
  Building2,
  CreditCard,
  Database,
  HardDrive,
  User,
  Shield,
  Key,
  Puzzle,
  Layers,
  CalendarClock,
  StickyNote,
} from 'lucide-react';

import { type UserRole, useRole } from '../hooks/useRole';

import { FloatingBubbleContainer } from './bubbles/FloatingBubbleContainer';
import { type BubbleStoreSnapshot, useBubbleStore } from './bubbles/useBubbleStore';
import { useGlobalBubbleListener } from '../hooks/useGlobalBubbleListener';
import { LeadWeaveLogo } from './LeadWeaveLogo';
import { CommandPalette } from './CommandPalette';
import { ErrorBoundary } from './ErrorBoundary';
import { LanMeshProvider } from '../contexts/LanMeshContext';
import { LanMeshFloatingPill } from './lan-mesh/LanMeshFloatingPill';
import { FloatingNotepad } from './notepad/FloatingNotepad';
import { useNotepadStore } from '../stores/useNotepadStore';
import './Layout.css';

const ROUTE_PREFETCHERS: Record<string, () => Promise<unknown>> = {
  '/': () => import('../pages/Dashboard'),
  '/chats': () => import('../pages/Chats'),
  '/webhooks': () => import('../pages/Webhooks'),
  '/campaigns': () => import('../pages/CreateCampaignWizard'),
  '/notice-board': () => import('../pages/NoticeBoard'),
  '/profile': () => import('../pages/Profile'),
  '/team': () => import('../pages/CompanyTeam'),
  '/api-keys': () => import('../pages/ApiKeys'),
  '/logs': () => import('../pages/Logs'),
  '/message-tester': () => import('../pages/MessageTester'),
  '/infrastructure': () => import('../pages/Infrastructure'),
  '/storage': () => import('../pages/Storage'),
  '/plugins': () => import('../pages/Plugins'),
  '/management': () => import('../pages/ManagementDashboard'),
};

const prefetchRoute = (to: string) => {
  const basePath = to.split('?')[0];
  const prefetcher = ROUTE_PREFETCHERS[basePath];
  if (prefetcher) {
    prefetcher().catch(() => {});
  }
};

const selectTotalUnread = (snapshot: BubbleStoreSnapshot) => snapshot.totalUnread;

interface LayoutProps {
  onLogout: () => void;
  userRole: UserRole | null;
}

export function Layout({ onLogout }: LayoutProps) {
  useGlobalBubbleListener();
  const totalUnread = useBubbleStore(selectTotalUnread);
  const isNotepadOpen = useNotepadStore(s => s.notes.some(n => n.isOpen));
  const toggleNotepadOpen = useNotepadStore(s => s.toggleNotepadOpen);
  const { role, isDeveloper, setSimulatedRole } = useRole();
  const { t } = useTranslation();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Multi-Tenant SaaS Role-Based Navigation Routing
  const isSuper = role === 'superadmin' || role === 'developer';
  const isSupport = role === 'support';
  const isCompAdmin = role === 'companyadmin' || role === 'developer';
  const isHr = role === 'hr';
  const isStandardUser = role === 'user';

  const mainNavItems = [
    // === Workspace Tabs (all roles get Dashboard, Chats with embedded Sessions) ===
    ...(isSuper || isSupport || isCompAdmin || isHr || isStandardUser
      ? [
          { to: '/', icon: LayoutDashboard, label: t('nav.dashboard', 'Dashboard') },
          { to: '#notepad', icon: StickyNote, label: 'Notepad', isNotepad: true },
          { to: '/chats?tab=sessions', icon: MessageSquare, label: t('nav.chats', 'Chats') },
          // Campaigns (Broadcast & CRM)
          ...(isSuper || isCompAdmin || isStandardUser
            ? [
                { to: '/campaigns', icon: FileSpreadsheet, label: 'Broadcast & Campaign Studio' },
                { to: '/notice-board', icon: CalendarClock, label: 'Notice Board' },
              ]
            : []),
          { to: '/storage', icon: HardDrive, label: t('nav.storage', 'Storage') },
          ...(isSuper ? [{ to: '/management', icon: Layers, label: 'Management' }] : []),
        ]
      : []),
  ];

  const profileNavItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard', 'Dashboard') },
    { to: '#notepad', icon: StickyNote, label: 'Notepad', isNotepad: true },
    { to: '/profile', icon: User, label: t('nav.profile', 'Profile') },
    // API Keys: superadmin, support (not companyadmin)
    ...(isSuper || isSupport ? [{ to: '/api-keys', icon: Key, label: 'API Keys' }] : []),
    // Message Tester: superadmin, support, companyadmin, user
    ...(isSuper || isSupport || isCompAdmin || isStandardUser
      ? [{ to: '/message-tester', icon: Send, label: t('nav.messageTester', 'Message Tester') }]
      : []),
    // Plugins: all workspace roles
    ...(isSuper || isSupport || isCompAdmin || isHr || isStandardUser
      ? [{ to: '/plugins', icon: Puzzle, label: 'Plugins' }]
      : []),
    ...(isSuper || isSupport ? [{ to: '/infrastructure', icon: Server, label: 'Infrastructure' }] : []),
  ];

  const managementNavItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard', 'Dashboard') },
    { to: '#notepad', icon: StickyNote, label: 'Notepad', isNotepad: true },
    { to: '/management', icon: Layers, label: 'Management' },
    ...(isSuper || isSupport ? [{ to: '/companies', icon: Building2, label: 'Companies & Tenants' }] : []),
    ...(isSuper
      ? [
          { to: '/subscriptions', icon: CreditCard, label: 'Subscriptions' },
          { to: '/database-usage', icon: Database, label: 'Database & Usage' },
        ]
      : []),
  ];

  const isProfileContext = ['/profile', '/api-keys', '/message-tester', '/infrastructure', '/plugins', '/logs'].some(
    p => location.pathname === p || location.pathname.startsWith(`${p}/`),
  );

  const isManagementContext =
    (isSuper || isSupport) &&
    ['/management', '/companies', '/subscriptions', '/database-usage'].some(
      p => location.pathname === p || location.pathname.startsWith(`${p}/`),
    );

  const navItems = isManagementContext ? managementNavItems : isProfileContext ? profileNavItems : mainNavItems;

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    let timeoutId: number | null = null;
    const handleResize = () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        if (!mobile) setIsMobileOpen(false);
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleNavClick = () => {
    if (isMobile) setIsMobileOpen(false);
  };

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);

  return (
    <LanMeshProvider>
      <div className="layout">
        {isMobile && (
          <header className="mobile-header">
            <button className="mobile-menu-btn" onClick={toggleMobile} aria-label={t('common.expand')}>
              {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="mobile-brand">
              <LeadWeaveLogo size={24} withText />
            </div>
            <div style={{ width: 40 }} />
          </header>
        )}

        {isMobile && isMobileOpen && <div className="sidebar-overlay" onClick={() => setIsMobileOpen(false)} />}

        <aside
          className={`sidebar ${isMobile ? 'mobile' : ''} ${isMobileOpen ? 'open' : ''} ${isManagementContext ? 'superadmin-theme' : ''}`}
        >
          <div
            className="sidebar-brand"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <NavLink
              to="/"
              className="sidebar-brand-link"
              title="LeadWeave"
              aria-label="LeadWeave"
              onClick={handleNavClick}
            >
              <LeadWeaveLogo size={28} />
            </NavLink>
          </div>

          <nav className="sidebar-nav">
            {navItems.map(item => {
              const { to, icon: Icon, label } = item;
              const isNotepad = 'isNotepad' in item && item.isNotepad;
              const hasUnread = to === '/chats' && totalUnread > 0;
              const unreadText = totalUnread > 99 ? '99+' : totalUnread;
              const ariaLabel = hasUnread ? `${label} ${unreadText}` : label;

              if (isNotepad) {
                return (
                  <button
                    key="sidebar-notepad-btn"
                    aria-label={label}
                    title="Toggle Notepad & Sticky Notes"
                    className={`nav-item ${isNotepadOpen ? 'active' : ''}`}
                    onClick={() => {
                      handleNavClick();
                      toggleNotepadOpen();
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      width: '100%',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Icon size={20} />
                    <span className="nav-label">{label}</span>
                  </button>
                );
              }

              return (
                <NavLink
                  key={to}
                  to={to}
                  aria-label={ariaLabel}
                  title={label}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'active' : ''} ${to === '/management' ? 'management-item' : ''}`
                  }
                  end={to === '/'}
                  onClick={handleNavClick}
                  onMouseEnter={() => prefetchRoute(to)}
                  onTouchStart={() => prefetchRoute(to)}
                >
                  <Icon size={20} />
                  {hasUnread && (
                    <span className="sidebar-nav-badge" aria-hidden="true">
                      {unreadText}
                    </span>
                  )}
                  <span className="nav-label">{label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <NavLink
              to="/profile"
              aria-label={t('nav.profile', 'Profile')}
              title={t('nav.profile', 'Profile')}
              className={({ isActive }) => `nav-item profile-nav-item ${isActive ? 'active' : ''}`}
              onClick={handleNavClick}
              onMouseEnter={() => prefetchRoute('/profile')}
              onTouchStart={() => prefetchRoute('/profile')}
            >
              <User size={20} />
              <span className="nav-label">{t('nav.profile', 'Profile')}</span>
            </NavLink>

            <button
              className="logout-btn"
              onClick={onLogout}
              aria-label={t('common.logout', 'Logout')}
              title={t('common.logout', 'Logout')}
            >
              <LogOut size={20} />
              <span className="nav-label">{t('common.logout')}</span>
            </button>
          </div>
        </aside>

        <main className={`main-content ${isMobile ? 'mobile' : ''}`}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        <FloatingBubbleContainer />
        <FloatingNotepad />

        <CommandPalette open={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />

        {/* Floating Developer Role Sandbox Switcher (Only visible & accessible to real developers) */}
        {isDeveloper && (
          <div
            style={{
              position: 'fixed',
              bottom: '16px',
              left: '16px',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(15, 23, 42, 0.95)',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: '30px',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Shield size={14} color="#38bdf8" />
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Dev Sandbox:</span>
            <select
              aria-label="Simulate User Role"
              value={role || 'developer'}
              onChange={e => setSimulatedRole(e.target.value === 'developer' ? null : (e.target.value as UserRole))}
              style={{
                background: '#1e293b',
                color: '#38bdf8',
                border: '1px solid #475569',
                borderRadius: '12px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="developer">🛠️ Developer (All Access)</option>
              <option value="superadmin">👑 Platform: Super Admin</option>
              <option value="support">🎧 Platform: Support</option>
              <option value="companyadmin">🏢 Client: Company Admin</option>
              <option value="hr">👥 Client: HR</option>
              <option value="user">👤 Client: User (Agent)</option>
            </select>
          </div>
        )}

        {/* Floating Workspace Name Pill */}
        {sessionStorage.getItem('leadweave_company_name') && (
          <div
            style={{
              position: 'fixed',
              top: isMobile ? '56px' : '0',
              left: isMobile ? '16px' : '72px',
              zIndex: 89,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(20, 25, 35, 0.55)',
              color: '#e2e8f0',
              padding: '3px 12px 5px 12px',
              borderRadius: isMobile ? '0 0 10px 10px' : '0 0 10px 0',
              fontSize: '10px',
              fontWeight: 600,
              boxShadow:
                '0 4px 16px rgba(0, 0, 0, 0.2), inset -1px -1px 1px rgba(0, 0, 0, 0.2), inset 1px 0px 1px rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderTop: 'none',
              borderLeft: isMobile ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              backdropFilter: 'blur(16px) saturate(180%)',
              WebkitBackdropFilter: 'blur(16px) saturate(180%)',
              letterSpacing: '0.02em',
            }}
            title="Current Workspace"
          >
            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sessionStorage.getItem('leadweave_company_name')}
            </span>
          </div>
        )}

        <LanMeshFloatingPill />
      </div>
    </LanMeshProvider>
  );
}
