import {
  BarChart3,
  Bell,
  Building2,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Package,
  Settings,
  Sparkles,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * The product's navigation. Each destination maps onto an existing view: the simulator has one
 * set of engine numbers, so Marketing, Team and Product open the analytics or decision view
 * that owns those figures rather than a separate data source.
 */
export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Path for a simulation (`base` is /simulations/:id); null when it needs no simulation. */
  simPath: ((base: string) => string) | null;
  /** Where the item goes when no simulation is open. */
  fallback: string;
  /** Pathname patterns that mark the item as current. */
  match: RegExp;
}

export const MAIN_NAV: NavItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    simPath: (b) => b,
    fallback: '/startups',
    match: /^\/simulations\/[^/]+\/?$/,
  },
  {
    key: 'startup',
    label: 'My Startup',
    icon: Building2,
    simPath: null,
    fallback: '/startups',
    match: /^\/startups(\/.*)?$/,
  },
  {
    key: 'strategy',
    label: 'Business Strategy',
    icon: Target,
    simPath: (b) => `${b}/scenarios`,
    fallback: '/startups',
    match: /\/scenarios$/,
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: Wallet,
    simPath: (b) => `${b}/analytics/financial`,
    fallback: '/startups',
    match: /\/analytics(\/financial)?$/,
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    simPath: (b) => `${b}/analytics/customers`,
    fallback: '/startups',
    match: /\/analytics\/customers$/,
  },
  {
    key: 'team',
    label: 'Team & Hiring',
    icon: Users,
    simPath: (b) => `${b}/decisions#hiring`,
    fallback: '/startups',
    match: /\/decisions$/,
  },
  {
    key: 'product',
    label: 'Product & Pricing',
    icon: Package,
    simPath: (b) => `${b}/decisions#pricing`,
    fallback: '/startups',
    match: /^$/,
  },
  {
    key: 'market',
    label: 'Market Insights',
    icon: Globe,
    simPath: (b) => `${b}/analytics/market`,
    fallback: '/startups',
    match: /\/analytics\/(market|location)$/,
  },
  {
    key: 'advisor',
    label: 'AI Business Advisor',
    icon: Sparkles,
    simPath: (b) => `${b}/advisor`,
    fallback: '/startups',
    match: /\/advisor$/,
  },
  {
    key: 'reports',
    label: 'Reports & Analytics',
    icon: BarChart3,
    simPath: (b) => `${b}/analytics/forecasts`,
    fallback: '/startups',
    match: /\/analytics\/(forecasts|decisions)$/,
  },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    key: 'notifications',
    label: 'Notifications',
    icon: Bell,
    simPath: (b) => `${b}/timeline`,
    fallback: '/startups',
    match: /\/timeline$/,
  },
  {
    key: 'help',
    label: 'Help & Support',
    icon: LifeBuoy,
    simPath: null,
    fallback: '/privacy',
    match: /^\/privacy$/,
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: Settings,
    simPath: null,
    fallback: '/account',
    match: /^\/(account|admin)$/,
  },
];

/** The four destinations on the phone's bottom bar; everything else is in the drawer. */
export const BOTTOM_NAV_KEYS = ['overview', 'finance', 'advisor', 'reports'] as const;

const LAST_SIMULATION_KEY = 'sf-last-simulation';

export function rememberSimulation(id: string): void {
  try {
    localStorage.setItem(LAST_SIMULATION_KEY, id);
  } catch {
    // Storage unavailable: navigation falls back to the startup list.
  }
}

export function lastSimulation(): string | null {
  try {
    return localStorage.getItem(LAST_SIMULATION_KEY);
  } catch {
    return null;
  }
}

/** The simulation id in the current path, if any. */
export function simulationIdFrom(pathname: string): string | null {
  return /^\/simulations\/([^/]+)/.exec(pathname)?.[1] ?? null;
}

export function hrefFor(item: NavItem, simulationId: string | null): string {
  if (item.simPath && simulationId) return item.simPath(`/simulations/${simulationId}`);
  return item.fallback;
}

export function isCurrent(item: NavItem, pathname: string, hash = ''): boolean {
  if (item.key === 'team') return item.match.test(pathname) && hash === '#hiring';
  if (item.key === 'product') return /\/decisions$/.test(pathname) && hash === '#pricing';
  return item.match.test(pathname);
}

/** The breadcrumb label for a path. */
export function pageTitle(pathname: string, hash = ''): string {
  if (pathname === '/startups/new') return 'New startup';
  if (/^\/startups\/[^/]+\/edit$/.test(pathname)) return 'Edit startup';
  if (pathname === '/admin') return 'Admin';
  if (/\/decisions$/.test(pathname) && hash !== '#hiring' && hash !== '#pricing')
    return 'Decisions';
  if (/\/analytics\/location$/.test(pathname)) return 'Location';
  const item = [...MAIN_NAV, ...SECONDARY_NAV].find((i) => isCurrent(i, pathname, hash));
  return item?.label ?? 'Stack Forge';
}
