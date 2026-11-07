import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Map as MapIcon,
  Menu,
  Moon,
  PanelLeft,
  Settings,
  Shield,
  Sun,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { CommandPaletteButton } from '../../commands/CommandPalette';
import { useTour } from '../../onboarding/Onboarding';
import { useTheme } from '../../theme/ThemeContext';
import { Logo } from './Logo';
import {
  BOTTOM_NAV_KEYS,
  MAIN_NAV,
  SECONDARY_NAV,
  hrefFor,
  isCurrent,
  lastSimulation,
  pageTitle,
  simulationIdFrom,
  type NavItem,
} from './nav';
import { ShellSimulationController, useShell } from './SimulationController';

const SIDEBAR_KEY = 'sf-sidebar-collapsed';

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?'
  );
}

function useNavContext() {
  const { pathname, hash } = useLocation();
  const simulationId = simulationIdFrom(pathname) ?? lastSimulation();
  return { pathname, hash, simulationId };
}

function NavEntry({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { pathname, hash, simulationId } = useNavContext();
  const current = isCurrent(item, pathname, hash);
  const Icon = item.icon;
  return (
    <Link
      to={hrefFor(item, simulationId)}
      className={`nav-item ${current ? 'on' : ''}`}
      aria-current={current ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
    >
      <Icon size={18} aria-hidden strokeWidth={1.75} />
      <span className="nav-label">{item.label}</span>
    </Link>
  );
}

function ThemeButton() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const tour = useTour();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  if (!user) return null;
  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="avatar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden>
          {initials(user.name)}
        </span>
        <ChevronDown size={14} aria-hidden className="hide-sm" />
      </button>
      {open && (
        <div className="menu" role="menu" aria-label="Account">
          <div className="menu-head">
            <div className="menu-name">{user.name}</div>
            <div className="menu-email">{user.email}</div>
          </div>
          <Link role="menuitem" className="menu-item" to="/account">
            <User size={16} aria-hidden /> Profile &amp; settings
          </Link>
          <Link role="menuitem" className="menu-item" to="/startups">
            <Settings size={16} aria-hidden /> My startups
          </Link>
          {user.role === 'ADMIN' && (
            <Link role="menuitem" className="menu-item" to="/admin">
              <Shield size={16} aria-hidden /> Admin
            </Link>
          )}
          {!tour.active && (
            <button role="menuitem" type="button" className="menu-item" onClick={tour.restart}>
              <MapIcon size={16} aria-hidden /> Restart the tour
            </button>
          )}
          <div className="menu-sep" />
          <button role="menuitem" type="button" className="menu-item" onClick={() => void logout()}>
            <LogOut size={16} aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user } = useAuth();
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Sidebar">
      <div className="sidebar-brand">
        <Link to="/startups" className="brand-mark" aria-label="Brevio home">
          <Logo size={18} />
        </Link>
        <div className="nav-label brand-text">
          <span className="brand-title">Brevio</span>
          <span className="brand-tag">Build. Simulate. Scale.</span>
        </div>
        <button
          type="button"
          className="icon-btn sm collapse-btn"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          <PanelLeft size={16} aria-hidden />
        </button>
      </div>
      <div className="nav-label nav-section">Workspace</div>
      <nav aria-label="Main" className="nav-list">
        {MAIN_NAV.map((item) => (
          <NavEntry key={item.key} item={item} collapsed={collapsed} />
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <nav aria-label="Secondary" className="nav-list nav-bottom">
        {SECONDARY_NAV.map((item) => (
          <NavEntry key={item.key} item={item} collapsed={collapsed} />
        ))}
      </nav>
      {user && (
        <Link to="/account" className="sidebar-user" title={collapsed ? user.name : undefined}>
          <span className="avatar" aria-hidden>
            {initials(user.name)}
          </span>
          <span className="nav-label sidebar-user-text">
            <span className="sidebar-user-name">{user.name}</span>
            <span className="sidebar-user-role">{user.role === 'ADMIN' ? 'Admin' : 'Founder'}</span>
          </span>
          <ChevronRight size={16} aria-hidden className="nav-label" />
        </Link>
      )}
    </aside>
  );
}

function Drawer({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Navigation">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden>
            <Logo size={18} />
          </span>
          <div className="brand-text">
            <span className="brand-title">Brevio</span>
            <span className="brand-tag">Build. Simulate. Scale.</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close navigation"
            ref={closeRef}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <nav aria-label="Main" className="nav-list">
          {MAIN_NAV.map((item) => (
            <NavEntry key={item.key} item={item} onNavigate={onClose} />
          ))}
        </nav>
        <nav aria-label="Secondary" className="nav-list nav-bottom">
          {SECONDARY_NAV.map((item) => (
            <NavEntry key={item.key} item={item} onNavigate={onClose} />
          ))}
        </nav>
      </div>
    </>
  );
}

function BottomNav({ onMore }: { onMore: () => void }) {
  const { pathname, hash, simulationId } = useNavContext();
  const items = BOTTOM_NAV_KEYS.map((k) => MAIN_NAV.find((i) => i.key === k)!);
  const short: Record<string, string> = {
    overview: 'Home',
    finance: 'Finance',
    advisor: 'Advisor',
    reports: 'Reports',
  };
  return (
    <nav className="bottom-nav" aria-label="Primary mobile">
      {items.map((item) => {
        const Icon = item.icon;
        const current = isCurrent(item, pathname, hash);
        return (
          <Link
            key={item.key}
            to={hrefFor(item, simulationId)}
            className={current ? 'on' : ''}
            aria-current={current ? 'page' : undefined}
          >
            <Icon size={20} aria-hidden strokeWidth={1.75} />
            <span>{short[item.key]}</span>
          </Link>
        );
      })}
      <button type="button" onClick={onMore}>
        <Menu size={20} aria-hidden strokeWidth={1.75} />
        <span>More</span>
      </button>
    </nav>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { pathname, hash } = useLocation();
  const { chrome } = useShell();
  const simulationId = simulationIdFrom(pathname);
  return (
    <header className="app-top">
      <button
        type="button"
        className="icon-btn show-sm"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu size={20} aria-hidden />
      </button>
      <Link to="/startups" className="brand-mark show-sm" aria-label="Brevio home">
        <Logo size={16} />
      </Link>
      <nav aria-label="Breadcrumb" className="crumbs">
        {chrome ? (
          <NavLink to={`/simulations/${chrome.simulation.id}`} end className="crumb">
            <span className="crumb-badge" aria-hidden>
              {chrome.simulation.startupName.charAt(0).toUpperCase()}
            </span>
            {chrome.simulation.startupName}
          </NavLink>
        ) : (
          <Link to="/startups" className="crumb">
            Brevio
          </Link>
        )}
        <span className="crumb-sep" aria-hidden>
          /
        </span>
        <span aria-current="page" className="crumb-current">
          {pageTitle(pathname, hash)}
        </span>
      </nav>
      <div className="top-spacer" />
      <ShellSimulationController />
      <div className="top-tools">
        <CommandPaletteButton />
        <Link
          to={simulationId ? `/simulations/${simulationId}/timeline` : '/startups'}
          className="icon-btn"
          aria-label="Notifications and events"
          title="Notifications and events"
        >
          <Bell size={18} aria-hidden />
        </Link>
        <ThemeButton />
        <UserMenu />
      </div>
    </header>
  );
}

/** The signed-in application frame: sidebar, top bar, content, and phone navigation. */
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setDrawer(false), [pathname]);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, c ? '0' : '1');
      } catch {
        // The choice lasts for this page only.
      }
      return !c;
    });
  return (
    <div className="app">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="app-main">
        <TopBar onMenu={() => setDrawer(true)} />
        {children}
      </div>
      <BottomNav onMore={() => setDrawer(true)} />
      {drawer && <Drawer onClose={() => setDrawer(false)} />}
    </div>
  );
}

/** Guest pages: a slim header with the brand and the theme switch. */
export function GuestHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="guest-top">
      <Link to="/" className="guest-brand">
        <span className="brand-mark" aria-hidden>
          <Logo size={16} />
        </span>
        <span className="brand-title">Brevio</span>
      </Link>
      <div className="top-spacer" />
      {children}
      <ThemeButton />
    </header>
  );
}
