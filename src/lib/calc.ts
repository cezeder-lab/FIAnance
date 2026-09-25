import type { AssetLine, Goal, MonthItem, MonthsFile, PatrimoineFile } from '../types';
import { diffMonths } from './months';

export interface MonthTotals {
  revenusCash: number;
  revenusInKind: number;
  depensesFixes: number;
  depensesVariables: number;
  epargne: number;
  /** revenus (cash) − dépenses − épargne allouée */
  cashflow: number;
  /** épargne / revenus cash */
  savingsRate: number | null;
}

export function monthTotals(items: MonthItem[]): MonthTotals {
  let revenusCash = 0;
  let revenusInKind = 0;
  let depensesFixes = 0;
  let depensesVariables = 0;
  let epargne = 0;
  for (const it of items) {
    const a = Number.isFinite(it.amount) ? it.amount : 0;
    switch (it.category) {
      case 'revenu':
        if (it.inKind) revenusInKind += a;
        else revenusCash += a;
        break;
      case 'depense_fixe':
        depensesFixes += a;
        break;
      case 'depense_variable':
        depensesVariables += a;
        break;
      case 'epargne':
        epargne += a;
        break;
    }
  }
  return {
    revenusCash,
    revenusInKind,
    depensesFixes,
    depensesVariables,
    epargne,
    cashflow: revenusCash - depensesFixes - depensesVariables - epargne,
    savingsRate: revenusCash > 0 ? epargne / revenusCash : null,
  };
}

export function sortedMonthKeys(file: MonthsFile): string[] {
  return Object.keys(file.months).sort();
}

export function monthlyContributionFor(goalId: string, items: MonthItem[]): number {
  return items
    .filter((it) => it.category === 'epargne' && it.goalId === goalId)
    .reduce((sum, it) => sum + (Number.isFinite(it.amount) ? it.amount : 0), 0);
}

export type GoalStatus = 'good' | 'warning' | 'critical' | 'reached' | 'nodate' | 'noamount' | 'abandoned' | 'income';

export interface GoalProgress {
  status: GoalStatus;
  progress: number | null;
  remaining: number | null;
  monthsLeft: number | null;
  requiredMonthly: number | null;
  currentMonthly: number;
  overdue: boolean;
}

export function goalProgress(goal: Goal, nowKey: string, currentItems: MonthItem[]): GoalProgress {
  const currentMonthly = monthlyContributionFor(goal.id, currentItems);
  const monthsLeft = goal.targetDate ? diffMonths(nowKey, goal.targetDate) : null;
  const base: GoalProgress = {
    status: 'nodate',
    progress: null,
    remaining: null,
    monthsLeft,
    requiredMonthly: null,
    currentMonthly,
    overdue: monthsLeft !== null && monthsLeft < 0,
  };

  if (goal.kind === 'entree') return { ...base, status: 'income' };

  if (goal.targetAmount !== null && goal.targetAmount > 0) {
    base.remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
    base.progress = Math.min(1, Math.max(0, goal.savedAmount / goal.targetAmount));
  }

  if (goal.priority === 'abandonne') return { ...base, status: 'abandoned' };
  if (base.remaining === null) return { ...base, status: 'noamount' };
  if (base.remaining === 0) return { ...base, status: 'reached', requiredMonthly: 0 };
  if (monthsLeft === null) return { ...base, status: 'nodate' };
  if (monthsLeft < 0) return { ...base, status: 'critical' };

  // Rounded up so that N payments really cover the remainder. Target month reached: the whole remainder is due now.
  const requiredMonthly = Math.ceil(base.remaining / Math.max(1, monthsLeft));
  const ratio = currentMonthly / requiredMonthly;
  const status: GoalStatus = ratio >= 1 ? 'good' : ratio >= 0.5 ? 'warning' : 'critical';
  return { ...base, status, requiredMonthly };
}

/** Months needed to close `remaining` at `monthly` per month; null if never. */
export function monthsToReach(remaining: number, monthly: number): number | null {
  if (remaining <= 0) return 0;
  if (monthly <= 0) return null;
  return Math.ceil(remaining / monthly);
}

export function sumLines(lines: AssetLine[]): number {
  return lines.reduce((s, l) => s + (Number.isFinite(l.amount) ? l.amount : 0), 0);
}

export function availableWealth(p: PatrimoineFile): number {
  return sumLines(p.financier);
}

export interface CompoundRow {
  year: number;
  contributed: number;
  gross: number;
  gains: number;
  net: number;
}

export function simulateCompound(
  initial: number,
  monthly: number,
  annualRate: number,
  years: number,
  exitTaxRate: number,
): CompoundRow[] {
  const r = Math.pow(1 + annualRate, 1 / 12) - 1;
  const rows: CompoundRow[] = [];
  let value = initial;
  let contributed = initial;
  const row = (year: number): CompoundRow => {
    const gains = value - contributed;
    return { year, contributed, gross: value, gains, net: value - Math.max(0, gains) * exitTaxRate };
  };
  rows.push(row(0));
  const months = Math.round(years * 12);
  for (let m = 1; m <= months; m++) {
    value = value * (1 + r) + monthly;
    contributed += monthly;
    if (m % 12 === 0 || m === months) rows.push(row(m / 12));
  }
  return rows;
}
