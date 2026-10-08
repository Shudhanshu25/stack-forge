// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Kpi } from '@stackforge/shared';
import { KpiTile } from '../components/dashboard/KpiRow';
import { REDUCED, mockMatchMedia, type MediaControl } from '../test/dom';
import { cubicBezier, durationMs, prefersReducedMotion, useReducedMotion } from './motion';

const tile = (value: number, change: number | null = null) => (
  <KpiTile label="Customers" kind="count" kpi={{ value, change } as Kpi} />
);
// The visible (animated) figure; the screen-reader copy always holds the final one.
const shown = () => document.querySelector('.kpi-value [aria-hidden]')!.textContent;
const announced = () => document.querySelector('.kpi-value .sr-only')!.textContent;

let media: MediaControl;
beforeEach(() => {
  media = mockMatchMedia({ [REDUCED]: false });
});
afterEach(cleanup);

describe('motion tokens', () => {
  it('durations fall back to the token values and are zero under reduced motion', () => {
    expect(durationMs('--dur-slow')).toBe(300);
    expect(durationMs('--dur-fast')).toBe(150);
    media.set(REDUCED, true);
    expect(prefersReducedMotion()).toBe(true);
    expect(durationMs('--dur-slow')).toBe(0);
  });

  it('evaluates the shared easing curve', () => {
    const ease = cubicBezier('cubic-bezier(0.2, 0, 0, 1)');
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeGreaterThan(0.5); // decelerating curve
    expect(cubicBezier('cubic-bezier(0, 0, 1, 1)')(0.3)).toBeCloseTo(0.3, 2);
  });

  it('follows the system setting live', () => {
    function Probe() {
      return <output>{useReducedMotion() ? 'reduced' : 'full'}</output>;
    }
    render(<Probe />);
    expect(screen.getByRole('status').textContent).toBe('full');
    act(() => media.set(REDUCED, true));
    expect(screen.getByRole('status').textContent).toBe('reduced');
  });
});

describe('KPI count-up', () => {
  it('shows the first value immediately', () => {
    render(tile(829));
    expect(shown()).toBe('829');
  });

  it('counts from the old figure to the new one and highlights the change', async () => {
    const { rerender } = render(tile(800));
    rerender(tile(1000, 200));
    // Mid-animation the visible figure is between the two values; the announced one is final.
    expect(announced()).toBe('1,000');
    await waitFor(() => expect(Number(shown()!.replace(/,/g, ''))).toBeGreaterThan(800));
    await waitFor(() => expect(shown()).toBe('1,000'));
    expect(document.querySelector('.delta')!.className).toContain('flash');
    expect(document.querySelector('.delta')!.className).toContain('good');
    expect(document.querySelector('.delta')!.textContent).toContain('▲');
  });

  it('under reduced motion the new value appears at once', () => {
    media.set(REDUCED, true);
    const { rerender } = render(tile(800));
    rerender(tile(1000, 200));
    expect(shown()).toBe('1,000');
  });

  it('a fall is shown with a down arrow and minus sign, not colour alone', () => {
    render(tile(700, -100));
    const delta = document.querySelector('.delta')!;
    expect(delta.textContent).toContain('▼');
    expect(delta.textContent).toContain('-100');
    expect(delta.className).toContain('bad');
  });
});
