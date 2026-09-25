const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct0 = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

export function formatEUR(value: number): string {
  return Number.isInteger(Math.round(value * 100) / 100) ? eur0.format(value) : eur2.format(value);
}

export function formatEURRounded(value: number): string {
  return eur0.format(Math.round(value));
}

export function formatSignedEUR(value: number): string {
  const s = formatEURRounded(Math.abs(value));
  if (Math.round(value) === 0) return s;
  return value > 0 ? `+${s}` : `−${s}`;
}

export function formatPercent(ratio: number): string {
  return pct0.format(ratio);
}

export function formatCompactEUR(value: number): string {
  return `${compact.format(value)} €`;
}

/** Parses "1 234,56", "1234.5", "1 234 €"; returns null when not a number. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s  €]/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatAmountInput(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',');
}
