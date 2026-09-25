const longFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey(): string {
  return toMonthKey(new Date());
}

function parse(key: string): { y: number; m: number } {
  const [y, m] = key.split('-').map(Number);
  return { y, m };
}

export function addMonths(key: string, delta: number): string {
  const { y, m } = parse(key);
  return toMonthKey(new Date(y, m - 1 + delta, 1));
}

/** Whole months from `from` to `to` (to − from). */
export function diffMonths(from: string, to: string): number {
  const a = parse(from);
  const b = parse(to);
  return (b.y - a.y) * 12 + (b.m - a.m);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatMonthLong(key: string): string {
  const { y, m } = parse(key);
  return capitalize(longFmt.format(new Date(y, m - 1, 1)));
}

export function formatMonthShort(key: string): string {
  const { y, m } = parse(key);
  return shortFmt.format(new Date(y, m - 1, 1));
}

export function formatDay(iso: string): string {
  return dayFmt.format(new Date(iso));
}

export function monthsLeftLabel(nowKey: string, target: string): string {
  const n = diffMonths(nowKey, target);
  if (n < 0) return `dépassée de ${-n} mois`;
  if (n === 0) return 'ce mois-ci';
  return `dans ${n} mois`;
}

export function isMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
