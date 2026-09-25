import { useMemo, useState } from 'react';
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  CopyPlus,
  Link2,
  LockOpen,
  Plus,
  Repeat,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';
import type { Nav } from '../App';
import type { ItemCategory, MonthItem } from '../types';
import { useData } from '../state/DataContext';
import {
  applyContributions,
  availableWealth,
  monthContributions,
  monthTotals,
  round2,
  sortedMonthKeys,
  withHistoryPoint,
} from '../lib/calc';
import { accountSummary, currentAccountLine, isLatestBalance } from '../lib/account';
import { formatEURRounded, formatPercent } from '../lib/format';
import { addMonths, formatDay, formatMonthLong, formatMonthShort, toMonthKey } from '../lib/months';
import { moveById, type DropPosition } from '../lib/reorder';
import { carryOver, previousMonthWithData, uid } from '../lib/seed';
import { CATEGORY_LABELS, CATEGORY_SINGULAR, CLEARED_LABELS } from '../lib/labels';
import { AmountInput } from '../components/AmountInput';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { Card, PageHeader } from '../components/Layout';
import { DragHandle, useReorder } from '../components/Reorder';
import { TrendChart } from '../components/TrendChart';
import { AccountCard } from './AccountCard';

const COLUMNS: ItemCategory[][] = [
  ['revenu', 'epargne'],
  ['depense_fixe', 'depense_variable'],
];

interface CloseOptions {
  recordPoint: boolean;
  closingBalance: number | null;
}

