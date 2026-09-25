import { useState, type ReactNode } from 'react';
import { ArrowDownLeft, Calculator, ChevronDown, ChevronRight, Landmark, Pencil, Plus } from 'lucide-react';
import type { Nav } from '../App';
import type { Goal, GoalKind, GoalPriority } from '../types';
import { useData } from '../state/DataContext';
import { contributionStart, goalProgress, type GoalProgress } from '../lib/calc';
import { formatEURRounded, formatPercent } from '../lib/format';
import { formatMonthLong, isMonthKey, monthsLeftLabel } from '../lib/months';
import { moveById, type DropPosition } from '../lib/reorder';
import { uid } from '../lib/seed';
import { PRIORITY_LABELS } from '../lib/labels';
import { AmountInput } from '../components/AmountInput';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { PageHeader } from '../components/Layout';
import { ProgressBar } from '../components/ProgressBar';
import { DragHandle, useReorder } from '../components/Reorder';
import { StatusBadge, statusTone } from '../components/StatusBadge';

type Entry = { goal: Goal; progress: GoalProgress };
type RowProps = ReturnType<ReturnType<typeof useReorder>['itemProps']>;
type HandleProps = ReturnType<ReturnType<typeof useReorder>['handleProps']>;

export function GoalsView({ nav }: { nav: Nav }) {
  const { goals, months, nowKey, updateGoals } = useData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAbandoned, setShowAbandoned] = useState(false);
  const currentItems = months.months[nowKey]?.items ?? [];

  const patch = (id: string, p: Partial<Goal>) =>
    updateGoals((prev) => ({ ...prev, goals: prev.goals.map((g) => (g.id === id ? { ...g, ...p } : g)) }));
  const remove = (id: string) => updateGoals((prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== id) }));
  const create = (kind: GoalKind) => {
    const id = uid();
    const goal: Goal = {
      id,
      kind,
      name: '',
      priority: 'haute',
      targetDate: null,
      targetAmount: null,
      savedAmount: 0,
      linkedAccount: '',
      amountMin: null,
      amountMax: null,
      notes: '',
    };
    updateGoals((prev) => ({ ...prev, goals: [goal, ...prev.goals] }));
    setEditingId(id);
  };

  const fromKey = contributionStart(months, nowKey);
  const withProgress = goals.goals.map((g) => ({ goal: g, progress: goalProgress(g, fromKey, currentItems) }));
  const purchases = withProgress.filter((x) => x.goal.kind === 'achat');
  const high = purchases.filter((x) => x.goal.priority === 'haute');
  const low = purchases.filter((x) => x.goal.priority === 'basse');
  const abandoned = purchases.filter((x) => x.goal.priority === 'abandonne');
  const incomes = withProgress.filter((x) => x.goal.kind === 'entree');

  const active = [...high, ...low];
  const remainingHigh = high.reduce((s, x) => s + (x.progress.remaining ?? 0), 0);
  const monthlyAllocated = active.reduce((s, x) => s + x.progress.currentMonthly, 0);
  const monthlyRequired = active.reduce((s, x) => s + (x.progress.requiredMonthly ?? 0), 0);
  // Per goal: a surplus on one goal does not cover another goal's gap.
  const monthlyGap = active.reduce(
    (s, x) => s + (x.progress.requiredMonthly !== null ? Math.max(0, x.progress.requiredMonthly - x.progress.currentMonthly) : 0),
    0,
  );

  const move = (from: string, to: string, position: DropPosition) =>
    updateGoals((prev) => ({ ...prev, goals: moveById(prev.goals, from, to, position) }));

  const card = (x: Entry, rowProps: RowProps, handleProps: HandleProps) => (
    <GoalCard
      key={x.goal.id}
      goal={x.goal}
      progress={x.progress}
      nowKey={nowKey}
      editing={editingId === x.goal.id}
      rowProps={rowProps}
      handleProps={handleProps}
      onEdit={() => setEditingId(editingId === x.goal.id ? null : x.goal.id)}
      onPatch={(p) => patch(x.goal.id, p)}
      onDelete={() => remove(x.goal.id)}
      onSimulate={() => nav.go('simulateurs', { goalId: x.goal.id })}
    />
  );

  return (
    <div>
      <PageHeader
        title="Objectifs"
        subtitle="Le rythme actuel correspond aux lignes d’épargne liées à chaque objectif dans le mois en cours."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => create('entree')}>
              <ArrowDownLeft size={16} /> Entrée prévue
            </button>
            <button type="button" className="btn-primary" onClick={() => create('achat')}>
              <Plus size={16} /> Nouvel objectif
            </button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniStat label="Reste à financer (prioritaires)" value={formatEURRounded(remainingHigh)} />
        <MiniStat label="Épargne mensuelle fléchée" value={`${formatEURRounded(monthlyAllocated)}/mois`} />
        <MiniStat
          label="Rythme nécessaire (objectifs datés)"
          value={`${formatEURRounded(monthlyRequired)}/mois`}
          hint={monthlyGap > 0 ? `Il manque ${formatEURRounded(monthlyGap)}/mois sur les objectifs en retard` : undefined}
        />
      </div>

      <Section title="Prioritaires" entries={high} onMove={move} render={card} />
      <Section title="Entrées d’argent prévues" entries={incomes} onMove={move} render={card} />
      <Section title="Pas prioritaires" entries={low} onMove={move} render={card} />

      {abandoned.length > 0 && (
        <div className="mt-8">
          <button type="button" className="section-title flex items-center gap-1 hover:text-ink" onClick={() => setShowAbandoned((s) => !s)}>
            {showAbandoned ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Abandonnés ({abandoned.length})
          </button>
          {showAbandoned && (
            <div className="mt-3 opacity-70">
              <SortableGoals entries={abandoned} onMove={move} render={card} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SortableGoals({
  entries,
  onMove,
  render,
}: {
  entries: Entry[];
  onMove: (from: string, to: string, position: DropPosition) => void;
  render: (entry: Entry, rowProps: RowProps, handleProps: HandleProps) => ReactNode;
}) {
  const { itemProps, handleProps } = useReorder(
    entries.map((e) => e.goal.id),
    onMove,
  );
  return (
    <div className="flex flex-col gap-3">
      {entries.map((e) => render(e, itemProps(e.goal.id), handleProps(e.goal.id, e.goal.name)))}
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card px-5 py-4">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className="tabular mt-1 text-xl font-semibold text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-[var(--critical-ink)]">{hint}</div>}
    </div>
  );
}

function Section({
  title,
  entries,
  onMove,
  render,
}: {
  title: string;
  entries: Entry[];
  onMove: (from: string, to: string, position: DropPosition) => void;
  render: (entry: Entry, rowProps: RowProps, handleProps: HandleProps) => ReactNode;
}) {
  if (entries.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="section-title mb-3">
        {title} ({entries.length})
      </h2>
      <SortableGoals entries={entries} onMove={onMove} render={render} />
    </section>
  );
}

function GoalCard({
  goal,
  progress,
  nowKey,
  editing,
  rowProps,
  handleProps,
  onEdit,
  onPatch,
  onDelete,
  onSimulate,
}: {
  goal: Goal;
  progress: GoalProgress;
  nowKey: string;
  editing: boolean;
  rowProps: RowProps;
  handleProps: HandleProps;
  onEdit: () => void;
  onPatch: (p: Partial<Goal>) => void;
  onDelete: () => void;
  onSimulate: () => void;
}) {
  const isIncome = goal.kind === 'entree';
  return (
    <article className={`card reorder-item p-5 ${editing ? 'ring-2 ring-accent' : ''}`} {...rowProps}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="-ml-2">
              <DragHandle {...handleProps} />
            </span>
            <h3 className="text-base font-semibold text-ink">{goal.name || <span className="text-muted">Sans nom</span>}</h3>
            <StatusBadge progress={progress} />
            {goal.linkedAccount && (
              <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-ink-2">
                <Landmark size={12} /> {goal.linkedAccount}
              </span>
            )}
          </div>
          {goal.notes && !editing && <p className="mt-1 text-sm text-muted">{goal.notes}</p>}
        </div>
        <div className="flex items-center gap-0.5">
          {!isIncome && (
            <button type="button" className="icon-btn" title="Simuler" aria-label="Simuler" onClick={onSimulate}>
              <Calculator size={15} />
            </button>
          )}
          <button
            type="button"
            className={`icon-btn ${editing ? 'bg-accent-soft text-accent' : ''}`}
            title="Modifier"
            aria-label="Modifier"
            onClick={onEdit}
          >
            <Pencil size={15} />
          </button>
          <ConfirmDelete onConfirm={onDelete} />
        </div>
      </div>

      {isIncome ? (
        <div className="tabular mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Fact label="Montant estimé">
            {goal.amountMin !== null && goal.amountMax !== null && goal.amountMin !== goal.amountMax
              ? `${formatEURRounded(goal.amountMin)} – ${formatEURRounded(goal.amountMax)}`
              : formatEURRounded(goal.amountMin ?? goal.amountMax ?? 0)}
          </Fact>
          <Fact label="Date prévue">
            {goal.targetDate ? (
              <>
                {formatMonthLong(goal.targetDate)} <span className="text-muted">· {monthsLeftLabel(nowKey, goal.targetDate)}</span>
              </>
            ) : (
              '—'
            )}
          </Fact>
        </div>
      ) : (
        <>
          {progress.progress !== null && (
            <div className="mt-4 flex items-center gap-3">
              <ProgressBar value={progress.progress} tone={statusTone(progress.status)} label={`Progression ${goal.name}`} />
              <span className="tabular w-10 shrink-0 text-right text-sm font-semibold text-ink">{formatPercent(progress.progress)}</span>
            </div>
          )}
          <div className="tabular mt-4 grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
            <Fact label="Épargné">
              {formatEURRounded(goal.savedAmount)}
              <span className="text-muted"> / {goal.targetAmount !== null ? formatEURRounded(goal.targetAmount) : 'à définir'}</span>
            </Fact>
            <Fact label="Reste">{progress.remaining !== null ? formatEURRounded(progress.remaining) : '—'}</Fact>
            <Fact label="Échéance">
              {goal.targetDate ? (
                <>
                  {formatMonthLong(goal.targetDate)}
                  <div className="text-xs text-muted">{monthsLeftLabel(nowKey, goal.targetDate)}</div>
                </>
              ) : (
                <span className="text-muted">Pas de date</span>
              )}
            </Fact>
            <Fact label="Rythme nécessaire / actuel">
              {progress.requiredMonthly !== null ? (
                <>
                  {progress.overdue ? 'Échéance passée' : `${formatEURRounded(progress.requiredMonthly)}/mois`}
                  <div className="text-xs text-muted">
                    {!progress.overdue && progress.monthsLeft !== null && `sur ${Math.max(1, progress.monthsLeft)} mois · `}
                    actuel : {formatEURRounded(progress.currentMonthly)}/mois
                  </div>
                </>
              ) : (
                <>
                  <span className="text-muted">—</span>
                  {progress.currentMonthly > 0 && <div className="text-xs text-muted">actuel : {formatEURRounded(progress.currentMonthly)}/mois</div>}
                </>
              )}
            </Fact>
          </div>
          {progress.requiredMonthly !== null && progress.requiredMonthly > 0 && progress.currentMonthly === 0 && goal.priority !== 'abandonne' && (
            <p className="mt-3 text-xs text-muted">
              Aucune ligne d’épargne n’est liée à cet objectif ce mois-ci. Liez-en une dans l’onglet Mois (bouton Options d’une ligne d’épargne).
            </p>
          )}
        </>
      )}

      {editing && <GoalForm goal={goal} onPatch={onPatch} onDone={onEdit} />}
    </article>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 font-medium text-ink">{children}</div>
    </div>
  );
}

function GoalForm({ goal, onPatch, onDone }: { goal: Goal; onPatch: (p: Partial<Goal>) => void; onDone: () => void }) {
  const isIncome = goal.kind === 'entree';
  return (
    <div className="mt-5 grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-3">
      <label className="sm:col-span-2 lg:col-span-1">
        <span className="label">Nom</span>
        <input className="field" value={goal.name} autoFocus={!goal.name} onChange={(e) => onPatch({ name: e.target.value })} />
      </label>
      <label>
        <span className="label">Priorité</span>
        <select className="field" value={goal.priority} onChange={(e) => onPatch({ priority: e.target.value as GoalPriority })}>
          {(Object.keys(PRIORITY_LABELS) as GoalPriority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">{isIncome ? 'Date prévue' : 'Date visée'} (laisser vide si aucune)</span>
        <input
          type="month"
          className="field"
          value={goal.targetDate ?? ''}
          onChange={(e) => onPatch({ targetDate: isMonthKey(e.target.value) ? e.target.value : null })}
        />
      </label>

      {isIncome ? (
        <>
          <label>
            <span className="label">Montant bas</span>
            <AmountInput variant="field" allowEmpty value={goal.amountMin} onChange={(v) => onPatch({ amountMin: v })} />
          </label>
          <label>
            <span className="label">Montant haut</span>
            <AmountInput variant="field" allowEmpty value={goal.amountMax} onChange={(v) => onPatch({ amountMax: v })} />
          </label>
        </>
      ) : (
        <>
          <label>
            <span className="label">Montant cible</span>
            <AmountInput variant="field" allowEmpty placeholder="À définir" value={goal.targetAmount} onChange={(v) => onPatch({ targetAmount: v })} />
          </label>
          <label>
            <span className="label">Déjà mis de côté (augmente à chaque clôture de mois)</span>
            <AmountInput variant="field" value={goal.savedAmount} onChange={(v) => onPatch({ savedAmount: v ?? 0 })} />
          </label>
          <label>
            <span className="label">Compte lié (facultatif)</span>
            <input className="field" placeholder="ex. LDDS" value={goal.linkedAccount} onChange={(e) => onPatch({ linkedAccount: e.target.value })} />
          </label>
        </>
      )}
      <label className="sm:col-span-2 lg:col-span-3">
        <span className="label">Notes</span>
        <input className="field" value={goal.notes} onChange={(e) => onPatch({ notes: e.target.value })} />
      </label>
      <div className="flex justify-end sm:col-span-2 lg:col-span-3">
        <button type="button" className="btn-primary" onClick={onDone}>
          Terminé
        </button>
      </div>
    </div>
  );
}
