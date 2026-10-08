/**
 * Theme choice: dark or light. With no stored choice the operating system setting decides; a
 * choice made with the header toggle is remembered per browser. public/theme.js applies the
 * same rule before the first paint; this module keeps it current afterwards.
 */
export type Theme = 'dark' | 'light';
export type ThemePreference = Theme | 'system';

export const THEME_STORAGE_KEY = 'sf-theme';
const LIGHT_QUERY = '(prefers-color-scheme: light)';

export function storedPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function storePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage unavailable: the choice lasts for this page only.
  }
}

export function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark';
}

export const resolveTheme = (preference: ThemePreference): Theme =>
  preference === 'system' ? systemTheme() : preference;

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

/** Calls back when the operating system switches between light and dark. */
export function onSystemThemeChange(callback: (theme: Theme) => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const query = matchMedia(LIGHT_QUERY);
  const listener = (e: MediaQueryListEvent) => callback(e.matches ? 'light' : 'dark');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
