import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CopyPlus, Gift, Link2, Plus, Repeat, SlidersHorizontal } from 'lucide-react';
import type { ItemCategory, MonthItem } from '../types';
import { useData } from '../state/DataContext';
import { monthTotals, sortedMonthKeys } from '../lib/calc';
import { formatEURRounded, formatPercent } from '../lib/format';
import { addMonths, formatMonthLong, formatMonthShort } from '../lib/months';
import { carryOver, previousMonthWithData, uid } from '../lib/seed';
import { CATEGORY_LABELS, CATEGORY_SINGULAR } from '../lib/labels';
import { AmountInput } from '../components/AmountInput';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { Card, PageHeader } from '../components/Layout';
import { TrendChart } from '../components/TrendChart';

const COLUMNS: ItemCategory[][] = [
  ['revenu', 'epargne'],
  ['depense_fixe', 'depense_variable'],
];

export function MonthView({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const { months, goals, nowKey, updateMonths } = useData();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const data = months.months[month];
  const items = data?.items ?? [];
  const totals = monthTotals(items);
  const prevWithData = previousMonthWithData(months, month);

  const setItems = (fn: (items: MonthItem[]) => MonthItem[]) =>
    updateMonths((prev) => ({
      ...prev,
      months: { ...prev.months, [month]: { items: fn(prev.months[month]?.items ?? []) } },
    }));

  const patchItem = (id: string, patch: Partial<MonthItem>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addItem = (category: ItemCategory) => {
    const id = uid();
    setItems((list) => [...list, { id, label: '', amount: 0, category, recurring: true, inKind: false, goalId: null }]);
    setFocusId(id);
  };

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

  const history = useMemo(
    () =>
      sortedMonthKeys(months).map((key) => {
        const t = monthTotals(months.months[key].items);
        return { key, label: formatMonthShort(key), value: t.cashflow, totals: t };
      }),
    [months],
  );

  const activeGoals = goals.goals.filter((g) => g.kind === 'achat');

  return (
    <div>
      <PageHeader
        title={formatMonthLong(month)}
        subtitle={month === nowKey ? 'Mois en cours' : month < nowKey ? 'Mois passé' : 'Mois à venir'}
        actions={
          <>
            {month !== nowKey && (
              <button type="button" className="btn-ghost" onClick={() => setMonth(nowKey)}>
                Revenir au mois en cours
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
                    onAdd={() => addItem(cat)}
                    onPatch={patchItem}
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
                  <td className="py-2">{formatMonthLong(h.key)}</td>
                  <td className="py-2 text-right">{formatEURRounded(h.totals.revenusCash)}</td>
                  <td className="py-2 text-right">{formatEURRounded(h.totals.depensesFixes + h.totals.depensesVariables)}</td>
                  <td className="py-2 text-right">{formatEURRounded(h.totals.epargne)}</td>
                  <td className={`py-2 text-right font-semibold ${h.value < 0 ? 'text-negative' : 'text-ink'}`}>{formatEURRounded(h.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {data && (
        <div className="mt-6 flex items-center justify-end gap-2 text-xs text-muted">
          Supprimer toutes les lignes de ce mois
          <ConfirmDelete label="Supprimer ce mois" onConfirm={deleteMonth} />
        </div>
      )}
    </div>
  );
}

function CashflowSummary({ totals }: { totals: ReturnType<typeof monthTotals> }) {
  const parts: { label: string; value: number; sign: '' | '−' }[] = [
    { label: 'Revenus', value: totals.revenusCash, sign: '' },
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
        {totals.revenusInKind > 0 && (
          <p className="w-full text-xs text-muted">
            Avantages en nature ({formatEURRounded(totals.revenusInKind)}) affichés mais exclus du cash-flow : ils ne sont pas encaissés.
          </p>
        )}
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  items,
  goals,
  focusId,
  onAdd,
  onPatch,
  onDelete,
}: {
  category: ItemCategory;
  items: MonthItem[];
  goals: { id: string; name: string }[];
  focusId: string | null;
  onAdd: () => void;
  onPatch: (id: string, patch: Partial<MonthItem>) => void;
  onDelete: (id: string) => void;
}) {
  const total = items.reduce((s, it) => s + (category === 'revenu' && it.inKind ? 0 : it.amount), 0);
  return (
    <Card
      title={CATEGORY_LABELS[category]}
      actions={<span className="tabular text-[15px] font-semibold text-ink">{formatEURRounded(total)}</span>}
      bodyClassName="px-3 py-2"
    >
      {items.length === 0 && <p className="px-2 py-3 text-sm text-muted">Aucune ligne.</p>}
      <ul>
        {items.map((it) => (
          <ItemRow key={it.id} item={it} goals={goals} autoFocus={it.id === focusId} onPatch={onPatch} onDelete={onDelete} />
        ))}
      </ul>
      <button type="button" className="btn-ghost mt-1 text-accent hover:text-accent" onClick={onAdd}>
        <Plus size={16} /> Ajouter
      </button>
    </Card>
  );
}

function ItemRow({
  item,
  goals,
  autoFocus,
  onPatch,
  onDelete,
}: {
  item: MonthItem;
  goals: { id: string; name: string }[];
  autoFocus: boolean;
  onPatch: (id: string, patch: Partial<MonthItem>) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const linkedGoal = item.goalId ? goals.find((g) => g.id === item.goalId) : undefined;

  return (
    <li className="group border-b border-line last:border-0">
      <div className="flex items-center gap-1 py-1">
        <div className="min-w-0 flex-1">
          <input
            className="inline-input"
            value={item.label}
            title={item.label}
            placeholder={`Nouvelle ligne (${CATEGORY_SINGULAR[item.category].toLowerCase()})`}
            aria-label="Libellé"
            autoFocus={autoFocus}
            onChange={(e) => onPatch(item.id, { label: e.target.value })}
          />
          {(linkedGoal || (item.category === 'revenu' && item.inKind)) && (
            <div className="flex flex-wrap gap-1.5 px-2 pb-1">
              {linkedGoal && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                  <Link2 size={11} /> {linkedGoal.name}
                </span>
              )}
              {item.category === 'revenu' && item.inKind && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-2">
                  <Gift size={11} /> En nature · hors cash-flow
                </span>
              )}
            </div>
          )}
        </div>
        <AmountInput className="w-28 shrink-0" value={item.amount} ariaLabel={`Montant ${item.label}`} onChange={(v) => onPatch(item.id, { amount: v ?? 0 })} />
        <button
          type="button"
          className={`icon-btn ${item.recurring ? 'text-accent' : 'opacity-60'}`}
          title={item.recurring ? 'Récurrent : repris le mois suivant' : 'Ponctuel : non repris le mois suivant'}
          aria-label="Récurrent"
          aria-pressed={item.recurring}
          onClick={() => onPatch(item.id, { recurring: !item.recurring })}
        >
          <Repeat size={15} />
        </button>
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
      </div>

      {open && (
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
              <span className="label">Objectif alimenté par cette épargne</span>
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
          {item.category === 'revenu' && (
            <label className="col-span-2 flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={Boolean(item.inKind)} onChange={(e) => onPatch(item.id, { inKind: e.target.checked })} />
              Avantage en nature (non encaissé, exclu du cash-flow)
            </label>
          )}
        </div>
      )}
    </li>
  );
}
