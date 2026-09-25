import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useData } from '../state/DataContext';
import { goalProgress, monthsToReach, simulateCompound, sumLines, type CompoundRow } from '../lib/calc';
import { formatCompactEUR, formatEURRounded } from '../lib/format';
import { addMonths, diffMonths, formatMonthLong } from '../lib/months';
import { AmountInput } from '../components/AmountInput';
import { Card, PageHeader } from '../components/Layout';

export function SimulatorsView({ initialGoalId }: { initialGoalId: string | null }) {
  return (
    <div>
      <PageHeader title="Simulateurs" subtitle="Projections indicatives : elles ne remplacent pas un conseil financier." />
      <CompoundSimulator />
      <GoalSimulator initialGoalId={initialGoalId} />
    </div>
  );
}

const SERIES = {
  contributed: { label: 'Versements cumulés', color: 'var(--series-3)' },
  gross: { label: 'Valeur brute', color: 'var(--series-1)' },
  net: { label: 'Valeur nette d’impôt', color: 'var(--series-2)' },
} as const;

function CompoundSimulator() {
  const { patrimoine, months, nowKey } = useData();
  const [defaults] = useState(() => {
    const invested = sumLines(patrimoine.financier.filter((l) => l.kind === 'investi'));
    const unlinkedSavings = (months.months[nowKey]?.items ?? [])
      .filter((it) => it.category === 'epargne' && !it.goalId)
      .reduce((s, it) => s + it.amount, 0);
    return { initial: invested, monthly: unlinkedSavings > 0 ? unlinkedSavings : 500 };
  });

  const [initial, setInitial] = useState<number>(defaults.initial);
  const [monthly, setMonthly] = useState<number>(defaults.monthly);
  const [rate, setRate] = useState<number>(7);
  const [years, setYears] = useState<number>(15);
  const [withTax, setWithTax] = useState(true);
  const [taxRate, setTaxRate] = useState<number>(30);

  const rows = useMemo(
    () => simulateCompound(initial, monthly, rate / 100, Math.max(0, Math.min(60, years)), withTax ? taxRate / 100 : 0),
    [initial, monthly, rate, years, withTax, taxRate],
  );
  const last = rows[rows.length - 1];
  const visible = withTax ? (['contributed', 'gross', 'net'] as const) : (['contributed', 'gross'] as const);

  return (
    <Card title="Intérêts composés (ETF)" subtitle="Versements mensuels, capitalisation mensuelle, rendement annuel constant.">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <label>
          <span className="label">Capital initial</span>
          <AmountInput variant="field" value={initial} onChange={(v) => setInitial(v ?? 0)} />
        </label>
        <label>
          <span className="label">Apport mensuel</span>
          <AmountInput variant="field" value={monthly} onChange={(v) => setMonthly(v ?? 0)} />
        </label>
        <label>
          <span className="label">Rendement annuel espéré</span>
          <AmountInput variant="field" suffix="%" value={rate} onChange={(v) => setRate(v ?? 0)} />
        </label>
        <label>
          <span className="label">Durée</span>
          <AmountInput variant="field" suffix="ans" value={years} onChange={(v) => setYears(Math.round(v ?? 0))} />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-sunken px-4 py-3 text-sm">
        <label className="flex items-center gap-2 text-ink">
          <input type="checkbox" checked={withTax} onChange={(e) => setWithTax(e.target.checked)} />
          Afficher le scénario avec fiscalité à la sortie
        </label>
        {withTax && (
          <>
            <label className="flex items-center gap-2 text-ink-2">
              Taux sur les plus-values
              <AmountInput className="w-24" variant="field" suffix="%" value={taxRate} onChange={(v) => setTaxRate(v ?? 0)} />
            </label>
            <span className="flex flex-wrap gap-1.5 text-xs text-muted">
              Préréglages :
              <button type="button" className="underline hover:text-ink" onClick={() => setTaxRate(30)}>
                CTO, flat tax 30 %
              </button>
              ·
              <button type="button" className="underline hover:text-ink" onClick={() => setTaxRate(17.2)}>
                PEA de plus de 5 ans, 17,2 %
              </button>
            </span>
          </>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Result label={`Total versé en ${years} ans`} value={formatEURRounded(last.contributed)} />
        <Result label="Valeur finale brute" value={formatEURRounded(last.gross)} strong />
        <Result label="Plus-values brutes" value={formatEURRounded(last.gains)} />
        {withTax ? (
          <Result label={`Valeur nette après ${String(taxRate).replace('.', ',')} % d’impôt`} value={formatEURRounded(last.net)} strong />
        ) : (
          <Result label="Multiplicateur du capital versé" value={last.contributed > 0 ? `× ${(last.gross / last.contributed).toFixed(2).replace('.', ',')}` : '—'} />
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-xs text-ink-2">
        {visible.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[k].color }} />
            {SERIES[k].label}
          </span>
        ))}
      </div>
      <div className="mt-2 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="year"
              tickFormatter={(y: number) => `${y} an${y > 1 ? 's' : ''}`}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--baseline)' }}
              minTickGap={20}
            />
            <YAxis tickFormatter={(v: number) => formatCompactEUR(v)} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} width={64} />
            <Tooltip cursor={{ stroke: 'var(--baseline)' }} content={(p: CompoundTooltipArgs) => <CompoundTooltip {...p} withTax={withTax} />} />
            <Area
              type="monotone"
              dataKey="contributed"
              stroke={SERIES.contributed.color}
              strokeWidth={2}
              fill={SERIES.contributed.color}
              fillOpacity={0.15}
              isAnimationActive={false}
            />
            <Line type="monotone" dataKey="gross" stroke={SERIES.gross.color} strokeWidth={2} dot={false} isAnimationActive={false} />
            {withTax && (
              <Line
                type="monotone"
                dataKey="net"
                stroke={SERIES.net.color}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 max-h-72 overflow-y-auto rounded-lg border border-line">
        <table className="tabular w-full text-sm">
          <thead className="sticky top-0 bg-sunken">
            <tr className="text-left text-xs text-muted">
              <th className="px-3 py-2 font-medium">Année</th>
              <th className="px-3 py-2 text-right font-medium">Versé</th>
              <th className="px-3 py-2 text-right font-medium">Valeur brute</th>
              <th className="px-3 py-2 text-right font-medium">Plus-values</th>
              {withTax && <th className="px-3 py-2 text-right font-medium">Valeur nette</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year} className="border-t border-line">
                <td className="px-3 py-1.5 text-ink-2">{r.year}</td>
                <td className="px-3 py-1.5 text-right">{formatEURRounded(r.contributed)}</td>
                <td className="px-3 py-1.5 text-right font-medium">{formatEURRounded(r.gross)}</td>
                <td className="px-3 py-1.5 text-right">{formatEURRounded(r.gains)}</td>
                {withTax && <td className="px-3 py-1.5 text-right font-medium">{formatEURRounded(r.net)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Approximation : l’impôt est appliqué une seule fois, sur la totalité des plus-values, comme en cas de vente complète à la fin.
        Frais de gestion, inflation et variations de marché ne sont pas pris en compte.
      </p>
    </Card>
  );
}

interface CompoundTooltipArgs {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: CompoundRow }>;
}

function CompoundTooltip({ active, payload, withTax }: CompoundTooltipArgs & { withTax: boolean }) {
  const r = payload?.[0]?.payload;
  if (!active || !r) return null;
  const lines: [keyof typeof SERIES, number][] = [
    ['gross', r.gross],
    ...(withTax ? ([['net', r.net]] as [keyof typeof SERIES, number][]) : []),
    ['contributed', r.contributed],
  ];
  return (
    <div className="tabular rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 text-muted">Après {r.year} an{r.year > 1 ? 's' : ''}</div>
      {lines.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: SERIES[k].color }} />
          <span className="text-ink-2">{SERIES[k].label}</span>
          <span className="ml-auto pl-3 font-semibold text-ink">{formatEURRounded(v)}</span>
        </div>
      ))}
    </div>
  );
}

