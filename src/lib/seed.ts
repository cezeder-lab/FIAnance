import seed from '../seed/seed.json';
import type { AssetLine, Goal, GoalsFile, MonthItem, MonthsFile, PatrimoineFile } from '../types';
import { sortedMonthKeys } from './calc';

export function uid(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function seedMonths(monthKey: string): MonthsFile {
  const items: MonthItem[] = seed.monthItems.map((it) => ({
    id: uid(),
    label: it.label,
    amount: it.amount,
    category: it.category as MonthItem['category'],
    recurring: it.recurring,
    goalId: 'goalId' in it ? (it.goalId as string) : null,
  }));
  return { version: 1, months: { [monthKey]: { items } } };
}

export function seedGoals(): GoalsFile {
  return { version: 1, goals: seed.goals.map((g) => ({ ...g }) as Goal) };
}

interface SeedLine {
  label: string;
  amount: number;
  kind?: string;
  valuation?: string;
}

export function seedPatrimoine(): PatrimoineFile {
  const financier = seed.patrimoine.financier.map(
    (l: SeedLine): AssetLine => ({
      id: uid(),
      label: l.label,
      amount: l.amount,
      kind: l.kind as AssetLine['kind'],
      updatedAt: null,
      ...(l.valuation === 'quantite' ? { valuation: 'quantite' as const, quantity: null, unitPrice: null } : {}),
    }),
  );
  return { version: 1, financier, history: [] };
}

/** Copies the recurring items of `items`, in the same order and not yet received / paid / transferred, for a new month. */
export function carryOver(items: MonthItem[]): MonthItem[] {
  return items.filter((it) => it.recurring).map((it) => ({ ...it, id: uid(), cleared: false }));
}

/** Latest month strictly before `monthKey` that has data. */
export function previousMonthWithData(file: MonthsFile, monthKey: string): string | null {
  const earlier = sortedMonthKeys(file).filter((k) => k < monthKey);
  return earlier.length ? earlier[earlier.length - 1] : null;
}

/** Makes sure `monthKey` exists, pre-filled from the closest earlier month. Returns the same object if nothing changed. */
export function ensureMonth(file: MonthsFile, monthKey: string): MonthsFile {
  if (file.months[monthKey]) return file;
  const prev = previousMonthWithData(file, monthKey);
  const items = prev ? carryOver(file.months[prev].items) : [];
  return { ...file, months: { ...file.months, [monthKey]: { items } } };
}
