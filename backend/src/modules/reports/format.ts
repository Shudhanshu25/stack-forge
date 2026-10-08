/**
 * Report formatting. PDF core fonts have no rupee glyph, so reports write "Rs" with Indian
 * units: Rs 8.45L, Rs 1.2Cr.
 */
export function formatInrCompact(paise: number): string {
  const rupees = paise / 100;
  const sign = rupees < 0 ? '-' : '';
  const abs = Math.abs(rupees);
  const units: [number, string][] = [
    [1e7, 'Cr'],
    [1e5, 'L'],
    [1e3, 'K'],
  ];
  const trim = (v: number) => v.toFixed(2).replace(/\.?0+$/, '');
  for (const [size, suffix] of units) {
    if (abs >= size) return `${sign}Rs ${trim(abs / size)}${suffix}`;
  }
  return `${sign}Rs ${trim(abs)}`;
}

export const formatPercent = (rate: number, digits = 1) => `${(rate * 100).toFixed(digits)}%`;
