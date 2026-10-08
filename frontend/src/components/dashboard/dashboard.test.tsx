// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MarketSnapshot, SimulationTurn } from '@stackforge/shared';
import { turnsFixture } from '../../test/dom';
import { CompareBars } from '../charts/CompareBars';
import { EventCards } from './EventCards';

const latest = {
  ...turnsFixture.at(-1)!,
  turnNumber: 7,
  events: [
    {
      type: 'VIRAL_SOCIAL_MEDIA',
      polarity: 'POSITIVE',
      title: 'Viral social media post',
      description: 'A post about the product spreads widely.',
      probability: 0.05,
      duration: 3,
      effects: {},
    },
    {
      type: 'ECONOMIC_RECESSION',
      polarity: 'NEGATIVE',
      title: 'Economic recession',
      probability: 0.03,
      duration: 1,
      effects: {},
    },
  ],
} as unknown as SimulationTurn;
const market = {
  activeEvents: [
    {
      type: 'VIRAL_SOCIAL_MEDIA',
      title: 'Viral social media post',
      polarity: 'POSITIVE',
      turnsLeft: 2,
    },
  ],
} as unknown as MarketSnapshot;

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe('market event cards', () => {
  it('show each event that fired, with polarity in words and turns remaining', () => {
    render(<EventCards simulationId="sim1" latest={latest} market={market} />);
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(cards[0]!.textContent).toContain('Good news: Viral social media post');
    expect(cards[0]!.textContent).toContain('2 more turns');
    expect(cards[1]!.textContent).toContain('Bad news: Economic recession');
    expect(cards[1]!.textContent).toContain('this turn only');
  });

  it('can be dismissed, and stay dismissed for the session', () => {
    render(<EventCards simulationId="sim1" latest={latest} market={market} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Viral social media post' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    cleanup();
    render(<EventCards simulationId="sim1" latest={latest} market={market} />);
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });
});

describe('scenario comparison bars', () => {
  it('draw both branches from zero, with signed values written out', () => {
    render(
      <CompareBars
        labels={['Current plan', 'Aggressive']}
        colors={['var(--series-1)', 'var(--series-2)']}
        pairs={[{ key: 'profit', label: 'Total profit', a: 5000, b: -2500, format: (v) => `${v}` }]}
      />,
    );
    const group = screen.getByRole('group', { name: 'Total profit' });
    expect(group.textContent).toContain('Current plan');
    expect(group.textContent).toContain('-2500');
    const bars = group.querySelectorAll<HTMLElement>('.compare-bar');
    // A loss grows leftwards from the zero line in the middle.
    expect(bars[0]!.className).toContain('from-left');
    expect(bars[0]!.style.left).toBe('50%');
    expect(bars[1]!.className).toContain('from-right');
    expect(bars[1]!.style.left).toBe('25%');
    expect(bars[1]!.style.width).toBe('25%');
  });
});
