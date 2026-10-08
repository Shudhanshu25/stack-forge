// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY } from '../lib/theme';
import { LIGHT, mockMatchMedia, type MediaControl } from '../test/dom';
import { ThemeProvider, ThemeToggle, useTheme } from './ThemeContext';

function Probe() {
  const { theme, preference, setPreference } = useTheme();
  return (
    <>
      <output data-testid="theme">{theme}</output>
      <output data-testid="preference">{preference}</output>
      <button type="button" onClick={() => setPreference('system')}>
        Follow system
      </button>
    </>
  );
}

const mount = () =>
  render(
    <ThemeProvider>
      <ThemeToggle />
      <Probe />
    </ThemeProvider>,
  );
const htmlTheme = () => document.documentElement.getAttribute('data-theme');

let media: MediaControl;
beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  media = mockMatchMedia({ [LIGHT]: false });
});
afterEach(cleanup);

describe('theme', () => {
  it('follows the operating system when nothing is stored', () => {
    media.set(LIGHT, true);
    mount();
    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(screen.getByTestId('preference').textContent).toBe('system');
    expect(htmlTheme()).toBe('light');
  });

  it('keeps following the system while no choice is stored', () => {
    mount();
    expect(htmlTheme()).toBe('dark');
    act(() => media.set(LIGHT, true));
    expect(htmlTheme()).toBe('light');
    expect(screen.getByTestId('theme').textContent).toBe('light');
  });

  it('the toggle overrides the system and is remembered per browser', () => {
    mount();
    act(() => screen.getByRole('button', { name: 'Switch to light theme' }).click());
    expect(htmlTheme()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    // A later visit: the stored choice wins over the system (still dark).
    cleanup();
    document.documentElement.removeAttribute('data-theme');
    mount();
    expect(htmlTheme()).toBe('light');
    expect(screen.getByTestId('preference').textContent).toBe('light');
    // ... and the system switching no longer changes it.
    act(() => media.set(LIGHT, false));
    expect(htmlTheme()).toBe('light');
  });

  it('going back to the system setting forgets the stored choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    mount();
    act(() => screen.getByRole('button', { name: 'Follow system' }).click());
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(htmlTheme()).toBe('dark');
  });

  it('falls back to the system theme when storage is unavailable', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    try {
      media.set(LIGHT, true);
      mount();
      expect(htmlTheme()).toBe('light');
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});

describe('pre-paint theme script (public/theme.js)', () => {
  const script = readFileSync(path.resolve(process.cwd(), 'public/theme.js'), 'utf8');
  const runScript = () => new Function(script)();

  it('applies the stored choice before the app loads', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    runScript();
    expect(htmlTheme()).toBe('light');
  });

  it('falls back to the operating system setting', () => {
    media.set(LIGHT, true);
    runScript();
    expect(htmlTheme()).toBe('light');
    media.set(LIGHT, false);
    localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme');
    runScript();
    expect(htmlTheme()).toBe('dark');
  });

  it('is loaded as a blocking script in the document head', () => {
    const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toMatch(/<script src="\/theme\.js"><\/script>/);
  });
});
