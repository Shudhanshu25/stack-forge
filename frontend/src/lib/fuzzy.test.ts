import { describe, expect, it } from 'vitest';
import { fuzzyFilter, fuzzyScore } from './fuzzy';

const labels = ['Dashboard', 'Analytics', 'Timeline', 'Toggle theme', 'Log out', 'Account'];

describe('fuzzy search', () => {
  it('matches characters in order, case-insensitively', () => {
    expect(fuzzyScore('tmln', 'Timeline')).not.toBeNull();
    expect(fuzzyScore('TIME', 'Timeline')).not.toBeNull();
    expect(fuzzyScore('lnmt', 'Timeline')).toBeNull();
  });

  it('ranks word starts and runs above scattered matches', () => {
    expect(fuzzyFilter('log', labels, (l) => l)[0]).toBe('Log out');
    expect(fuzzyFilter('th', labels, (l) => l)[0]).toBe('Toggle theme');
    expect(fuzzyFilter('acc', labels, (l) => l)[0]).toBe('Account');
  });

  it('matches keywords, but label matches rank first', () => {
    const items = [
      { label: 'Switch to light theme', keywords: 'appearance mode' },
      { label: 'Light reading', keywords: '' },
    ];
    expect(
      fuzzyFilter(
        'mode',
        items,
        (i) => i.label,
        (i) => i.keywords,
      ),
    ).toEqual([items[0]]);
    expect(
      fuzzyFilter(
        'light',
        items,
        (i) => i.label,
        (i) => i.keywords,
      )[0],
    ).toBe(items[1]);
  });

  it('keeps the original order for an empty query and for ties', () => {
    expect(fuzzyFilter('', labels, (l) => l)).toEqual(labels);
    expect(fuzzyFilter('  ', labels, (l) => l)).toEqual(labels);
  });
});