export function MonthView({
  month,
  setMonth,
  nav,
  openClosing = false,
}: {
  month: string;
  setMonth: (m: string) => void;
  nav: Nav;
  openClosing?: boolean;
}) {
  const { months, goals, nowKey, updateMonths, updateGoals, updatePatrimoine, recordBalance } = useData();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  // Tied to a month so that navigating elsewhere hides the panel.
  const [closingMonth, setClosingMonth] = useState<string | null>(openClosing ? month : null);
  const closing = closingMonth === month;

  const data = months.months[month];
  const items = data?.items ?? [];
  const closure = data?.closure;
  const readOnly = Boolean(closure);
  const canClose = Boolean(data) && !closure && month <= nowKey;
  const totals = monthTotals(items);
  const prevWithData = previousMonthWithData(months, month);

  const setItems = (fn: (items: MonthItem[]) => MonthItem[]) =>
    updateMonths((prev) => ({
      ...prev,
      months: { ...prev.months, [month]: { ...prev.months[month], items: fn(prev.months[month]?.items ?? []) } },
    }));

  const patchItem = (id: string, patch: Partial<MonthItem>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addItem = (category: ItemCategory) => {
    const id = uid();
    setItems((list) => [...list, { id, label: '', amount: 0, category, recurring: true, goalId: null, cleared: false }]);
    setFocusId(id);
  };

  const addUnidentified = (amount: number) =>
    setItems((list) => [
      ...list,
      { id: uid(), label: 'Dépenses non identifiées', amount: round2(amount), category: 'depense_variable', recurring: false, goalId: null, cleared: true },
    ]);

  const createMonth = (fromPrevious: boolean) =>
    updateMonths((prev) => ({
      ...prev,
      months: {
        ...prev.months,
        [month]: { items: fromPrevious && prevWithData ? carryOver(prev.months[prevWithData].items) : [] },
      },
    }));

  const deleteMonth = () =>
    updateMonths((prev) => {
      const rest = { ...prev.months };
      delete rest[month];
      return { ...prev, months: rest };
    });

  const contributions = monthContributions(items, goals.goals);

  const confirmClose = ({ recordPoint, closingBalance }: CloseOptions) => {
    const closedAt = new Date().toISOString();
    // Recorded first so that the wealth point below already includes the closing balance.
    if (closingBalance !== null) recordBalance(month, closingBalance);
    updateGoals((prev) => ({ ...prev, goals: applyContributions(prev.goals, contributions, 1) }));
    if (recordPoint) updatePatrimoine((prev) => withHistoryPoint(prev, month, availableWealth(prev)));
    updateMonths((prev) => ({
      ...prev,
      months: { ...prev.months, [month]: { ...prev.months[month], closure: { closedAt, contributions } } },
    }));
    setClosingMonth(null);
  };

  const reopen = () => {
    if (!closure) return;
    updateGoals((prev) => ({ ...prev, goals: applyContributions(prev.goals, closure.contributions, -1) }));
    updateMonths((prev) => {
      const reopened = { ...prev.months[month] };
      delete reopened.closure;
      return { ...prev, months: { ...prev.months, [month]: reopened } };
    });
  };

  const history = useMemo(
    () =>
      sortedMonthKeys(months).map((key) => {
        const t = monthTotals(months.months[key].items);
        return { key, label: formatMonthShort(key), value: t.cashflow, totals: t, closed: Boolean(months.months[key].closure) };
      }),
    [months],
  );

  const activeGoals = goals.goals.filter((g) => g.kind === 'achat');
  const period = month === nowKey ? 'Mois en cours' : month < nowKey ? 'Mois passé' : 'Mois à venir';

  return (
    <div>
      <PageHeader
        title={formatMonthLong(month)}
        subtitle={closure ? `${period} · clôturé le ${formatDay(closure.closedAt)}` : period}
        actions={
          <>
            {month !== nowKey && (
              <button type="button" className="btn-ghost" onClick={() => setMonth(nowKey)}>
                Revenir au mois en cours
              </button>
            )}
            {closure && (
              <button
                type="button"
                className="btn-secondary"
                title="Déverrouille le mois et retire des objectifs l’épargne versée à la clôture"
                onClick={reopen}
              >
                <LockOpen size={15} /> Rouvrir le mois
              </button>
            )}
            {canClose && !closing && (
              <button type="button" className="btn-primary" onClick={() => setClosingMonth(month)}>
                <CalendarCheck size={16} /> Clôturer le mois
              </button>
            )}
            <div className="flex items-center rounded-lg border border-line bg-surface">
              <button type="button" className="icon-btn m-0.5" aria-label="Mois précédent" onClick={() => setMonth(addMonths(month, -1))}>
                <ChevronLeft size={17} />
              </button>
              <span className="min-w-[8.5rem] px-2 text-center text-sm font-medium text-ink">{formatMonthLong(month)}</span>
              <button type="button" className="icon-btn m-0.5" aria-label="Mois suivant" onClick={() => setMonth(addMonths(month, 1))}>
                <ChevronRight size={17} />
              </button>
            </div>
          </>
        }
      />

      {closing && canClose && (
        <ClosingPanel
          month={month}
          contributions={contributions}
          onCancel={() => setClosingMonth(null)}
          onConfirm={confirmClose}
          onUpdateWealth={() => nav.go('patrimoine')}
        />
      )}

      {!data ? (
        <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center">
          <p className="text-ink-2">Aucune donnée saisie pour {formatMonthLong(month).toLowerCase()}.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {prevWithData && (
              <button type="button" className="btn-primary" onClick={() => createMonth(true)}>
                <CopyPlus size={16} /> Pré-remplir depuis {formatMonthLong(prevWithData).toLowerCase()}
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={() => createMonth(false)}>
              Commencer un mois vide
            </button>
          </div>
          {prevWithData && <p className="text-xs text-muted">Seules les lignes marquées « récurrentes » sont reprises.</p>}
        </div>
      ) : (
        <>
          <CashflowSummary totals={totals} />

          {month <= nowKey && <AccountCard month={month} readOnly={readOnly} onAddUnidentified={addUnidentified} />}

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {COLUMNS.map((col) => (
              <div key={col.join()} className="flex flex-col gap-6">
                {col.map((cat) => (
                  <CategoryCard
                    key={cat}
                    category={cat}
                    items={items.filter((it) => it.category === cat)}
                    goals={activeGoals}
                    focusId={focusId}
                    readOnly={readOnly}
                    onAdd={() => addItem(cat)}
                    onPatch={patchItem}
                    onMove={(from, to, position) => setItems((list) => moveById(list, from, to, position))}
                    onDelete={(id) => setItems((list) => list.filter((it) => it.id !== id))}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      <Card
        className="mt-6"
        title="Historique du cash-flow net"
        subtitle="Cliquez sur un point pour ouvrir le mois correspondant."
        actions={
          <button type="button" className="btn-ghost" onClick={() => setShowTable((s) => !s)}>
            {showTable ? 'Masquer le détail' : 'Voir le détail'}
          </button>
        }
      >
        <TrendChart
          data={history}
          seriesName="Cash-flow net"
          onPointClick={setMonth}
          emptyText="La courbe apparaîtra dès le deuxième mois saisi."
        />
        {showTable && (
          <table className="tabular mt-5 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-medium">Mois</th>
                <th className="py-2 text-right font-medium">Revenus</th>
                <th className="py-2 text-right font-medium">Dépenses</th>
                <th className="py-2 text-right font-medium">Épargne</th>
                <th className="py-2 text-right font-medium">Cash-flow net</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((h) => (
                <tr
                  key={h.key}
                  className={`cursor-pointer border-b border-line last:border-0 hover:bg-sunken ${h.key === month ? 'bg-accent-soft' : ''}`}
                  onClick={() => setMonth(h.key)}
                >
                  <td className="py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {formatMonthLong(h.key)}
                      {h.closed && <CalendarCheck size={13} className="text-[var(--good-ink)]" aria-label="clôturé" />}
                    </span>
                  </td>
                  <td className="py-2 text-right">{formatEURRounded(h.totals.revenus)}</td>
                  <td className="py-2 text-right">{formatEURRounded(h.totals.depensesFixes + h.totals.depensesVariables)}</td>
                  <td className="py-2 text-right">{formatEURRounded(h.totals.epargne)}</td>
                  <td className={`py-2 text-right font-semibold ${h.value < 0 ? 'text-negative' : 'text-ink'}`}>{formatEURRounded(h.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {data && !readOnly && (
        <div className="mt-6 flex items-center justify-end gap-2 text-xs text-muted">
          Supprimer toutes les lignes de ce mois
          <ConfirmDelete label="Supprimer ce mois" onConfirm={deleteMonth} />
        </div>
      )}
    </div>
  );
}

function ClosingPanel({
  month,
  contributions,
  onCancel,
  onConfirm,
  onUpdateWealth,
}: {
  month: string;
  contributions: { goalId: string; amount: number }[];
  onCancel: () => void;
  onConfirm: (options: CloseOptions) => void;
  onUpdateWealth: () => void;
}) {
  const { months, goals, patrimoine, nowKey } = useData();
  const items = months.months[month]?.items ?? [];
  const summary = accountSummary(months, month);
  const monthName = formatMonthLong(month).toLowerCase();
  // Today's balances only describe the current or previous month; re-closing an older month keeps its point.
  const [recordPoint, setRecordPoint] = useState(month >= addMonths(nowKey, -1));
  const [closingBalance, setClosingBalance] = useState<number | null>(summary.actual?.amount ?? summary.expected);

  const account = currentAccountLine(patrimoine);
  const accountWillFollow = closingBalance !== null && isLatestBalance(months, month);
  const wealth = availableWealth(patrimoine) - (accountWillFollow && account ? account.amount - (closingBalance as number) : 0);
  const existing = patrimoine.history.find((h) => h.month === month);
  const stale = patrimoine.financier.filter(
    (l) => l.role !== 'compte-courant' && (!l.updatedAt || toMonthKey(new Date(l.updatedAt)) < month),
  );
  const unchecked = items.filter((it) => !it.cleared);
  const linkedNotTransferred = items.filter((it) => it.category === 'epargne' && it.goalId && !it.cleared && it.amount > 0);

  return (
    <section className="card mb-6 border-accent p-5 ring-1 ring-accent" aria-label={`Clôturer ${monthName}`}>
      <h2 className="text-[15px] font-semibold text-ink">Clôturer {monthName}</h2>
      <p className="mt-0.5 text-xs text-muted">Le mois sera verrouillé ; vous pourrez le rouvrir pour le corriger.</p>

      {unchecked.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-xs text-ink">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-[var(--warning-ink)]" />
          <span>
            Pas encore cochées : {unchecked.map((it) => `${it.label || 'ligne sans nom'} (${CLEARED_LABELS[it.category].todo.toLowerCase()})`).join(', ')}.
            Cochez celles qui sont réglées avant de clôturer.
          </span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-3">
        <div>
          <h3 className="section-title mb-2">Épargne versée aux objectifs</h3>
          {contributions.length === 0 ? (
            <p className="text-sm text-muted">Aucune épargne cochée « versé » n’est liée à un objectif.</p>
          ) : (
            <ul className="tabular space-y-1.5 text-sm">
              {contributions.map((c) => {
                const goal = goals.goals.find((g) => g.id === c.goalId);
                if (!goal) return null;
                return (
                  <li key={c.goalId} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-ink">{goal.name}</span>
                    <span className="font-medium text-positive">+{formatEURRounded(c.amount)}</span>
                    <span className="text-muted">
                      ({formatEURRounded(goal.savedAmount)} → {formatEURRounded(goal.savedAmount + c.amount)})
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {linkedNotTransferred.length > 0 && (
            <p className="mt-1.5 text-xs text-muted">
              Non comptée car pas cochée « versé » : {linkedNotTransferred.map((it) => it.label || 'ligne sans nom').join(', ')}.
            </p>
          )}
        </div>

        <div>
          <h3 className="section-title mb-2">Compte courant</h3>
          <label className="block text-sm text-ink">
            <span className="label">Solde à la clôture (repris comme solde de départ du mois suivant)</span>
            <AmountInput variant="field" allowEmpty placeholder="à saisir" value={closingBalance} onChange={setClosingBalance} ariaLabel="Solde à la clôture" />
          </label>
        </div>

        <div>
          <h3 className="section-title mb-2">Point de patrimoine</h3>
          <label className="tabular flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-1" checked={recordPoint} onChange={(e) => setRecordPoint(e.target.checked)} />
            <span>
              Enregistrer le patrimoine ({formatEURRounded(wealth)}) comme point de {monthName}
              {existing && <span className="text-muted"> — remplace {formatEURRounded(existing.total)}</span>}
            </span>
          </label>
          {recordPoint && stale.length > 0 && (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-xs text-ink">
              <TriangleAlert size={14} className="mt-0.5 shrink-0 text-[var(--warning-ink)]" />
              <span>
                Pas de mise à jour depuis le début du mois : {stale.map((l) => l.label || 'ligne sans nom').join(', ')}.{' '}
                <button type="button" className="font-medium text-accent hover:underline" onClick={onUpdateWealth}>
                  Mettre à jour les soldes
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Annuler
        </button>
        <button type="button" className="btn-primary" onClick={() => onConfirm({ recordPoint, closingBalance })}>
          <CalendarCheck size={16} /> Confirmer la clôture
        </button>
      </div>
    </section>
  );
}

function CashflowSummary({ totals }: { totals: ReturnType<typeof monthTotals> }) {
  const parts: { label: string; value: number; sign: '' | '−' }[] = [
    { label: 'Revenus', value: totals.revenus, sign: '' },
    { label: 'Dépenses fixes', value: totals.depensesFixes, sign: '−' },
    { label: 'Dépenses variables', value: totals.depensesVariables, sign: '−' },
    { label: 'Épargne allouée', value: totals.epargne, sign: '−' },
  ];
  return (
    <div className="card flex flex-wrap items-center gap-x-10 gap-y-5 p-6">
      <div>
        <div className="text-sm font-medium text-ink-2">Cash-flow net du mois</div>
        <div className={`mt-1 text-5xl font-semibold tracking-tight ${totals.cashflow < 0 ? 'text-negative' : 'text-positive'}`}>
          {formatEURRounded(totals.cashflow)}
        </div>
        <div className="mt-2 text-sm text-ink-2">
          Reste disponible après dépenses et épargne
          {totals.savingsRate !== null && <> · taux d’épargne {formatPercent(totals.savingsRate)}</>}
        </div>
      </div>
      <div className="tabular ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-4">
            {p.sign && <span className="text-lg text-muted">{p.sign}</span>}
            <div>
              <div className="text-xs text-muted">{p.label}</div>
              <div className="font-semibold text-ink">{formatEURRounded(p.value)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  items,
  goals,
  focusId,
  readOnly,
  onAdd,
  onPatch,
  onMove,
  onDelete,
}: {
  category: ItemCategory;
  items: MonthItem[];
  goals: { id: string; name: string }[];
  focusId: string | null;
  readOnly: boolean;
  onAdd: () => void;
  onPatch: (id: string, patch: Partial<MonthItem>) => void;
  onMove: (fromId: string, toId: string, position: DropPosition) => void;
  onDelete: (id: string) => void;
}) {
  const { itemProps, handleProps } = useReorder(
    items.map((it) => it.id),
    onMove,
  );
  const total = items.reduce((s, it) => s + it.amount, 0);
  const remaining = items.filter((it) => !it.cleared).reduce((s, it) => s + it.amount, 0);
  const labels = CLEARED_LABELS[category];
  return (
    <Card
      title={CATEGORY_LABELS[category]}
      subtitle={items.length === 0 ? undefined : remaining > 0 ? `${labels.remaining} : ${formatEURRounded(remaining)}` : labels.allDone}
      actions={<span className="tabular text-[15px] font-semibold text-ink">{formatEURRounded(total)}</span>}
      bodyClassName="px-3 py-2"
    >
      {items.length === 0 && <p className="px-2 py-3 text-sm text-muted">Aucune ligne.</p>}
      <ul>
        {items.map((it) => (
          <ItemRow
            key={it.id}
            item={it}
            goals={goals}
            autoFocus={it.id === focusId}
            readOnly={readOnly}
            rowProps={itemProps(it.id)}
            handleProps={handleProps(it.id, it.label)}
            onPatch={onPatch}
            onDelete={onDelete}
          />
        ))}
      </ul>
      {!readOnly && (
        <button type="button" className="btn-ghost mt-1 text-accent hover:text-accent" onClick={onAdd}>
          <Plus size={16} /> Ajouter
        </button>
      )}
    </Card>
  );
}

function ItemRow({
  item,
  goals,
  autoFocus,
  readOnly,
  rowProps,
  handleProps,
  onPatch,
  onDelete,
}: {
  item: MonthItem;
  goals: { id: string; name: string }[];
  autoFocus: boolean;
  readOnly: boolean;
  rowProps: ReturnType<ReturnType<typeof useReorder>['itemProps']>;
  handleProps: ReturnType<ReturnType<typeof useReorder>['handleProps']>;
  onPatch: (id: string, patch: Partial<MonthItem>) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const linkedGoal = item.goalId ? goals.find((g) => g.id === item.goalId) : undefined;
  const labels = CLEARED_LABELS[item.category];

  return (
    <li className="reorder-item border-b border-line last:border-0" {...rowProps}>
      <div className="flex items-center gap-1 py-1">
        {!readOnly && <DragHandle {...handleProps} />}
        <button
          type="button"
          className="icon-btn shrink-0 disabled:cursor-default disabled:hover:bg-transparent"
          title={item.cleared ? `${labels.done} ce mois-ci` : `${labels.todo} ce mois-ci`}
          aria-label={`${labels.done} : ${item.label || 'ligne sans nom'}`}
          aria-pressed={Boolean(item.cleared)}
          disabled={readOnly}
          onClick={() => onPatch(item.id, { cleared: !item.cleared })}
        >
          {item.cleared ? (
            <CircleCheck size={18} className="text-[var(--good-ink)]" fill="var(--good-soft)" />
          ) : (
            <Circle size={18} className="text-muted" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <input
            className="inline-input"
            value={item.label}
            title={item.label}
            placeholder={`Nouvelle ligne (${CATEGORY_SINGULAR[item.category].toLowerCase()})`}
            aria-label="Libellé"
            autoFocus={autoFocus}
            disabled={readOnly}
            onChange={(e) => onPatch(item.id, { label: e.target.value })}
          />
          {linkedGoal && (
            <div className="flex flex-wrap gap-1.5 px-2 pb-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                <Link2 size={11} /> {linkedGoal.name}
              </span>
            </div>
          )}
        </div>
        <AmountInput
          className="w-24 shrink-0"
          value={item.amount}
          ariaLabel={`Montant ${item.label}`}
          disabled={readOnly}
          onChange={(v) => onPatch(item.id, { amount: v ?? 0 })}
        />
        <button
          type="button"
          className={`icon-btn ${item.recurring ? 'text-accent' : 'opacity-60'} disabled:cursor-default disabled:hover:bg-transparent`}
          title={item.recurring ? 'Récurrent : repris le mois suivant' : 'Ponctuel : non repris le mois suivant'}
          aria-label="Récurrent"
          aria-pressed={item.recurring}
          disabled={readOnly}
          onClick={() => onPatch(item.id, { recurring: !item.recurring })}
        >
          <Repeat size={15} />
        </button>
        {!readOnly && (
          <>
            <button
              type="button"
              className={`icon-btn ${open ? 'bg-sunken text-ink' : ''}`}
              title="Options"
              aria-label="Options"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <SlidersHorizontal size={15} />
            </button>
            <ConfirmDelete onConfirm={() => onDelete(item.id)} />
          </>
        )}
      </div>

      {open && !readOnly && (
        <div className="mb-2 ml-2 mr-1 grid grid-cols-2 gap-3 rounded-lg bg-sunken p-3">
          <label>
            <span className="label">Catégorie</span>
            <select
              className="field py-1.5"
              value={item.category}
              onChange={(e) => onPatch(item.id, { category: e.target.value as ItemCategory })}
            >
              {(Object.keys(CATEGORY_SINGULAR) as ItemCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_SINGULAR[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm text-ink">
            <input type="checkbox" checked={item.recurring} onChange={(e) => onPatch(item.id, { recurring: e.target.checked })} />
            Récurrent (repris le mois suivant)
          </label>
          {item.category === 'epargne' && (
            <label className="col-span-2">
              <span className="label">Objectif alimenté par cette épargne (versée à l’objectif à la clôture, si cochée « versé »)</span>
              <select
                className="field py-1.5"
                value={item.goalId ?? ''}
                onChange={(e) => onPatch(item.id, { goalId: e.target.value || null })}
              >
                <option value="">Aucun</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </li>
  );
}