function Result({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg border border-line px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`tabular mt-0.5 text-xl font-semibold ${strong ? 'text-ink' : 'text-ink-2'}`}>{value}</div>
    </div>
  );
}

function GoalSimulator({ initialGoalId }: { initialGoalId: string | null }) {
  const { goals, months, nowKey } = useData();
  const currentItems = months.months[nowKey]?.items ?? [];
  const candidates = goals.goals.filter((g) => g.kind === 'achat' && g.priority !== 'abandonne');

  const fromGoal = (id: string) => {
    const g = candidates.find((x) => x.id === id);
    if (!g) return null;
    const left = g.targetDate ? diffMonths(nowKey, g.targetDate) : 12;
    return { target: g.targetAmount ?? 0, saved: g.savedAmount, months: Math.max(1, left) };
  };

  const initial = (initialGoalId && fromGoal(initialGoalId)) || null;
  const [goalId, setGoalId] = useState<string>(initial ? initialGoalId! : '');
  const [target, setTarget] = useState<number>(initial?.target ?? 5000);
  const [saved, setSaved] = useState<number>(initial?.saved ?? 0);
  const [duration, setDuration] = useState<number>(initial?.months ?? 12);
  const [whatIf, setWhatIf] = useState<number | null>(null);

  const selectGoal = (id: string) => {
    setGoalId(id);
    const v = fromGoal(id);
    if (v) {
      setTarget(v.target);
      setSaved(v.saved);
      setDuration(v.months);
    }
  };

  const remaining = Math.max(0, target - saved);
  const safeDuration = Math.max(1, Math.round(duration));
  const required = remaining / safeDuration;
  const selected = candidates.find((g) => g.id === goalId);
  const current = selected ? goalProgress(selected, nowKey, currentItems).currentMonthly : 0;

  const reachLine = (monthly: number) => {
    const n = monthsToReach(remaining, monthly);
    if (n === null) return 'jamais atteint à ce rythme.';
    if (n === 0) return 'déjà atteint.';
    return `atteint en ${n} mois, soit ${formatMonthLong(addMonths(nowKey, n)).toLowerCase()}.`;
  };

  return (
    <Card className="mt-6" title="Objectif d’épargne" subtitle="Combien mettre de côté chaque mois pour atteindre un montant en un nombre de mois donné ?">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-2 gap-4">
          <label className="col-span-2">
            <span className="label">Reprendre un objectif de la liste</span>
            <select className="field" value={goalId} onChange={(e) => selectGoal(e.target.value)}>
              <option value="">Saisie libre</option>
              {candidates.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name || 'Sans nom'}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Montant visé</span>
            <AmountInput variant="field" value={target} onChange={(v) => setTarget(v ?? 0)} />
          </label>
          <label>
            <span className="label">Déjà mis de côté</span>
            <AmountInput variant="field" value={saved} onChange={(v) => setSaved(v ?? 0)} />
          </label>
          <label>
            <span className="label">En combien de mois</span>
            <AmountInput variant="field" suffix="mois" value={duration} onChange={(v) => setDuration(v ?? 1)} />
          </label>
          <label>
            <span className="label">Et si j’épargne…</span>
            <AmountInput variant="field" suffix="€/mois" allowEmpty placeholder="montant" value={whatIf} onChange={setWhatIf} />
          </label>
        </div>

        <div className="flex flex-col justify-center rounded-xl bg-accent-soft p-5">
          <div className="text-sm font-medium text-ink-2">Il faut épargner</div>
          <div className="tabular mt-1 text-4xl font-semibold tracking-tight text-ink">
            {formatEURRounded(Math.ceil(required))}
            <span className="text-lg font-medium text-ink-2"> /mois</span>
          </div>
          <div className="mt-2 text-sm text-ink-2">
            pendant {safeDuration} mois pour réunir {formatEURRounded(remaining)}, soit jusqu’à {formatMonthLong(addMonths(nowKey, safeDuration)).toLowerCase()}.
          </div>
          <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm text-ink-2">
            {selected && (
              <p>
                Au rythme actuel ({formatEURRounded(current)}/mois) : {reachLine(current)}
              </p>
            )}
            {whatIf !== null && (
              <p>
                À {formatEURRounded(whatIf)}/mois : {reachLine(whatIf)}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
