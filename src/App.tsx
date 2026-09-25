import { useEffect, useState } from 'react';
import {
  Calculator,
  CalendarDays,
  CircleAlert,
  CloudCheck,
  Download,
  FolderOpen,
  Landmark,
  LayoutDashboard,
  LoaderCircle,
  Target,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useData } from './state/DataContext';
import { bridge, isDesktop } from './lib/bridge';
import { Dashboard } from './views/Dashboard';
import { MonthView } from './views/MonthView';
import { GoalsView } from './views/GoalsView';
import { WealthView } from './views/WealthView';
import { SimulatorsView } from './views/SimulatorsView';

export type ViewId = 'dashboard' | 'mois' | 'objectifs' | 'patrimoine' | 'simulateurs';

export interface Nav {
  go: (view: ViewId, opts?: { month?: string; goalId?: string }) => void;
}

const NAV: { id: ViewId; label: string; Icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Vue d’ensemble', Icon: LayoutDashboard },
  { id: 'mois', label: 'Mois', Icon: CalendarDays },
  { id: 'objectifs', label: 'Objectifs', Icon: Target },
  { id: 'patrimoine', label: 'Patrimoine', Icon: Landmark },
  { id: 'simulateurs', label: 'Simulateurs', Icon: Calculator },
];

export function App() {
  const { nowKey, saveState, backup, warnings, dismissWarnings } = useData();
  const [view, setView] = useState<ViewId>('dashboard');
  const [month, setMonth] = useState(nowKey);
  const [simGoalId, setSimGoalId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const nav: Nav = {
    go: (v, opts) => {
      if (opts?.month) setMonth(opts.month);
      if (opts?.goalId !== undefined) setSimGoalId(opts.goalId);
      setView(v);
      document.getElementById('main')?.scrollTo({ top: 0 });
    },
  };

  const onBackup = async () => {
    try {
      const res = await backup();
      if (res.ok) {
        setNotice(
          res.folder ? `Sauvegarde créée : ${res.files?.length ?? 0} fichiers copiés dans ${res.folder}` : 'Sauvegarde téléchargée.',
        );
      }
    } catch (err) {
      setNotice(`La sauvegarde a échoué : ${String(err)}`);
    }
  };

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-surface">
        <div className="flex items-center gap-2.5 px-5 pb-6 pt-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">F</div>
          <div>
            <div className="text-[15px] font-semibold leading-tight text-ink">FIAnance</div>
            <div className="text-xs text-muted">Patrimoine personnel</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 px-3">
          {NAV.map(({ id, label, Icon }) => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => nav.go(id, id === 'mois' ? { month: nowKey } : undefined)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  active ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-sunken hover:text-ink'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={17} strokeWidth={2} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1 border-t border-line p-3">
          <div className="flex items-center gap-2 whitespace-nowrap px-3 py-1.5 text-xs text-muted" aria-live="polite">
            {saveState === 'pending' && (
              <>
                <LoaderCircle size={14} className="animate-spin" /> Enregistrement…
              </>
            )}
            {saveState === 'saved' && (
              <>
                <CloudCheck size={14} className="text-[var(--good-ink)]" /> Enregistré automatiquement
              </>
            )}
            {saveState === 'error' && (
              <>
                <CircleAlert size={14} className="text-[var(--critical-ink)]" /> Erreur d’enregistrement
              </>
            )}
          </div>
          <button type="button" className="btn-ghost w-full justify-start whitespace-nowrap" onClick={onBackup}>
            <Download size={16} /> Exporter une sauvegarde
          </button>
          {isDesktop && (
            <button type="button" className="btn-ghost w-full justify-start whitespace-nowrap" onClick={() => void bridge.openDataFolder()}>
              <FolderOpen size={16} /> Dossier des données
            </button>
          )}
        </div>
      </aside>

      <main id="main" className="relative flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          {warnings.length > 0 && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-line bg-[var(--warning-soft)] p-4 text-sm text-ink">
              <CircleAlert size={18} className="mt-0.5 shrink-0 text-[var(--warning-ink)]" />
              <div className="flex-1 space-y-1">
                {warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
              <button type="button" className="icon-btn" aria-label="Fermer" onClick={dismissWarnings}>
                <X size={15} />
              </button>
            </div>
          )}

          {view === 'dashboard' && <Dashboard nav={nav} />}
          {view === 'mois' && <MonthView month={month} setMonth={setMonth} />}
          {view === 'objectifs' && <GoalsView nav={nav} />}
          {view === 'patrimoine' && <WealthView />}
          {view === 'simulateurs' && <SimulatorsView initialGoalId={simGoalId} />}
        </div>

        {notice && (
          <div className="fixed bottom-6 right-6 z-10 flex max-w-md items-start gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-ink shadow-lg">
            <span className="flex-1 break-words">{notice}</span>
            <button type="button" className="icon-btn -mr-1 -mt-1" aria-label="Fermer" onClick={() => setNotice(null)}>
              <X size={15} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
