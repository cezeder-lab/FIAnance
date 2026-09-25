import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { BackupResult, DataName, GoalsFile, MonthsFile, PatrimoineFile } from '../types';
import { bridge } from '../lib/bridge';
import { currentMonthKey } from '../lib/months';
import { ensureMonth, seedGoals, seedMonths, seedPatrimoine } from '../lib/seed';
import { ensureCurrentAccount, isLatestBalance, withBalanceCheck, withCurrentAccountBalance } from '../lib/account';

type SaveState = 'saved' | 'pending' | 'error';
type Updater<T> = (fn: (prev: T) => T) => void;

interface DataContextValue {
  months: MonthsFile;
  goals: GoalsFile;
  patrimoine: PatrimoineFile;
  nowKey: string;
  updateMonths: Updater<MonthsFile>;
  updateGoals: Updater<GoalsFile>;
  updatePatrimoine: Updater<PatrimoineFile>;
  /** Records the current-account balance of a month; the most recent one also updates the wealth line. null clears it. */
  recordBalance: (monthKey: string, amount: number | null) => void;
  saveState: SaveState;
  dataDir: string | null;
  warnings: string[];
  dismissWarnings: () => void;
  /** Folder of the automatic copy made because a new version started, shown once. */
  versionBackup: string | null;
  dismissVersionBackup: () => void;
  backup: () => Promise<BackupResult>;
}

const DataContext = createContext<DataContextValue | null>(null);

const SAVE_DELAY_MS = 400;

export function DataProvider({ children }: { children: ReactNode }) {
  const [nowKey] = useState(currentMonthKey);
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [months, setMonths] = useState<MonthsFile | null>(null);
  const [goals, setGoals] = useState<GoalsFile | null>(null);
  const [patrimoine, setPatrimoine] = useState<PatrimoineFile | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [versionBackup, setVersionBackup] = useState<string | null>(null);

  const pending = useRef(new Map<DataName, unknown>());
  const timer = useRef<number | null>(null);

  const flush = useCallback(async () => {
    timer.current = null;
    const batch = Array.from(pending.current.entries());
    pending.current.clear();
    try {
      await Promise.all(batch.map(([name, data]) => bridge.save(name, data)));
      if (pending.current.size === 0) setSaveState('saved');
    } catch {
      for (const [name, data] of batch) if (!pending.current.has(name)) pending.current.set(name, data);
      setSaveState('error');
    }
  }, []);

  const schedule = useCallback(
    (name: DataName, data: unknown) => {
      pending.current.set(name, data);
      setSaveState('pending');
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  useEffect(() => {
    bridge
      .load()
      .then((res) => {
        setMonths(ensureMonth(res.mois ?? seedMonths(nowKey), nowKey));
        setGoals(res.objectifs ?? seedGoals());
        setPatrimoine(ensureCurrentAccount(res.patrimoine ?? seedPatrimoine()));
        setDataDir(res.dataDir);
        setWarnings(res.warnings);
        setVersionBackup(res.versionBackup ?? null);
      })
      .catch((err: unknown) => setLoadError(String(err)));
  }, [nowKey]);

  // Every state change is persisted (debounced); the first run also writes the seed to disk.
  useEffect(() => void (months && schedule('mois', months)), [months, schedule]);
  useEffect(() => void (goals && schedule('objectifs', goals)), [goals, schedule]);
  useEffect(() => void (patrimoine && schedule('patrimoine', patrimoine)), [patrimoine, schedule]);

  useEffect(() => {
    const onUnload = () => {
      for (const [name, data] of pending.current) bridge.saveSync(name, data);
      pending.current.clear();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  const updateMonths = useCallback<Updater<MonthsFile>>((fn) => setMonths((p) => (p ? fn(p) : p)), []);
  const updateGoals = useCallback<Updater<GoalsFile>>((fn) => setGoals((p) => (p ? fn(p) : p)), []);
  const updatePatrimoine = useCallback<Updater<PatrimoineFile>>((fn) => setPatrimoine((p) => (p ? fn(p) : p)), []);

  const backup = useCallback(async () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    await flush();
    return bridge.backup();
  }, [flush]);

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center p-8 text-center text-ink-2">
        Impossible de charger les données : {loadError}
      </div>
    );
  }
  if (!months || !goals || !patrimoine) {
    return <div className="flex h-screen items-center justify-center text-muted">Chargement…</div>;
  }

  const recordBalance = (monthKey: string, amount: number | null) => {
    if (amount === null) {
      updateMonths((prev) => withBalanceCheck(prev, monthKey, null));
      return;
    }
    const check = { amount, at: new Date().toISOString() };
    const latest = isLatestBalance(months, monthKey);
    updateMonths((prev) => withBalanceCheck(prev, monthKey, check));
    if (latest) updatePatrimoine((prev) => withCurrentAccountBalance(prev, check));
  };

  return (
    <DataContext.Provider
      value={{
        months,
        goals,
        patrimoine,
        nowKey,
        updateMonths,
        updateGoals,
        updatePatrimoine,
        recordBalance,
        saveState,
        dataDir,
        warnings,
        dismissWarnings: () => setWarnings([]),
        versionBackup,
        dismissVersionBackup: () => setVersionBackup(null),
        backup,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
