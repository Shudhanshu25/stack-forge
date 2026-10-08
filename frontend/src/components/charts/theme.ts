import { useMemo } from 'react';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Chart colours come from the theme tokens in styles.css. HTML parts (legend, tooltip) use the
 * CSS variables directly; SVG presentation attributes do not accept var(), so charts resolve
 * the tokens to their computed values for the current theme (and again when it changes).
 */
export const SERIES = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
] as const;

export interface SeriesSpec {
  key: string;
  label: string;
  /** A colour token reference such as SERIES[0] ("var(--series-1)"). */
  color: string;
  /** Dashed only where it means "projection" (forecasts). */
  dashed?: boolean;
}

export interface ChartPalette {
  surface: string;
  grid: string;
  axis: string;
  label: string;
  labelStrong: string;
  hover: string;
  /** Resolves "var(--token)" to the token's current value; other strings pass through. */
  resolve: (color: string) => string;
}

function read(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const tokenName = (color: string) => /^var\((--[\w-]+)\)$/.exec(color)?.[1];

export function chartPalette(): ChartPalette {
  const cache = new Map<string, string>();
  const resolve = (color: string) => {
    const name = tokenName(color);
    if (!name) return color;
    if (!cache.has(name)) cache.set(name, read(name) || color);
    return cache.get(name)!;
  };
  return {
    surface: resolve('var(--surface)'),
    grid: resolve('var(--grid)'),
    axis: resolve('var(--axis)'),
    label: resolve('var(--muted)'),
    labelStrong: resolve('var(--text-2)'),
    hover: resolve('var(--chart-hover)'),
    resolve,
  };
}

/** The chart palette for the current theme. */
export function useChartPalette(): ChartPalette {
  const { theme } = useTheme();
  return useMemo(chartPalette, [theme]);
}
