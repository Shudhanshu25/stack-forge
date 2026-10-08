import { describe, expect, it } from 'vitest';
import { changeTone, formatChange, formatMetric, formatPercent } from './format';
import { GLOSSARY } from './glossary';

describe('dashboard formatting', () => {
  it('formats KPI values in Indian units', () => {
    expect(formatMetric('money', 84_500_000)).toBe('₹8.45L');
    expect(formatMetric('count', 1_234_567)).toBe('12,34,567');
    expect(formatMetric('rate', 0.0525)).toBe('5.3%');
    expect(formatMetric('rate', null)).toBe('—');
  });

  it('formats changes since last turn with a sign', () => {
    expect(formatChange('money', -12_30_000)).toBe('-₹12.3K');
    expect(formatChange('count', 25)).toBe('+25');
    expect(formatChange('rate', 0.012)).toBe('+1.20 pts');
    expect(formatChange('money', null)).toBeNull();
  });

  it('judges churn as better when it falls', () => {
    expect(changeTone(0.01, false)).toBe('bad');
    expect(changeTone(-0.01, false)).toBe('good');
    expect(changeTone(500, true)).toBe('good');
    expect(changeTone(0, true)).toBeNull();
  });

  it('keeps tiny market shares visible', () => {
    expect(formatPercent(0.000291)).toBe('0.029%');
    expect(formatPercent(0.25)).toBe('25.0%');
  });

  it('defines every term the specification asks for', () => {
    expect(Object.keys(GLOSSARY).sort()).toEqual(
      [
        'burnRate',
        'cac',
        'churn',
        'grossMargin',
        'location',
        'ltv',
        'marketShare',
        'runway',
      ].sort(),
    );
  });
});
