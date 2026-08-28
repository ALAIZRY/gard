/**
 * Utility functions for clean number formatting and rounding
 * to eliminate JavaScript floating point arithmetic errors (e.g., 0.30000000000000004 or 12.000000000002)
 */

export const round2 = (num: number): number => {
  if (num === 0 || !num || isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export const fmtQty = (num: number): string => {
  return round2(num).toString();
};

export const fmtDiffQty = (num: number): string => {
  const r = round2(num);
  if (r === 0) return '0';
  return r > 0 ? `+${r}` : `${r}`;
};

export const fmtMoney = (num: number): string => {
  const r = round2(num);
  return r.toFixed(2);
};

export const fmtDiffMoney = (num: number): string => {
  const r = round2(num);
  if (r === 0) return '0';
  return r > 0 ? `+${r.toFixed(2)}` : `${r.toFixed(2)}`;
};
