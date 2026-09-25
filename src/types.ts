export type ItemCategory = 'revenu' | 'depense_fixe' | 'depense_variable' | 'epargne';

export interface MonthItem {
  id: string;
  label: string;
  amount: number;
  category: ItemCategory;
  recurring: boolean;
  /** Revenue that never hits the bank account (e.g. company-car benefit): shown but kept out of the cash-flow. */
  inKind?: boolean;
  goalId?: string | null;
}

export interface MonthData {
  items: MonthItem[];
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
  amount: number;
  kind?: AssetKind;
  /** ISO date of the last amount change. */
  updatedAt: string | null;
}

export interface HistoryPoint {
  /** "YYYY-MM" */
  month: string;
  total: number;
}

export interface PatrimoineFile {
  version: 1;
  financier: AssetLine[];
  immobilier: AssetLine[];
  heritage: AssetLine[];
  history: HistoryPoint[];
}

export type DataName = 'mois' | 'objectifs' | 'patrimoine';

export interface LoadResult {
  mois: MonthsFile | null;
  objectifs: GoalsFile | null;
  patrimoine: PatrimoineFile | null;
  dataDir: string | null;
  warnings: string[];
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
