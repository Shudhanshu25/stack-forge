import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyTheme,
  onSystemThemeChange,
  resolveTheme,
  storePreference,
  storedPreference,
  type Theme,
  type ThemePreference,
} from '../lib/theme';

interface ThemeState {
  theme: Theme;
  preference: ThemePreference;
  /** Switches to the other theme and remembers the choice. */
  toggle: () => void;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(storedPreference);
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = resolveTheme(storedPreference());
    applyTheme(initial);
    return initial;
  });

  // The attribute changes before the re-render, so charts read the new tokens while rendering.
  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  // Following the system: keep up when it changes.
  useEffect(() => {
    if (preference !== 'system') return;
    setTheme(resolveTheme('system'));
    return onSystemThemeChange(setTheme);
  }, [preference, setTheme]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      storePreference(next);
      setPreferenceState(next);
      setTheme(resolveTheme(next));
    },
    [setTheme],
  );

  const value = useMemo<ThemeState>(
    () => ({
      theme,
      preference,
      setPreference,
      toggle: () => setPreference(theme === 'dark' ? 'light' : 'dark'),
    }),
    [theme, preference, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const state = useContext(ThemeContext);
  if (!state) throw new Error('useTheme must be used inside ThemeProvider');
  return state;
}

/** The header control: shows the current theme and switches to the other one. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="icon-button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      <span aria-hidden>{theme === 'dark' ? '☾' : '☀'}</span>
      {theme === 'dark' ? 'Dark' : 'Light'}
    </button>
  );
}
