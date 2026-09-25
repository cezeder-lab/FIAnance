import type { AssetLine, Goal, GoalContribution, MonthItem, MonthsFile, PatrimoineFile } from '../types';
import { addMonths, diffMonths } from './months';

export const round2 = (n: number) => Math.round(n * 100) / 100;

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

export interface MonthTotals {
  revenus: number;
  depensesFixes: number;
  depensesVariables: number;
  epargne: number;
  /** revenus − dépenses − épargne allouée */
  cashflow: number;
  /** épargne / revenus */
  savingsRate: number | null;
}

export function monthTotals(items: MonthItem[]): MonthTotals {
  const sum = (cat: MonthItem['category']) => items.filter((it) => it.category === cat).reduce((s, it) => s + finite(it.amount), 0);
  const revenus = sum('revenu');
  const depensesFixes = sum('depense_fixe');
  const depensesVariables = sum('depense_variable');
  const epargne = sum('epargne');
  return {
    revenus,
    depensesFixes,
    depensesVariables,
    epargne,
    cashflow: revenus - depensesFixes - depensesVariables - epargne,
    savingsRate: revenus > 0 ? epargne / revenus : null,
  };
}

export function sortedMonthKeys(file: MonthsFile): string[] {
  return Object.keys(file.months).sort();
}

export function monthlyContributionFor(goalId: string, items: MonthItem[]): number {
  return items
    .filter((it) => it.category === 'epargne' && it.goalId === goalId)
    .reduce((sum, it) => sum + finite(it.amount), 0);
}

/** First month still open for contributions: once the current month is closed, its savings are already counted. */
export function contributionStart(file: MonthsFile, nowKey: string): string {
  return file.months[nowKey]?.closure ? addMonths(nowKey, 1) : nowKey;
}

export type GoalStatus = 'good' | 'warning' | 'critical' | 'reached' | 'nodate' | 'noamount' | 'abandoned' | 'income';

export interface GoalProgress {
  status: GoalStatus;
  progress: number | null;
  remaining: number | null;
  /** Months left to contribute, from `fromKey` up to (excluding) the target month. */
  monthsLeft: number | null;
  requiredMonthly: number | null;
  currentMonthly: number;
  overdue: boolean;
}

export function goalProgress(goal: Goal, fromKey: string, currentItems: MonthItem[]): GoalProgress {
  const currentMonthly = monthlyContributionFor(goal.id, currentItems);
  const monthsLeft = goal.targetDate ? diffMonths(fromKey, goal.targetDate) : null;
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

/** Savings of a month that go to purchase goals, summed per goal. */
export function monthContributions(items: MonthItem[], goals: Goal[]): GoalContribution[] {
  const purchaseIds = new Set(goals.filter((g) => g.kind === 'achat').map((g) => g.id));
  const byGoal = new Map<string, number>();
  for (const it of items) {
    if (it.category !== 'epargne' || !it.goalId || !purchaseIds.has(it.goalId) || !(it.amount > 0)) continue;
    byGoal.set(it.goalId, (byGoal.get(it.goalId) ?? 0) + it.amount);
  }
  return Array.from(byGoal, ([goalId, amount]) => ({ goalId, amount: round2(amount) }));
}

export function applyContributions(goals: Goal[], contributions: GoalContribution[], sign: 1 | -1): Goal[] {
  return goals.map((g) => {
    const c = contributions.find((x) => x.goalId === g.id);
    return c ? { ...g, savedAmount: Math.max(0, round2(g.savedAmount + sign * c.amount)) } : g;
  });
}

export function sumLines(lines: AssetLine[]): number {
  return lines.reduce((s, l) => s + finite(l.amount), 0);
}

export function availableWealth(p: PatrimoineFile): number {
  return sumLines(p.financier);
}

export function withHistoryPoint(p: PatrimoineFile, month: string, total: number): PatrimoineFile {
  return { ...p, history: [...p.history.filter((h) => h.month !== month), { month, total: round2(total) }] };
}

/** In 'quantite' mode the amount follows quantity × price; until both are known the previous amount is kept. */
export function valued(line: AssetLine): AssetLine {
  if (line.valuation !== 'quantite' || line.quantity == null || line.unitPrice == null) return line;
  return { ...line, amount: round2(line.quantity * line.unitPrice) };
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

export interface ProjectionEvent {
  /** "YYYY-MM" */
  month: string;
  /** Positive for an inflow, negative for a purchase. */
  amount: number;
  label: string;
}

export interface ProjectionInput {
  /** Month of today's balances (point 0). */
  fromKey: string;
  months: number;
  liquide: number;
  investi: number;
  /** Kept at its current value: no return is assumed for crypto. */
  crypto: number;
  toLiquid: number;
  toInvested: number;
  /** Monthly cash-flow net, only added in the second scenario. */
  leftover: number;
  liquidRate: number;
  investedRate: number;
  /** Events dated this month or earlier are applied at the first projected month. Inflows and purchases hit liquid savings. */
  events: ProjectionEvent[];
}

export interface ProjectionPoint {
  month: string;
  savingsOnly: number;
  withLeftover: number;
}

export function projectWealth(input: ProjectionInput): ProjectionPoint[] {
  const monthly = (annual: number) => Math.pow(1 + annual, 1 / 12) - 1;
  const rl = monthly(input.liquidRate);
  const ri = monthly(input.investedRate);
  const firstStep = addMonths(input.fromKey, 1);
  const eventsAt = (key: string) =>
    input.events.reduce((s, e) => s + ((e.month < firstStep ? firstStep : e.month) === key ? e.amount : 0), 0);

  let liquidA = input.liquide;
  let liquidB = input.liquide;
  let invested = input.investi;
  const start = input.liquide + input.investi + input.crypto;
  const points: ProjectionPoint[] = [{ month: input.fromKey, savingsOnly: start, withLeftover: start }];
  for (let m = 1; m <= input.months; m++) {
    const key = addMonths(input.fromKey, m);
    const events = eventsAt(key);
    liquidA = liquidA * (1 + rl) + input.toLiquid + events;
    liquidB = liquidB * (1 + rl) + input.toLiquid + input.leftover + events;
    invested = invested * (1 + ri) + input.toInvested;
    points.push({
      month: key,
      savingsOnly: liquidA + invested + input.crypto,
      withLeftover: liquidB + invested + input.crypto,
    });
  }
  return points;
}
