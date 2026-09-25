export type ItemCategory = 'revenu' | 'depense_fixe' | 'depense_variable' | 'epargne';

export interface MonthItem {
  id: string;
  label: string;
  amount: number;
  category: ItemCategory;
  recurring: boolean;
  goalId?: string | null;
  /** Received (revenue), paid (expense) or transferred (savings) this month. */
  cleared?: boolean;
}

export interface BalanceCheck {
  amount: number;
  /** ISO date */
  at: string;
}

export interface GoalContribution {
  goalId: string;
  amount: number;
}

export interface MonthClosure {
  /** ISO date */
  closedAt: string;
  /** Added to the goals' saved amounts when closing, subtracted again when reopening. */
  contributions: GoalContribution[];
}

export interface MonthData {
  items: MonthItem[];
  closure?: MonthClosure;
  /** Current-account balance before this month's income, when typed by hand; otherwise the previous month's last balance is used. */
  openingBalance?: number | null;
  /** Last current-account balance read on the bank side during this month. */
  balanceCheck?: BalanceCheck | null;
}

export interface MonthsFile {
  version: 1;
  months: Record<string, MonthData>;
}

export type GoalPriority = 'haute' | 'basse' | 'abandonne';
export type GoalKind = 'achat' | 'entree';

export interface Goal {
  id: string;
  kind: GoalKind;
  name: string;
  priority: GoalPriority;
  /** "YYYY-MM" */
  targetDate: string | null;
  /** achat: target price. null = "à définir". */
  targetAmount: number | null;
  savedAmount: number;
  linkedAccount: string;
  /** entree: expected range. */
  amountMin: number | null;
  amountMax: number | null;
  notes: string;
}

export interface GoalsFile {
  version: 1;
  goals: Goal[];
}

export type AssetKind = 'liquide' | 'investi' | 'crypto';

export interface AssetLine {
  id: string;
  label: string;
  /** In 'quantite' mode, kept equal to quantity × unitPrice once both are known. */
  amount: number;
  kind?: AssetKind;
  /** ISO date of the last amount change. */
  updatedAt: string | null;
  valuation?: 'montant' | 'quantite';
  quantity?: number | null;
  unitPrice?: number | null;
  /** The current account: its amount follows the last balance recorded in the month view. */
  role?: 'compte-courant';
}

export interface HistoryPoint {
  /** "YYYY-MM" */
  month: string;
  total: number;
}

export interface PatrimoineFile {
  version: 1;
  financier: AssetLine[];
  history: HistoryPoint[];
}

export type DataName = 'mois' | 'objectifs' | 'patrimoine';

export interface LoadResult {
  mois: MonthsFile | null;
  objectifs: GoalsFile | null;
  patrimoine: PatrimoineFile | null;
  dataDir: string | null;
  warnings: string[];
  /** Folder where the data was copied because a new app version started for the first time. */
  versionBackup?: string | null;
}

export interface BackupResult {
  ok: boolean;
  canceled?: boolean;
  folder?: string;
  files?: string[];
}

export interface FiananceBridge {
  load(): Promise<LoadResult>;
  save(name: DataName, data: unknown): Promise<void>;
  saveSync(name: DataName, data: unknown): boolean;
  backup(): Promise<BackupResult>;
  openDataFolder(): Promise<string>;
}

declare global {
  interface Window {
    fianance?: FiananceBridge;
  }
}
