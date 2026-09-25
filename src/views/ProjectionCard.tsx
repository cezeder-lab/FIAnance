import { useMemo, useState } from 'react';
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useData } from '../state/DataContext';
import { availableWealth, monthTotals, projectWealth, sumLines, type ProjectionEvent } from '../lib/calc';
import { formatCompactEUR, formatEURRounded, formatSignedEUR } from '../lib/format';
import { addMonths, formatMonthLong, formatMonthShort } from '../lib/months';
import { AmountInput } from '../components/AmountInput';
import { Card } from '../components/Layout';

const SERIES = {
  history: { label: 'Historique', color: 'var(--series-1)', dashed: false },
  savingsOnly: { label: 'Épargne programmée seule', color: 'var(--series-1)', dashed: true },
  withLeftover: { label: 'Épargne + reste du mois', color: 'var(--series-2)', dashed: true },
} as const;
type SeriesKey = keyof typeof SERIES;

interface Row {
  month: string;
  label: string;
  history?: number;
  savingsOnly?: number;
  withLeftover?: number;
}

const HISTORY_MONTHS_SHOWN = 12;

export function ProjectionCard() {
  const { months, goals, patrimoine, nowKey } = useData();

  // Pre-filled once from the current month; the simulator stays a sandbox afterwards.
  const [defaults] = useState(() => {
    const items = months.months[nowKey]?.items ?? [];
    const savings = items.filter((it) => it.category === 'epargne');
    return {
      toLiquid: savings.filter((it) => it.goalId).reduce((s, it) => s + it.amount, 0),
      toInvested: savings.filter((it) => !it.goalId).reduce((s, it) => s + it.amount, 0),
      leftover: monthTotals(items).cashflow,
    };
  });
  const [horizon, setHorizon] = useState<12 | 24>(24);
  const [toLiquid, setToLiquid] = useState(defaults.toLiquid);
  const [toInvested, setToInvested] = useState(defaults.toInvested);
  const [leftover, setLeftover] = useState(defaults.leftover);
  const [investedRate, setInvestedRate] = useState(7);
  const [liquidRate, setLiquidRate] = useState(1.5);
  const [withInflows, setWithInflows] = useState(true);
  const [withPurchases, setWithPurchases] = useState(true);

  const end = addMonths(nowKey, horizon);
  const events = useMemo(() => {
    const list: ProjectionEvent[] = [];
    for (const g of goals.goals) {
      if (g.priority === 'abandonne' || !g.targetDate || g.targetDate > end) continue;
      if (g.kind === 'entree' && withInflows) {
        const amount = g.amountMin ?? g.amountMax;
        if (amount) list.push({ month: g.targetDate, amount, label: g.amountMax && g.amountMax !== amount ? `${g.name} (estimation basse)` : g.name });
      }
      if (g.kind === 'achat' && withPurchases && g.targetAmount) {
        list.push({ month: g.targetDate, amount: -g.targetAmount, label: g.name });
      }
    }
    return list.sort((a, b) => a.month.localeCompare(b.month));
  }, [goals, end, withInflows, withPurchases]);

  const byKind = (kind: 'liquide' | 'investi' | 'crypto') =>
    sumLines(patrimoine.financier.filter((l) => (l.kind ?? 'liquide') === kind));
  const today = availableWealth(patrimoine);

  const points = projectWealth({
    fromKey: nowKey,
    months: horizon,
    liquide: byKind('liquide'),
    investi: byKind('investi'),
    crypto: byKind('crypto'),
    toLiquid,
    toInvested,
    leftover,
    liquidRate: liquidRate / 100,
    investedRate: investedRate / 100,
    events,
  });
  const last = points[points.length - 1];

  const past = [...patrimoine.history]
    .filter((h) => h.month < nowKey)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-HISTORY_MONTHS_SHOWN);
  const rows: Row[] = [
    ...past.map((h) => ({ month: h.month, label: formatMonthShort(h.month), history: h.total })),
    ...points.map((p, i) => ({
      month: p.month,
      label: formatMonthShort(p.month),
      ...(i === 0 ? { history: today } : {}),
      savingsOnly: p.savingsOnly,
      withLeftover: p.withLeftover,
    })),
  ];
  const visible: SeriesKey[] = past.length > 0 ? ['history', 'savingsOnly', 'withLeftover'] : ['savingsOnly', 'withLeftover'];

  return (
    <Card
      title="Projection du patrimoine"
      subtitle="Patrimoine financier net disponible projeté à partir de l’épargne, du cash-flow et d’un rendement supposé."
      actions={
        <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="Horizon">
          {([12, 24] as const).map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={horizon === h}
              className={`rounded-md px-3 py-1 text-sm font-medium ${horizon === h ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:text-ink'}`}
              onClick={() => setHorizon(h)}
            >
              {h} mois
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label>
          <span className="label">Épargne sur livrets (liée aux objectifs)</span>
          <AmountInput variant="field" suffix="€/mois" value={toLiquid} onChange={(v) => setToLiquid(v ?? 0)} />
        </label>
        <label>
          <span className="label">Épargne investie</span>
          <AmountInput variant="field" suffix="€/mois" value={toInvested} onChange={(v) => setToInvested(v ?? 0)} />
        </label>
        <label>
          <span className="label">Reste du mois (cash-flow net)</span>
          <AmountInput variant="field" suffix="€/mois" value={leftover} onChange={(v) => setLeftover(v ?? 0)} />
        </label>
        <label>
          <span className="label">Rendement des placements</span>
          <AmountInput variant="field" suffix="%/an" value={investedRate} onChange={(v) => setInvestedRate(v ?? 0)} />
        </label>
        <label>
          <span className="label">Rendement des livrets</span>
          <AmountInput variant="field" suffix="%/an" value={liquidRate} onChange={(v) => setLiquidRate(v ?? 0)} />
        </label>
        <div className="flex flex-col justify-end gap-1.5 pb-1 text-sm text-ink">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={withInflows} onChange={(e) => setWithInflows(e.target.checked)} />
            Inclure les entrées prévues
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={withPurchases} onChange={(e) => setWithPurchases(e.target.checked)} />
            Déduire les achats datés
          </label>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Pré-rempli depuis {formatMonthLong(nowKey).toLowerCase()}. Le rendement des placements s’applique au compte-titres ; la crypto reste
        à sa valeur actuelle.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Result label="Aujourd’hui" value={formatEURRounded(today)} />
        <Result
          label={`${formatMonthLong(last.month)} · épargne programmée seule`}
          value={formatEURRounded(last.savingsOnly)}
          delta={last.savingsOnly - today}
        />
        <Result
          label={`${formatMonthLong(last.month)} · en épargnant aussi le reste du mois`}
          value={formatEURRounded(last.withLeftover)}
          delta={last.withLeftover - today}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-xs text-ink-2">
        {visible.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden>
              <line x1="0" y1="3" x2="18" y2="3" stroke={SERIES[k].color} strokeWidth="2" strokeDasharray={SERIES[k].dashed ? '4 3' : undefined} />
            </svg>
            {SERIES[k].label}
          </span>
        ))}
      </div>
      <div className="mt-2 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 16, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--baseline)' }}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis tickFormatter={(v: number) => formatCompactEUR(v)} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} width={64} />
            <ReferenceLine
              x={formatMonthShort(nowKey)}
              stroke="var(--baseline)"
              strokeDasharray="3 3"
              label={{ value: 'Aujourd’hui', position: 'top', fill: 'var(--muted)', fontSize: 11 }}
            />
            <Tooltip cursor={{ stroke: 'var(--baseline)' }} content={(p: TooltipArgs) => <ProjectionTooltip {...p} />} />
            {visible.map((k) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={SERIES[k].color}
                strokeWidth={2}
                strokeDasharray={SERIES[k].dashed ? '5 4' : undefined}
                dot={false}
                activeDot={{ r: 4, fill: SERIES[k].color, strokeWidth: 2, stroke: 'var(--surface)' }}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5">
        <h3 className="section-title mb-2">Entrées et achats pris en compte</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted">Aucun sur la période.</p>
        ) : (
          <ul className="tabular grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            {events.map((e) => (
              <li key={`${e.month}-${e.label}`} className="flex gap-3">
                <span className="w-16 shrink-0 text-muted">{formatMonthShort(e.month)}</span>
                <span className="flex-1 text-ink">{e.label}</span>
                <span className={`font-medium ${e.amount < 0 ? 'text-negative' : 'text-positive'}`}>{formatSignedEUR(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">
          Entrées et achats viennent de l’onglet Objectifs (date renseignée, dans l’horizon). Une échéance déjà passée est comptée le mois
          prochain.
        </p>
      </div>
    </Card>
  );
}

interface TooltipArgs {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: Row }>;
}

function ProjectionTooltip({ active, payload }: TooltipArgs) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const lines = (Object.keys(SERIES) as SeriesKey[]).filter((k) => row[k] !== undefined);
  return (
    <div className="tabular rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 text-muted">{formatMonthLong(row.month)}</div>
      {lines.map((k) => (
        <div key={k} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: SERIES[k].color }} />
          <span className="text-ink-2">{SERIES[k].label}</span>
          <span className="ml-auto pl-3 font-semibold text-ink">{formatEURRounded(row[k]!)}</span>
        </div>
      ))}
    </div>
  );
}

function Result({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="rounded-lg border border-line px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-0.5 text-xl font-semibold text-ink">{value}</div>
      {delta !== undefined && (
        <div className={`tabular text-xs font-medium ${delta < 0 ? 'text-negative' : 'text-positive'}`}>{formatSignedEUR(delta)}</div>
      )}
    </div>
  );
}
