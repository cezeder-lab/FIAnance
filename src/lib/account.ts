import type { AssetLine, BalanceCheck, MonthItem, MonthsFile, PatrimoineFile } from '../types';
import { round2 } from './calc';
import { previousMonthWithData, uid } from './seed';

export function currentAccountLine(p: PatrimoineFile): AssetLine | undefined {
  return p.financier.find((l) => l.role === 'compte-courant');
}

/** Data written before the current account existed gets its line once, at the top of the list. */
export function ensureCurrentAccount(p: PatrimoineFile): PatrimoineFile {
  if (currentAccountLine(p)) return p;
  const line: AssetLine = { id: uid(), label: 'Compte courant', amount: 0, kind: 'liquide', updatedAt: null, role: 'compte-courant' };
  return { ...p, financier: [line, ...p.financier] };
}

export function withCurrentAccountBalance(p: PatrimoineFile, check: BalanceCheck): PatrimoineFile {
  const withLine = ensureCurrentAccount(p);
  return {
    ...withLine,
    financier: withLine.financier.map((l) => (l.role === 'compte-courant' ? { ...l, amount: check.amount, updatedAt: check.at } : l)),
  };
}

export function withBalanceCheck(file: MonthsFile, monthKey: string, check: BalanceCheck | null): MonthsFile {
  const month = file.months[monthKey] ?? { items: [] };
  return { ...file, months: { ...file.months, [monthKey]: { ...month, balanceCheck: check } } };
}

/** A balance recorded for `monthKey` is the most recent one unless a later month already has its own. */
export function isLatestBalance(file: MonthsFile, monthKey: string): boolean {
  return !Object.entries(file.months).some(([k, m]) => k > monthKey && m.balanceCheck);
}

const isExpense = (it: MonthItem) => it.category === 'depense_fixe' || it.category === 'depense_variable';

export interface AccountSummary {
  opening: number | null;
  /** Set when the opening balance is taken from the previous month's last recorded balance. */
  inheritedFrom: string | null;
  received: number;
  paid: number;
  transferred: number;
  /** opening + received − paid − transferred */
  expected: number | null;
  actual: BalanceCheck | null;
  /** actual − expected: negative means money left the account without being recorded. */
  gap: number | null;
  toReceive: number;
  toPay: number;
  toTransfer: number;
  /** Where the account should land once every line of the month is settled. */
  endOfMonth: number | null;
}

export function accountSummary(file: MonthsFile, monthKey: string): AccountSummary {
  const month = file.months[monthKey];
  const items = month?.items ?? [];
  const prevKey = previousMonthWithData(file, monthKey);
  const prevBalance = prevKey ? (file.months[prevKey].balanceCheck ?? null) : null;
  const explicit = month?.openingBalance ?? null;
  const opening = explicit ?? prevBalance?.amount ?? null;

  const sum = (keep: (it: MonthItem) => boolean) => round2(items.filter(keep).reduce((s, it) => s + it.amount, 0));
  const received = sum((it) => it.category === 'revenu' && Boolean(it.cleared));
  const paid = sum((it) => isExpense(it) && Boolean(it.cleared));
  const transferred = sum((it) => it.category === 'epargne' && Boolean(it.cleared));
  const toReceive = sum((it) => it.category === 'revenu' && !it.cleared);
  const toPay = sum((it) => isExpense(it) && !it.cleared);
  const toTransfer = sum((it) => it.category === 'epargne' && !it.cleared);

  const expected = opening === null ? null : round2(opening + received - paid - transferred);
  const actual = month?.balanceCheck ?? null;
  const base = actual?.amount ?? expected;
  return {
    opening,
    inheritedFrom: explicit === null && prevBalance && prevKey ? prevKey : null,
    received,
    paid,
    transferred,
    expected,
    actual,
    gap: actual && expected !== null ? round2(actual.amount - expected) : null,
    toReceive,
    toPay,
    toTransfer,
    endOfMonth: base === null ? null : round2(base + toReceive - toPay - toTransfer),
  };
}
