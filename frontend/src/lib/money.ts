/** Money crosses the wire as integer paise; the UI works in rupees. */

export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);

export const paiseToRupees = (paise: number): number => paise / 100;

/** Indian digit grouping: 100000000 paise -> "₹10,00,000". */
export function formatInr(paise: number): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
  }).format(rupees);
}

/** Rounded to whole rupees, for state figures where paise are noise. */
export const formatInrWhole = (paise: number): string => formatInr(Math.round(paise / 100) * 100);

/** Compact Indian units: ₹8.45L, ₹1.2Cr, ₹45.5K. */
export function formatInrCompact(paise: number): string {
  const rupees = paiseToRupees(paise);
  const sign = rupees < 0 ? '-' : '';
  const abs = Math.abs(rupees);
  const units: [number, string][] = [
    [1e7, 'Cr'],
    [1e5, 'L'],
    [1e3, 'K'],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${sign}₹${trim(abs / size)}${suffix}`;
  }
  return `${sign}₹${trim(abs)}`;
}

function trim(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

/** Groups a plain count Indian-style: 1000000 -> "10,00,000". */
export const formatCount = (n: number): string => new Intl.NumberFormat('en-IN').format(n);
