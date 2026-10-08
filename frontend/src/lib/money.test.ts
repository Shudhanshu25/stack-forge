import { describe, expect, it } from 'vitest';
import { formatInr, formatInrCompact, paiseToRupees, rupeesToPaise } from './money';

describe('money', () => {
  it('converts between rupees and integer paise', () => {
    expect(rupeesToPaise(499)).toBe(49_900);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(paiseToRupees(100_000_000)).toBe(1_000_000);
  });

  it('formats with Indian digit grouping', () => {
    expect(formatInr(100_000_000)).toBe('₹10,00,000');
    expect(formatInr(49_950)).toBe('₹499.50');
  });

  it('formats compact Indian units', () => {
    expect(formatInrCompact(84_500_000)).toBe('₹8.45L');
    expect(formatInrCompact(1_200_000_000)).toBe('₹1.2Cr');
    expect(formatInrCompact(4_550_000)).toBe('₹45.5K');
    expect(formatInrCompact(-84_500_000)).toBe('-₹8.45L');
    expect(formatInrCompact(49_900)).toBe('₹499');
  });
});
